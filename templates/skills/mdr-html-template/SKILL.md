---
name: html-template-generator
description: Use this skill when the user wants to generate HTML presentations, create web pages, build markdown renderers, generate templates, or create styled HTML output from markdown/structured data. The `mdr` CLI drives a Chrome browser to render and display markdown documents with live reload. Do NOT invoke for general file I/O, simple text generation, or when the user explicitly wants a different output format.
---

# html-template-generator

`mdr` (Markdown Document Renderer) is a CLI tool that serves markdown files in Chrome with live reload. It provides a daemon-based server architecture for rendering markdown documents with real-time preview updates.

## When to use

- User asks to "render markdown in browser", "preview HTML", "serve markdown", "view HTML output"
- Generate styled HTML from markdown content
- Create web-based presentations or documentation
- Need live preview with auto-reload for markdown/HTML files
- User wants to "open in Chrome" or "preview" a markdown document

## When NOT to use

- General file operations without browser rendering
- Pure text/markdown generation without preview
- Server-side HTML generation without display
- Simple file copying or templating

## Available commands

| Command | Description |
|---------|-------------|
| `mdr start` | Start the mdr server in background |
| `mdr stop` | Stop the mdr server |
| `mdr status` | Check if server is running |
| `mdr list` | List all open documents |
| `mdr open <file>` | Open a markdown file in Chrome |
| `mdr close <id>` | Close a document by ID |
| `mdr purge` | Close all documents, keep server running |

## Usage examples

```bash
# Start the server
mdr start

# Open a markdown file
mdr open document.md

# List open documents
mdr list

# Stop the server
mdr stop

# Check server status
mdr status

# Close a specific document
mdr close <document-id>

# Close all documents
mdr purge
```

## Architecture

- **Daemon mode**: Server runs in background with PID tracking
- **Lock file**: `~/.mdr/server.lock` stores port and PID
- **Health check**: HTTP endpoint at `/health`
- **Document management**: Each document gets a unique ID (base64url of file path)

## Quick recipes

```bash
# Start server and open a file
mdr start && mdr open README.md

# View multiple documents
mdr open chapter1.md
mdr open chapter2.md

# Check what's open
mdr list

# Stop everything
mdr stop
```

## Hard rules

- Server must be started before opening documents
- Document IDs are derived from file path (base64url encoding)
- Lock file management ensures single server instance
- PID tracking allows clean server shutdown