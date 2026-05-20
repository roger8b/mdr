# Claude Code — mdr

Working on the `mdr` source tree. The canonical rules are in [`AGENTS.md`](AGENTS.md); this file adds Claude-Code-specific guidance.

## Read first

- [`AGENTS.md`](AGENTS.md) — structure, conventions, paths, hard rules.
- [`README.md`](README.md) — user-facing CLI surface (commands, flags, exit codes).

## Claude-specific

### When uncertain, run `mdr status`

Before changing server or lock file code, run `mdr status` on the installed copy. It confirms the server is running, the lock file is valid, and the port is reachable.

### Use the dev script, not the built bin, while iterating

```bash
npm run dev -- <args>            # tsx, no build step
```

Only rebuild (`npm run build`) before committing or before re-running `mdr ...` against the installed bin.

### Tests are cheap — run them before every commit

```bash
npm test
```

### When asked to add a new command

1. Add the command handler in `src/commands/<name>.js`
2. Export `run<Name>` function
3. Import and wire in `src/index.ts`
4. Add test cases in `tests/`

### Skill templates

`templates/skills/mdr-*/SKILL.md` are copied verbatim into projects by `mdr init`. Treat them as user-facing docs. The frontmatter `description` controls when an LLM picks the skill — keep it specific.

### Do NOT

- Add `console.log` for diagnostics — use `process.stderr.write` with the `[mdr]` prefix, or `pc.<color>` via `console.error`.
- Touch lock file directly — let the CLI manage `~/.mdr/server.lock`.
- Call `process.exit` from command handlers — return the exit code.

### Memory paths

User data lives under `~/.mdr/`. Treat anything in there as user state — never delete unless `mdr stop` or `mdr purge` is explicitly invoked.