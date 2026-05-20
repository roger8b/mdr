# mdr — Markdown Document Renderer

<!-- BADGES -->

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<!-- ENGLISH -->

## Overview

`mdr` (Markdown Document Renderer) is a CLI tool that serves markdown files in Chrome with live reload. It provides a daemon-based server architecture for rendering markdown documents with real-time preview updates.

### Key Features

- **Daemon Mode**: Server runs in background with PID tracking
- **Live Reload**: Automatic refresh when files change
- **Document Management**: Open, close, list documents via CLI
- **Lock File**: `~/.mdr/server.lock` stores port and PID for single instance
- **Agent Integration**: Skills and rule files for AI coding agents

---

## Installation

```bash
git clone https://github.com/roger8b/mdr ~/wiki/html-template-generator
cd ~/wiki/html-template-generator
npm install
npm run build
npm link
```

**Or use the installer:**

```bash
./install.sh
```

---

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

---

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

### `mdr init` — Wire a project for AI agents

Interactive (or `--yes`) project wiring. Detects installed AI agents, installs `mdr-*` skills, and injects marker-delimited rules into agent rule files.

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

---

## Architecture

```
~/.mdr/                     User data root
└── server.lock             PID and port tracking

$TMPDIR/mdr/                Server logs (if configured)
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

---

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

### Clean Server Management

```bash
# Check what's running
mdr status

# Close all docs, keep server
mdr purge

# Full stop
mdr stop
```

---

## Environment & Paths

| What | Where | Notes |
|------|-------|-------|
| Lock file | `~/.mdr/server.lock` | Do not edit manually |
| Server port | Dynamic (stored in lock) | Health check at `/health` |
| Document IDs | base64url(file path) | Consistent across sessions |

---

## Development

```bash
npm run dev -- <args>   # tsx, no build
npm run build           # tsc → dist/
npm test                # vitest
```

---

<!-- PORTUGUESE -->

---

# mdr — Markdown Document Renderer

## Visão Geral

`mdr` (Markdown Document Renderer) é uma ferramenta CLI que serve arquivos markdown no Chrome com recarregamento ao vivo. Ele fornece uma arquitetura de servidor daemon para renderização de documentos markdown com atualizações em tempo real.

### Recursos Principais

- **Modo Daemon**: Servidor executa em background com rastreamento de PID
- **Live Reload**: Atualização automática quando arquivos mudam
- **Gerenciamento de Documentos**: Abra, feche, liste documentos via CLI
- **Lock File**: `~/.mdr/server.lock` armazena porta e PID para instância única
- **Integração com Agentes**: Skills e arquivos de regras para agentes de IA

---

## Instalação

```bash
git clone https://github.com/roger8b/mdr ~/wiki/html-template-generator
cd ~/wiki/html-template-generator
npm install
npm run build
npm link
```

**Ou use o instalador:**

```bash
./install.sh
```

---

## Início Rápido

```bash
# 1. Inicie o servidor
mdr start

# 2. Abra um arquivo markdown no Chrome
mdr open document.md

# 3. Liste documentos abertos
mdr list

# 4. Verifique o status do servidor
mdr status

# 5. Pare o servidor
mdr stop
```

---

## Comandos

### `mdr start`

Inicie o servidor mdr em background.

```bash
mdr start
```

**Saída:**
```
Starting server...
✓ Server started on port <port>
  PID: <pid>
  mdr open <file> to open a document
```

### `mdr stop`

Pare o servidor mdr graciosamente.

```bash
mdr stop
```

**Saída:**
```
Stopping server (PID: <pid>)...
✓ Server stopped
```

### `mdr status`

Verifique se o servidor mdr está em execução.

```bash
mdr status
```

**Saída:**
```
✓ Server is running
  Port: <port>
  PID:  <pid>
  Docs: <n> open
    - <document-title>
```

### `mdr list`

Liste todos os documentos abertos.

```bash
mdr list
```

**Saída:**
```
<count> document(s):
  1. <document-title>
     ID: <document-id>
     <file-path>
```

### `mdr open <file>`

Abra um arquivo markdown no Chrome.

```bash
mdr open document.md
mdr open path/to/file.md
mdr open README.md
```

**Saída:**
```
✓ Opening <file-name>
  <url>
