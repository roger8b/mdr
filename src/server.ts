import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import pc from "picocolors";
import open from "open";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { watch, FSWatcher } from "node:fs";
import { randomInt } from "node:crypto";
import { EventEmitter } from "node:events";
import os from "node:os";

const AVOID_PORTS = [3000, 3001, 3002, 5173, 5174, 4200, 4201, 8000, 8080];
const LOCK_DIR = path.join(os.homedir(), ".mdr");
const LOCK_FILE = path.join(LOCK_DIR, "server.lock");

interface DocumentEntry {
  id: string;
  filePath: string;
  content: string;
  html: string;
  lastModified: number;
}

const documents = new Map<string, DocumentEntry>();
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

let serverInstance: ReturnType<typeof createServer> | null = null;
let currentPort: number | null = null;
const fileWatchers = new Map<string, FSWatcher>();

function processMermaidBlocks(html: string): string {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_: string, code: string) => {
      const decoded = code
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
      return `<div class="mermaid">${decoded.trim()}</div>`;
    }
  );
}

// generateDocId is used by CLI to create doc IDs
function generateDocId(filePath: string): string {
  return Buffer.from(path.resolve(filePath)).toString("base64url");
}

// Export for CLI usage
export { generateDocId };

async function renderMarkdown(filePath: string): Promise<{ content: string; html: string }> {
  const content = await fs.readFile(filePath, "utf-8");
  const rawHtml = await marked.parse(content);
  const html = processMermaidBlocks(rawHtml);
  return { content, html };
}

function findAvailablePort(startPort: number, maxAttempts = 50): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryPort = (port: number) => {
      if (attempts >= maxAttempts) {
        reject(new Error("No available port found"));
        return;
      }

      const server = createServer();
      server.once("error", () => {
        attempts++;
        tryPort(port + 1);
      });
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };

    tryPort(startPort);
  });
}

async function getAvailablePort(): Promise<number> {
  for (let i = 0; i < 10; i++) {
    const port = randomInt(4000, 9000);
    if (AVOID_PORTS.includes(port)) continue;

    try {
      const port2 = await findAvailablePort(port, 3);
      return port2;
    } catch {
      // Continue trying
    }
  }

  return findAvailablePort(4000);
}

async function writeLockFile(port: number): Promise<void> {
  await fs.mkdir(LOCK_DIR, { recursive: true });
  const data = { port, pid: process.pid };
  await fs.writeFile(LOCK_FILE, JSON.stringify(data));
}

