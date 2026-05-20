#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import http from "node:http";
import { runInit } from "./commands/init.js";

const LOCK_DIR = path.join(os.homedir(), ".mdr");
const LOCK_FILE = path.join(LOCK_DIR, "server.lock");

interface LockData {
  port: number;
  pid: number;
}

async function readLockFile(): Promise<LockData | null> {
  try {
    const content = await fs.readFile(LOCK_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function removeLockFile(): Promise<void> {
  try {
    await fs.rm(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

async function isServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function checkExistingServer(): Promise<LockData | null> {
  const lockData = await readLockFile();
  if (!lockData) return null;

  try {
    process.kill(lockData.pid, 0);
  } catch {
    await removeLockFile();
    return null;
  }

  const canConnect = await isServerRunning(lockData.port);
  if (!canConnect) {
    await removeLockFile();
    return null;
  }

  return lockData;
}

async function startServerDaemon(): Promise<number> {
  const distPath = path.join(process.cwd(), "dist", "server.js");

  const child = spawn("node", [distPath, "--daemon"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });

  child.unref();

  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 200));
    const lock = await readLockFile();
    if (lock) {
      return lock.port;
    }
    attempts++;
  }

  throw new Error("Failed to start server");
}

async function startServer(): Promise<void> {
  const existing = await checkExistingServer();
  if (existing) {
    console.log(pc.green(`✓ Server already running on port ${existing.port}`));
    console.log(pc.dim(`  PID: ${existing.pid}`));
    console.log(pc.dim(`  mdr open <file> to open a document`));
    return;
  }

  console.log(pc.dim("Starting server..."));

  const port = await startServerDaemon();
  const lock = await readLockFile();

  console.log(pc.green(`✓ Server started on port ${port}`));
  console.log(pc.dim(`  PID: ${lock?.pid}`));
  console.log(pc.dim(`  mdr open <file> to open a document`));
}

async function stopServer(): Promise<void> {
  const lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server is not running"));
    return;
  }

  console.log(pc.dim(`Stopping server (PID: ${lockData.pid})...`));

  try {
    process.kill(lockData.pid, "SIGTERM");
    await new Promise((r) => setTimeout(r, 500));

    const stillRunning = await isServerRunning(lockData.port);
    if (stillRunning) {
      process.kill(lockData.pid, "SIGKILL");
    }
  } catch {
    // Process might already be dead
  }

  await removeLockFile();
  console.log(pc.green("✓ Server stopped"));
}

async function statusServer(): Promise<void> {
  const lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server is not running"));
    return;
  }

  console.log(pc.green("✓ Server is running"));
  console.log(`  Port: ${lockData.port}`);
  console.log(`  PID:  ${lockData.pid}`);

  try {
    const res = await fetch(`http://127.0.0.1:${lockData.port}/docs`);
    if (res.ok) {
      const docs = await res.json() as { id: string; title: string }[];
      console.log(`  Docs: ${docs.length} open`);
      if (docs.length > 0) {
        docs.forEach((doc) => {
          console.log(`    - ${doc.title}`);
        });
      }
    }
  } catch {
    // Ignore
  }
}

async function listDocuments(): Promise<void> {
  const lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server is not running"));
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:${lockData.port}/docs`);
    if (res.ok) {
      const docs = await res.json() as { id: string; title: string; filePath: string }[];
      if (docs.length === 0) {
        console.log(pc.dim("No documents open"));
        return;
      }
      console.log(pc.green(`${docs.length} document(s):`));
      docs.forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc.title}`);
        console.log(`     ID: ${doc.id}`);
        console.log(pc.dim(`     ${doc.filePath}`));
      });
    }
  } catch (err) {
    console.error(pc.red(`Error: ${err}`));
    process.exitCode = 1;
  }
}

async function closeDocument(docId: string): Promise<void> {
  const lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server is not running"));
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:${lockData.port}/close?id=${encodeURIComponent(docId)}`);
    if (res.ok) {
      console.log(pc.green(`✓ Closed document ${docId}`));
    } else {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (err) {
    console.error(pc.red(`Error: ${err}`));
    process.exitCode = 1;
  }
}

async function purgeServer(): Promise<void> {
  const lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server is not running"));
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:${lockData.port}/purge`);
    if (res.ok) {
      console.log(pc.green("✓ All documents closed, server purged"));
    } else {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (err) {
    console.error(pc.red(`Error: ${err}`));
    process.exitCode = 1;
  }
}

async function openDocument(filePath: string): Promise<void> {
  const resolvedPath = path.resolve(filePath);

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }

  let lockData = await checkExistingServer();

  if (!lockData) {
    console.log(pc.yellow("Server not running, starting..."));
    await startServer();
    lockData = await checkExistingServer();

    if (!lockData) {
      throw new Error("Failed to start server");
    }
  }

  const docId = Buffer.from(resolvedPath).toString("base64url");
  const url = `http://127.0.0.1:${lockData.port}/open?path=${encodeURIComponent(resolvedPath)}&id=${encodeURIComponent(docId)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { url: string };
      console.log(pc.green(`✓ Opening ${path.basename(resolvedPath)}`));
      console.log(pc.dim(`  ${data.url}`));
    } else {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (err) {
    console.error(pc.red(`✗ Failed to open document: ${err}`));
    process.exitCode = 1;
  }
}

const program = new Command();

program
  .name("mdr")
  .description("Markdown Document Renderer - Serve and view markdown files in Chrome")
  .version("1.0.0");

program
  .command("start")
  .description("Start the mdr server in background")
  .action(startServer);

program
  .command("stop")
  .description("Stop the mdr server")
  .action(stopServer);

program
  .command("status")
  .description("Check if mdr server is running")
  .action(statusServer);

program
  .command("list")
  .description("List all open documents")
  .action(listDocuments);

program
  .command("open")
  .description("Open a markdown file in Chrome")
  .argument("<file>", "Path to markdown file")
  .action(openDocument);

program
  .command("close")
  .description("Close a document by ID")
  .argument("<id>", "Document ID to close")
  .action(closeDocument);

program
  .command("purge")
  .description("Close all documents, keep server running")
  .action(purgeServer);

program
  .command("init")
  .description("Wire a project for AI agents (install skills, update rule files)")
  .option("-y, --yes", "Non-interactive: use defaults", false)
  .option("--scope <local|global|both>", "Install scope", undefined)
  .option("--method <symlink|copy>", "Installation method", undefined)
  .option("--show-all", "Show all agents, not just detected", false)
  .option("--update", "Re-sync existing skills", false)
  .option("--force", "Overwrite existing mdr sections", false)
  .action(async (opts) => {
    try {
      const exitCode = await runInit({
        cwd: process.cwd(),
        yes: opts.yes,
        scope: opts.scope,
        method: opts.method,
        showAll: opts.showAll,
        update: opts.update,
        force: opts.force,
      });
      process.exitCode = exitCode;
    } catch (err) {
      console.error(pc.red(`\n✗ ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

program.parse();