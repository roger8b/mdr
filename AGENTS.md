# Agent guide — mdr

This file is the canonical instruction set for any AI coding agent (Codex, Claude Code, Gemini CLI, Cursor, etc.) working on the `mdr` source tree. `CLAUDE.md` re-exports this file with Claude-Code-specific overrides.

## What this project is

`mdr` is a TypeScript ESM CLI that serves markdown files in Chrome with live reload. It provides a daemon-based server architecture for rendering markdown documents with real-time preview updates.

```
src/
├── commands/        # one file per subcommand (start, stop, status, list, open, close, purge, init)
├── utils/          # agents registry, templates-dir
├── index.ts         # Commander root + dispatcher
├── server.ts        # HTTP server with document management
templates/skills/    # mdr-* skills copied by `mdr init`
tests/               # vitest
```

## Conventions

### Language / module system

- TypeScript `strict: true`, `target: ES2022`, `module: NodeNext`.
- All relative imports end in `.js` (ESM): `import { x } from "./foo.js"`.
- Node built-ins use the `node:` prefix: `import path from "node:path"`.
- Named exports only. No default exports in `src/`.

### Imports order

1. Node built-ins
2. Third-party (`commander`, `picocolors`, `open`, `marked`, `@inquirer/prompts`, `fs-extra`)
3. `../commands/…`, `../utils/…`
4. Local relative

### Command handlers

- Live in `src/commands/<name>.js` and export a single `run<Name>(opts) => Promise<number>`.
- Return the exit code; never call `process.exit` directly.
- Use `picocolors` (`pc.red`, `pc.green`, `pc.yellow`, `pc.dim`, `pc.cyan`) for stderr.
- Log user-facing diagnostics to **stderr**. Reserve **stdout** for any structured output.

### CLI flags

- Every flag is defined in `src/index.ts` via Commander.
- Adding a flag: update Commander options + the corresponding handler.

### Paths

- User data lives under `~/.mdr/`: `server.lock`. Never assume the install dir is writable for user data.
- Always resolve user-provided paths absolutely.

### Error handling

- Throw `Error` with a clear message in pure utilities; commands catch and translate to exit codes.
- Never swallow errors silently.

## Tests

- **Vitest** in `tests/`, file pattern `<topic>.test.ts`.
- Use `mkdtempSync(path.join(os.tmpdir(), 'mdr-…-'))` for any test that touches the filesystem; clean up with `fs.rmSync(dir, { recursive: true, force: true })` in `afterEach`.
- A new flag requires a corresponding test case.

## Build / release

- `npm run build` → `dist/` (tsc).
- `npm install` triggers `prepare` which runs `build`.
- `npm test` runs vitest once.

## Commits / PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`. Scope optional.
- Always co-author trailer when AI-assisted: `Co-Authored-By: Claude … <noreply@anthropic.com>`.
- Branches: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- Never commit `dist/`, `node_modules/`, `coverage/`.

## Hard rules

- Never read or write files under `~/.mdr/server.lock` directly — let the CLI manage it.
- Never call `process.exit` from inside a command handler — return the code.
- Never colorize stdout. Stdout is for machine output only.

## Useful commands while developing

```bash
npm run dev -- --help                     # tsx-driven help, no rebuild
npm run dev -- start
npm test
mdr status                                # against the installed copy
```
<!-- mdr-start -->
# mdr — Markdown Document Renderer

The user has `mdr` installed — a CLI that serves markdown files in Chrome with live reload. Use `mdr` when the user wants to render markdown in the browser, preview HTML, or open styled documents.

**Skills:**
- Local: `.pi/skills/mdr-*/SKILL.md`
- Global: `/Users/roger.silva/.pi/agent/skills/mdr-*/SKILL.md`

| To … | Use … |
|------|-------|
| Start the server | `mdr start` |
| Open a document | `mdr open <file>` |
| List open documents | `mdr list` |
| Stop the server | `mdr stop` |
| Close a document | `mdr close <id>` |
| Check status | `mdr status` |
| Close all docs | `mdr purge` |
| Full options | `mdr --help` |

## Hard rules

- Server must be started before opening documents with `mdr start`.
- Document IDs are derived from file path (base64url encoding).
- Lock file lives at `~/.mdr/server.lock` — do not edit manually.
- Server runs in daemon mode; PID is tracked for clean shutdown.
<!-- mdr-end -->
