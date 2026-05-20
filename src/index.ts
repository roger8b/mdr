#!/usr/bin/env node
import { Command } from "commander";
import { serve } from "./server.js";
import pc from "picocolors";
import path from "node:path";

const version = "1.0.0";

const program = new Command();

program
  .name("md-server")
  .description("Serve and render markdown files via HTTP")
  .version(version)
  .argument("<file>", "Path to the markdown file")
  .action(async (file: string) => {
    const resolvedPath = path.resolve(file);

    try {
      await serve(resolvedPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error: ${message}`));
      process.exitCode = 1;
    }
  });

program.parse();