async function removeLockFile(): Promise<void> {
  try {
    await fs.rm(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${currentPort}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendEvent = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    const onUpdate = (docId: string) => {
      sendEvent(JSON.stringify({ type: "update", docId }));
    };

    emitter.on("update", onUpdate);

    req.on("close", () => {
      emitter.off("update", onUpdate);
    });

    return;
  }

  if (url.pathname === "/open") {
    const filePath = url.searchParams.get("path");
    const docId = url.searchParams.get("id");

    if (!filePath || !docId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing path or id" }));
      return;
    }

    addDocument(filePath, docId)
      .then(({ url: docUrl }) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url: docUrl }));
      })
      .catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });

    return;
  }

  if (url.pathname === "/docs") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const docs = Array.from(documents.entries()).map(([id, doc]) => ({
      id,
      filePath: doc.filePath,
      title: path.basename(doc.filePath).replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    }));
    res.end(JSON.stringify(docs));
    return;
  }

  const docMatch = url.pathname.match(/^\/doc\/(.+)$/);
  if (docMatch) {
    const docId = docMatch[1];
    const doc = documents.get(docId);
    if (doc) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify({
        filePath: doc.filePath,
        content: doc.content,
        html: doc.html,
        lastModified: doc.lastModified,
      }));
      return;
    }
  }

  if (url.pathname === "/close") {
    const docId = url.searchParams.get("id");
    if (docId) {
      const watcher = fileWatchers.get(docId);
      if (watcher) {
        watcher.close();
        fileWatchers.delete(docId);
      }
      documents.delete(docId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing doc id" }));
    }
    return;
  }

  if (url.pathname === "/purge") {
    // Close all watchers and clear all documents
    fileWatchers.forEach((watcher) => watcher.close());
    fileWatchers.clear();
    documents.clear();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (url.pathname.startsWith("/download")) {
    const docId = url.searchParams.get("id");
    if (docId) {
      const doc = documents.get(docId);
      if (doc) {
        res.writeHead(200, {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${path.basename(doc.filePath)}"`,
        });
        res.end(doc.content);
        return;
      }
    }
  }

  const docIdFromPath = url.pathname.replace(/^\//, "");
  if (documents.has(docIdFromPath)) {
    const doc = documents.get(docIdFromPath)!;
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(buildDocPage(doc.html, path.basename(doc.filePath), docIdFromPath));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(buildIndexPage());
}

async function addDocument(filePath: string, docId: string): Promise<{ url: string }> {
  const resolvedPath = path.resolve(filePath);
  const { content, html } = await renderMarkdown(resolvedPath);

  documents.set(docId, {
    id: docId,
    filePath: resolvedPath,
    content,
    html,
    lastModified: Date.now(),
  });

  watchFile(resolvedPath, docId);

  const url = `http://localhost:${currentPort}/${docId}`;
  await open(url, { app: { name: "Google Chrome" } });

  return { url };
}

function buildIndexPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Renderer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #fafafa; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 2rem; margin-bottom: 24px; color: #111; }
    .doc-list { display: flex; flex-direction: column; gap: 16px; }
    .doc-item { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px; text-decoration: none; color: inherit; transition: all 0.2s; }
    .doc-item:hover { border-color: #888; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .doc-title { font-size: 1.125rem; font-weight: 600; color: #111; margin-bottom: 8px; }
    .doc-path { font-size: 0.875rem; color: #888; }
    .loading { color: #888; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📄 Markdown Renderer</h1>
    <div class="doc-list" id="docList">
      <p class="loading">Loading documents...</p>
    </div>
  </div>
  <script>
    const docList = document.getElementById('docList');
    let eventSource = null;

    async function loadDocs() {
      try {
        const res = await fetch('/docs');
        const docs = await res.json();
        if (docs.length === 0) {
          docList.innerHTML = '<p class="loading">No documents loaded yet. Run mdr open to add a file.</p>';
          return;
        }
        docList.innerHTML = docs.map(doc => \`<a href="/\${doc.id}" class="doc-item"><div class="doc-title">\${doc.title}</div><div class="doc-path">\${doc.filePath}</div></a>\`).join('');
      } catch (e) {
        docList.innerHTML = '<p class="loading">Error loading documents.</p>';
      }
    }

    function connectSSE() {
      if (eventSource) eventSource.close();
      eventSource = new EventSource('/events');
      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'update') {
          loadDocs();
        }
      };
      eventSource.onerror = () => {
        setTimeout(connectSSE, 3000);
      };
    }

    loadDocs();
    connectSSE();
  </script>
</body>
</html>`;
}

function buildDocPage(htmlContent: string, fileName: string, docId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fileName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg-primary: #ffffff;
      --text-primary: #111111;
      --text-secondary: #666666;
      --text-tertiary: #888888;
      --border-light: #e5e5e5;
      --content-width: 720px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 18px;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      -webkit-font-smoothing: antialiased;
      padding-bottom: 60px;
    }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-light);
    }

    .header-inner {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: 0 24px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-tertiary);
      text-decoration: none;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .logo-icon { width: 18px; height: 18px; }

    .header-right { display: flex; align-items: center; gap: 8px; }

    .live-indicator {
      font-size: 0.7rem;
      padding: 4px 8px;
      border-radius: 4px;
      background: #def;
      color: #48c;
      font-weight: 600;
      transition: background 0.3s, color 0.3s;
    }

    .live-indicator.updated { background: #dfd; color: #484; }

    .width-control {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    }

    .width-control:hover { background: #f5f5f5; }
    .width-control svg { width: 16px; height: 16px; color: var(--text-tertiary); }

    .width-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 8px 0;
      min-width: 160px;
      display: none;
      z-index: 200;
    }

    .width-dropdown.show { display: block; }

    .width-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--text-secondary);
      transition: background 0.15s;
    }

    .width-option:hover { background: #f5f5f5; }
    .width-option.active { color: var(--text-primary); font-weight: 500; }
    .width-option svg { width: 14px; height: 14px; opacity: 0.5; }
    .width-option.active svg { opacity: 1; color: var(--text-primary); }
    .width-preview { width: 100%; height: 2px; background: var(--border-light); border-radius: 1px; }
    .width-option.active .width-preview { background: var(--text-primary); }

    .export-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: none;
      border: 1px solid var(--border-light);
      transition: all 0.2s;
      position: relative;
    }

    .export-btn:hover { background: #f5f5f5; color: var(--text-primary); border-color: var(--text-tertiary); }
    .export-btn svg { width: 16px; height: 16px; }

    .export-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 6px 0;
      min-width: 150px;
      display: none;
      z-index: 200;
    }

    .export-dropdown.show { display: block; }

    .export-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.15s;
    }

    .export-option:hover { background: #f5f5f5; color: var(--text-primary); }
    .export-option svg { width: 16px; height: 16px; opacity: 0.6; }

    .container { max-width: var(--content-width); margin: 0 auto; padding: 48px 24px 120px; }

    .article-header { margin-bottom: 48px; }
    .article-category { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 12px; }
    .article-title { font-family: 'Playfair Display', Georgia, serif; font-size: 2.75rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; margin-bottom: 16px; letter-spacing: -0.02em; }
    .article-subtitle { font-size: 1.125rem; font-weight: 400; color: var(--text-secondary); line-height: 1.6; margin-bottom: 32px; }
    .article-meta { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: var(--text-tertiary); padding-top: 24px; border-top: 1px solid var(--border-light); }
    .meta-author { font-weight: 500; color: var(--text-secondary); }
    .meta-divider { width: 4px; height: 4px; background: var(--border-light); border-radius: 50%; }

    .article-content { font-size: 1.0625rem; line-height: 1.75; }
    .article-content p { margin-bottom: 28px; color: var(--text-primary); }
    .article-content h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-top: 64px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); line-height: 1.3; }
    .article-content h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.375rem; font-weight: 700; color: var(--text-primary); margin-top: 48px; margin-bottom: 20px; line-height: 1.35; }
    .article-content h4 { font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin-top: 32px; margin-bottom: 16px; }
    .article-content a { color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; transition: opacity 0.2s; }
    .article-content a:hover { opacity: 0.7; }
    .article-content strong { font-weight: 700; color: var(--text-primary); }
    .article-content em { font-style: italic; }

    .article-content blockquote { margin: 40px 0; padding: 0; border-left: none; font-family: 'Playfair Display', Georgia, serif; font-size: 1.375rem; font-weight: 400; font-style: italic; color: var(--text-secondary); line-height: 1.5; }
    .article-content blockquote p { margin-bottom: 0; }

    .article-content ul, .article-content ol { margin: 24px 0 32px; padding-left: 0; list-style: none; }
    .article-content li { position: relative; padding-left: 24px; margin-bottom: 12px; color: var(--text-primary); }
    .article-content ul li::before { content: ''; position: absolute; left: 0; top: 10px; width: 6px; height: 6px; background: var(--text-primary); border-radius: 50%; }
    .article-content ol { counter-reset: list; }
    .article-content ol li { counter-increment: list; }
    .article-content ol li::before { content: counter(list) '.'; position: absolute; left: 0; font-weight: 600; color: var(--text-secondary); }

    .article-content hr { border: none; margin: 56px auto; width: 100%; height: 1px; background: var(--border-light); }
    .article-content code { font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 0.875em; background: var(--bg-primary); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); border: 1px solid var(--border-light); }
    .article-content pre { background: #fafafa; border: 1px solid var(--border-light); border-radius: 12px; padding: 28px; margin: 36px 0; overflow-x: auto; }
    .article-content pre code { background: transparent; padding: 0; font-size: 0.9em; line-height: 1.7; border: none; color: var(--text-primary); }
    .article-content table { width: 100%; margin: 36px 0; border-collapse: collapse; font-size: 0.9375rem; }
    .article-content th, .article-content td { padding: 14px 16px; text-align: left; border-bottom: 1px solid var(--border-light); }
    .article-content th { font-weight: 600; color: var(--text-primary); font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .article-content tr:hover td { background: #fafafa; }
    .article-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 36px 0; border: 1px solid var(--border-light); }

    .article-content .mermaid { background: #fafafa; border: 1px solid var(--border-light); border-radius: 12px; padding: 32px; margin: 36px 0; text-align: center; }
    .article-content .mermaid svg { max-width: none; height: auto; display: block; margin: 0 auto; }

    .mermaid-container { position: relative; width: 100%; max-width: 100%; background: #fafafa; border: 1px solid var(--border-light); border-radius: 12px; margin: 36px 0; overflow: auto; }
    .mermaid-container .mermaid { border: none; border-radius: 0; margin: 0; padding: 24px; width: 100%; background: transparent; display: flex; align-items: center; justify-content: center; }
    .mermaid-container .mermaid svg { display: block; max-width: none !important; max-height: none !important; margin: 0 auto; }

    .site-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 32px; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .site-footer span { font-size: 0.7rem; color: var(--text-tertiary); }
    .progress-bar { position: fixed; top: 56px; left: 0; height: 2px; background: var(--text-primary); width: 0%; transition: width 0.1s ease; z-index: 99; }

    @media (max-width: 768px) {
      .article-title { font-size: 2.25rem; }
      .article-content h2 { font-size: 1.5rem; }
      .container { padding: 32px 20px 100px; }
    }

    @media print { .progress-bar, .site-header, .site-footer { display: none !important; } }
  </style>
</head>
<body>
  <div class="progress-bar" id="progress"></div>
  
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        DOCS
      </a>
      <div class="header-right">
        <span class="live-indicator" id="liveIndicator">LIVE</span>

        <div class="width-control" id="widthControl" onclick="toggleWidthDropdown()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 6H3M21 12H3M21 18H3"/></svg>
          <div class="width-dropdown" id="widthDropdown">
            <div class="width-option" onclick="setWidth(480, event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div><div>Narrow</div><div class="width-preview" style="width: 60%"></div></div></div>
            <div class="width-option active" onclick="setWidth(720, event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div><div>Default</div><div class="width-preview" style="width: 80%"></div></div></div>
            <div class="width-option" onclick="setWidth(960, event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div><div>Wide</div><div class="width-preview" style="width: 100%"></div></div></div>
            <div class="width-option" onclick="setWidth(1200, event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div><div>Full Width</div><div class="width-preview" style="width: 120%"></div></div></div>
          </div>
        </div>

        <button class="export-btn" id="exportBtn" onclick="toggleExportDropdown()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-left:2px"><polyline points="6 9 12 15 18 9"/></svg>
          <div class="export-dropdown" id="exportDropdown">
            <a href="/download?id=${docId}" class="export-option">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Markdown
            </a>
            <div class="export-option" onclick="window.print()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              PDF
            </div>
          </div>
        </button>
      </div>
    </div>
  </header>

  <main>
    <article class="container">
      <header class="article-header">
        <div class="article-category" id="articleCategory">ARTICLE</div>
        <h1 class="article-title" id="articleTitle">${escapeHtml(fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))}</h1>
        <p class="article-subtitle" id="articleSubtitle">Previewing markdown content with elegant typography</p>
        <div class="article-meta">
          <span class="meta-author">Document Viewer</span>
          <span class="meta-divider"></span>
          <span class="meta-date" id="articleDate"></span>
          <span class="meta-divider"></span>
          <span class="meta-read-time" id="readTime"></span>
        </div>
      </header>
      
      <div class="article-content" id="articleContent">
        ${htmlContent}
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <span>Document Viewer © ${new Date().getFullYear()}</span>
  </footer>

  <script>
    const docId = "${docId}";
    let lastModified = ${Date.now()};

    const indicator = document.getElementById('liveIndicator');
    let eventSource = new EventSource('/events');

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'update' && data.docId === docId) {
        loadContent();
      }
    };

    eventSource.onerror = () => {
      setTimeout(() => { eventSource = new EventSource('/events'); }, 3000);
    };

    async function loadContent() {
      try {
        const res = await fetch('/doc/' + docId);
        const doc = await res.json();
        if (doc.lastModified !== lastModified) {
          document.getElementById('articleContent').innerHTML = doc.html;
          lastModified = doc.lastModified;
          indicator.classList.add('updated');
          setTimeout(() => indicator.classList.remove('updated'), 1500);
          initMermaid();
        }
      } catch (e) { console.error('Failed to load content:', e); }
    }

    function initMermaid() {
      const diagrams = document.querySelectorAll('.article-content .mermaid');
      diagrams.forEach(d => {
        if (!d.closest('.mermaid-container')) {
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          d.parentNode.insertBefore(container, d);
          container.appendChild(d);
        }
      });
      if (diagrams.length > 0) {
        mermaid.run({ nodes: [...diagrams] });
      }
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: { fontFamily: 'Inter, sans-serif', fontSize: '14px', primaryColor: '#fafafa', primaryBorderColor: '#e5e5e5', primaryTextColor: '#111111', lineColor: '#888888' }
    });

    document.addEventListener('DOMContentLoaded', initMermaid);

    document.addEventListener('click', (e) => {
      if (!document.getElementById('widthControl')?.contains(e.target)) {
        document.getElementById('widthDropdown')?.classList.remove('show');
      }
      if (!document.getElementById('exportBtn')?.contains(e.target)) {
        document.getElementById('exportDropdown')?.classList.remove('show');
      }
    });

    function toggleWidthDropdown() {
      document.getElementById('widthDropdown')?.classList.toggle('show');
      document.getElementById('exportDropdown')?.classList.remove('show');
    }

    function toggleExportDropdown() {
      document.getElementById('exportDropdown')?.classList.toggle('show');
      document.getElementById('widthDropdown')?.classList.remove('show');
    }

    function setWidth(width, e) {
      e.stopPropagation();
      document.documentElement.style.setProperty('--content-width', width + 'px');
      document.querySelectorAll('.width-option').forEach(o => o.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.getElementById('widthDropdown')?.classList.remove('show');
    }

    const date = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('articleDate').textContent = date.toLocaleDateString('en-US', options);
    const wordCount = document.body.innerText.trim().split(/\s+/).length;
    document.getElementById('readTime').textContent = Math.ceil(wordCount / 200) + ' min read';

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      document.getElementById('progress').style.width = ((scrollTop / docHeight) * 100) + '%';
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function watchFile(filePath: string, docId: string): void {
  const existing = fileWatchers.get(docId);
  if (existing) {
    existing.close();
  }

  const watcher = watch(filePath, { persistent: true });

  watcher.on("change", async () => {
    try {
      const { content, html } = await renderMarkdown(filePath);
      const doc = documents.get(docId);
      if (doc) {
        doc.content = content;
        doc.html = html;
        doc.lastModified = Date.now();
        emitter.emit("update", docId);
      }
    } catch (err) {
      console.error(pc.yellow(`Error reloading ${filePath}:`), err);
    }
  });

  fileWatchers.set(docId, watcher);
}

async function startServer(): Promise<number> {
  const port = await getAvailablePort();
  currentPort = port;

  await writeLockFile(port);

  serverInstance = createServer(handleRequest);

  return new Promise<void>((resolve, reject) => {
    serverInstance!.on("error", (err) => {
      reject(err);
    });
    serverInstance!.listen(port, "127.0.0.1", () => {
      resolve();
    });
  }).then(() => port);
}

async function stopServer(): Promise<void> {
  fileWatchers.forEach((watcher) => watcher.close());
  await removeLockFile();
  serverInstance?.close();
}

export { startServer, stopServer, addDocument };

// Run as daemon if --daemon flag is passed
const isDaemon = process.argv.includes("--daemon");
if (isDaemon) {
  startServer()
    .then((port) => {
      console.log(pc.green(`mdr server running on http://localhost:${port}`));
      console.log(pc.dim("Press Ctrl+C to stop"));
    })
    .catch((err) => {
      console.error(pc.red(`Failed to start server: ${err}`));
      process.exit(1);
    });

  process.on("SIGTERM", async () => {
    await stopServer();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await stopServer();
    process.exit(0);
  });
}