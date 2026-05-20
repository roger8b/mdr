# mdr — Markdown Document Renderer

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<!-- README-I18N:START -->

**English** | [Português](./README.pt.md)

<!-- README-I18N:END -->

## Overview

`mdr` (Markdown Document Renderer) is a CLI tool that serves markdown files in Chrome with live reload. It provides a daemon-based server architecture for rendering markdown documents with real-time preview updates.

### Key Features

- **Daemon Mode**: Server runs in background with PID tracking
- **Live Reload**: Automatic refresh when files change
- **Document Management**: Open, close, list documents via CLI
- **Lock File**: `~/.mdr/server.lock` stores port and PID for single instance
- **Agent Integration**: Skills and rule files for AI coding agents

## Installation

```bash
git clone https://github.com/roger8b/mdr ~/wiki/mdr
cd ~/wiki/mdr
npm install
npm run build
npm link
```

**Or use the installer:**

```bash
./install.sh
```

## Quick Start

```bash
# 1. Start the server
mdr start

# 2. Open a markdown file in Chrome
mdr open document.md

# 3. List open documents
mdr list

# 4. Check server status
mdr status

# 5. Stop the server
mdr stop
```

## Commands

### `mdr start`

Start the mdr server in background.

```bash
mdr start
```

**Output:**
```
Starting server...
✓ Server started on port <port>
  PID: <pid>
  mdr open <file> to open a document
```

### `mdr stop`

Stop the mdr server gracefully.

```bash
mdr stop
```

**Output:**
```
Stopping server (PID: <pid>)...
✓ Server stopped
```

### `mdr status`

Check if mdr server is running.

```bash
mdr status
```

**Output:**
```
✓ Server is running
  Port: <port>
  PID:  <pid>
  Docs: <n> open
    - <document-title>
```

### `mdr list`

List all open documents.

```bash
mdr list
```

**Output:**
```
<count> document(s):
  1. <document-title>
     ID: <document-id>
     <file-path>
```

### `mdr open <file>`

Open a markdown file in Chrome.

```bash
mdr open document.md
mdr open path/to/file.md
mdr open README.md
```

**Output:**
```
✓ Opening <file-name>
  <url>
```

**Error cases:**
- File not found: `✗ Failed to open document: File not found: <path>`
- Server not running: Automatically starts the server first

### `mdr close <id>`

Close a document by its ID.

```bash
mdr close <document-id>
```

**Output:**
```
✓ Closed document <document-id>
```

### `mdr purge`

Close all documents, keep server running.

```bash
mdr purge
```

**Output:**
```
✓ All documents closed, server purged
```

### `mdr init`

Wire a project for AI agents. Interactive (or `--yes`) project wiring that detects installed AI agents, installs `mdr-*` skills, and injects marker-delimited rules into agent rule files.

| Flag | Default | Purpose |
|------|---------|---------|
| `-y, --yes` | ask | Non-interactive: use defaults |
| `--scope <local\|global\|both>` | ask | `local` = project dirs; `global` = each agent's home dir; `both` |
| `--method <symlink\|copy>` | ask (symlink) | `symlink` auto-updates skills; `copy` is static snapshot |
| `--update` | – | Re-sync existing skills without prompting |
| `--show-all` | – | List every supported agent, not just detected ones |
| `--force` | – | Overwrite even if a mdr section already exists |

```bash
mdr init                              # interactive
mdr init -y                           # non-interactive, sane defaults
mdr init --scope both --method copy   # explicit, still picks agents interactively
mdr init -y --scope global            # user-wide skills for detected agents
```

**Output:**
```
project: /path/to/project

Agents (detected) — use space to toggle
  ✓ Claude Code (detected)
  ✓ Pi (detected)

Local   (inside project, per agent dir)
  > .claude/skills
    ✓ 1 skill(s) symlinked
  ✓ wrote CLAUDE.md

✓ wrote .mdr.json

✓ project wired to mdr. Run `mdr status` to verify.
```

## Architecture

```
~/.mdr/                     User data root
└── server.lock             PID and port tracking
```

### Components

| Component | Description |
|-----------|-------------|
| **Daemon Server** | Background HTTP server with document management |
| **Lock File** | `~/.mdr/server.lock` stores { port, pid } for single instance |
| **Document ID** | Base64url encoding of the absolute file path |
| **Health Endpoint** | `http://127.0.0.1:<port>/health` for status checks |
| **Agent Skills** | `mdr-*` skill templates for AI agent integration |

### Flow

1. `mdr start` → spawns detached child process → writes `~/.mdr/server.lock`
2. `mdr open <file>` → checks lock → fetches `/open?path=<path>&id=<id>`
3. `mdr stop` → reads lock → sends SIGTERM → removes lock file

## Use Cases

### Live Preview for Documentation

```bash
# Start server and open your docs
mdr start && mdr open docs/index.md

# Edit in your editor — browser auto-refreshes
```

### Multiple Document Comparison

```bash
mdr open spec-v1.md
mdr open spec-v2.md
mdr list  # compare side by side
```

### AI Agent Integration

Wire your project so AI agents know about `mdr`:

```bash
cd ~/code/my-project
mdr init -y
```

This installs skills into:
- `.claude/skills/` (Claude Code)
- `.pi/skills/` (Pi)
- `.cursor/rules/mdr.mdc` (Cursor)
- And other detected agents

The rules section tells agents to use `mdr` for markdown preview and browser rendering.

## Environment & Paths

| What | Where | Notes |
|------|-------|-------|
| Lock file | `~/.mdr/server.lock` | Do not edit manually |
| Server port | Dynamic (stored in lock) | Health check at `/health` |
| Document IDs | base64url(file path) | Consistent across sessions |

## Development

```bash
npm run dev -- <args>   # tsx, no build
npm run build           # tsc → dist/
npm test                # vitest
```

## License

MIT.