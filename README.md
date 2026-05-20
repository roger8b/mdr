# mdr - Markdown Renderer

Render markdown files in Chrome with live reload.

## Features

- **Live Reload**: Changes to markdown files are reflected instantly in the browser
- **Elegant Typography**: Beautiful rendering with Playfair Display and Inter fonts
- **Mermaid Diagrams**: Automatic rendering of mermaid code blocks with pan/zoom
- **Portable**: Single CLI command, opens in Chrome
- **Multi-doc Support**: Serve multiple files, each in its own tab
- **Smart Port Selection**: Automatically finds an available port (avoids common ports)
- **Server Persistence**: Multiple CLI invocations share the same server

## Installation

### Local Development

```bash
bash install.sh --local
```

### From Git

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/roger8b/markdown-render/main/install.sh)"
```

## Usage

```bash
mdr <file.md>          # Open single file
mdr <file1.md> <file2.md>  # Open multiple files
mdr --help            # Show help
```

## How It Works

1. Checks if there's already a server running (via lock file in `~/.mdr/`)
2. If yes: requests existing server to open the new file
3. If no: starts a new server on an available port (4000-9000 range)
4. Opens the file in Chrome at `http://localhost:<port>/<doc-id>`
5. Watches the file for changes using `fs.watch`
6. When the file changes, re-renders and pushes update via Server-Sent Events (SSE)
7. The browser receives the update and refreshes the content

## Server Persistence

The first `mdr` invocation starts the server. Subsequent invocations:
- Detect the running server via lock file (`~/.mdr/server.lock`)
- Request the server to open the new file in a new Chrome tab
- The original server stays alive until Ctrl+C

## Requirements

- Node.js >= 20
- Google Chrome installed

## License

MIT