```

**Casos de erro:**
- Arquivo não encontrado: `✗ Failed to open document: File not found: <path>`
- Servidor não está rodando: Inicia o servidor automaticamente primeiro

### `mdr close <id>`

Feche um documento pelo seu ID.

```bash
mdr close <document-id>
```

**Saída:**
```
✓ Closed document <document-id>
```

### `mdr purge`

Feche todos os documentos, mantenha o servidor rodando.

```bash
mdr purge
```

**Saída:**
```
✓ All documents closed, server purged
```

### `mdr init` — Conectar um projeto para agentes de IA

Conexão interativa (ou `--yes`) de projeto. Detecta agentes de IA instalados, instala skills `mdr-*`, e injeta regras delimitadas por marcadores nos arquivos de regras dos agentes.

| Flag | Padrão | Propósito |
|------|--------|----------|
| `-y, --yes` | pergunta | Não-interativo: use padrões |
| `--scope <local\|global\|both>` | pergunta | `local` = dirs do projeto; `global` = dir home de cada agente; `both` |
| `--method <symlink\|copy>` | pergunta (symlink) | `symlink` atualiza skills automaticamente; `copy` é snapshot estático |
| `--update` | – | Re-sincroniza skills existentes sem perguntar |
| `--show-all` | – | Lista todos os agentes suportados, não apenas os detectados |
| `--force` | – | Sobrescreve mesmo se já existir seção mdr |

```bash
mdr init                              # interativo
mdr init -y                           # não-interativo, padrões sensatos
mdr init --scope both --method copy   # explícito, ainda seleciona agentes interativamente
mdr init -y --scope global            # skills globais para agentes detectados
```

**Saída:**
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

---

## Arquitetura

```
~/.mdr/                     Raiz de dados do usuário
└── server.lock             Rastreamento de PID e porta

$TMPDIR/mdr/                Logs do servidor (se configurado)
```

### Componentes

| Componente | Descrição |
|------------|-----------|
| **Servidor Daemon** | Servidor HTTP em background com gerenciamento de documentos |
| **Lock File** | `~/.mdr/server.lock` armazena { port, pid } para instância única |
| **ID do Documento** | Codificação base64url do caminho absoluto do arquivo |
| **Endpoint de Health** | `http://127.0.0.1:<port>/health` para verificações de status |
| **Agent Skills** | Templates de skill `mdr-*` para integração com agentes de IA |

### Fluxo

1. `mdr start` → gera processo filho detached → escreve `~/.mdr/server.lock`
2. `mdr open <file>` → verifica lock → fetches `/open?path=<path>&id=<id>`
3. `mdr stop` → lê lock → envia SIGTERM → remove arquivo de lock

---

## Casos de Uso

### Visualização ao Vivo para Documentação

```bash
# Inicie o servidor e abra seus docs
mdr start && mdr open docs/index.md

# Edite no seu editor — o navegador atualiza automaticamente
```

### Comparação de Múltiplos Documentos

```bash
mdr open spec-v1.md
mdr open spec-v2.md
mdr list  # compare lado a lado
```

### Integração com Agentes de IA

Conecte seu projeto para que agentes de IA saibam sobre `mdr`:

```bash
cd ~/code/my-project
mdr init -y
```

Isso instala skills em:
- `.claude/skills/` (Claude Code)
- `.pi/skills/` (Pi)
- `.cursor/rules/mdr.mdc` (Cursor)
- E outros agentes detectados

A seção de regras diz aos agentes para usar `mdr` para preview de markdown e renderização no navegador.

### Gerenciamento Limpo do Servidor

```bash
# Verifique o que está rodando
mdr status

# Feche todos os docs, mantenha o servidor
mdr purge

# Parada completa
mdr stop
```

---

## Ambiente e Caminhos

| O quê | Onde | Notas |
|-------|------|-------|
| Lock file | `~/.mdr/server.lock` | Não edite manualmente |
| Porta do servidor | Dinâmica (armazenada no lock) | Health check em `/health` |
| IDs de documento | base64url(caminho do arquivo) | Consistente entre sessões |

---

## Desenvolvimento

```bash
npm run dev -- <args>   # tsx, sem build
npm run build           # tsc → dist/
npm test                # vitest
```

---

## License

MIT.