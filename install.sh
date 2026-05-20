#!/usr/bin/env bash
set -euo pipefail

# mdr (markdown-render) installer
# Usage: bash install.sh [--local [src]]

REPO_URL="https://github.com/roger8b/markdown-render"
INSTALL_DIR="${HOME}/.mdr"
USE_LOCAL=false
LOCAL_SOURCE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      USE_LOCAL=true
      if [[ $# -gt 1 && "${2:0:2}" != "--" ]]; then
        LOCAL_SOURCE="$2"; shift 2
      else
        if [[ -f "$PWD/package.json" ]]; then
          LOCAL_SOURCE="$PWD"
        fi
        shift
      fi ;;
    --help|-h)
      cat <<EOF
Usage: $0 [--local [src]]

  --local [src]   Use local checkout instead of cloning. If 'src' given,
                  syncs from that path into ~/.mdr/
EOF
      exit 0 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }
dim()  { echo -e "${DIM}  $*${NC}"; }

echo ""
echo "  mdr installer"
echo ""

# prerequisites
command -v node >/dev/null 2>&1 || err "Node.js not found. Install from https://nodejs.org (>=20 required)."
command -v npm  >/dev/null 2>&1 || err "npm not found. Install from https://nodejs.org."

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ $NODE_MAJOR -lt 20 ]]; then
  err "Node.js >=20 required (found $NODE_MAJOR)."
fi
ok "Node.js $(node --version)"

# install / sync
if $USE_LOCAL; then
  if [[ -n "$LOCAL_SOURCE" ]]; then
    [[ -d "$LOCAL_SOURCE" ]] || err "local source not found: $LOCAL_SOURCE"
    [[ -f "$LOCAL_SOURCE/package.json" ]] || err "no package.json at $LOCAL_SOURCE"
    dim "syncing $LOCAL_SOURCE → $INSTALL_DIR …"
    mkdir -p "$INSTALL_DIR"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete --exclude node_modules --exclude dist --exclude .git "$LOCAL_SOURCE/" "$INSTALL_DIR/"
    else
      (cd "$LOCAL_SOURCE" && tar --exclude=node_modules --exclude=dist --exclude=.git -cf - .) | (cd "$INSTALL_DIR" && tar -xf -)
    fi
  else
    [[ -d "$INSTALL_DIR" ]] || err "no local install at $INSTALL_DIR. Run with --local <src> first."
    dim "using existing $INSTALL_DIR"
  fi
elif [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "existing install at $INSTALL_DIR — pulling latest"
  git -C "$INSTALL_DIR" pull --quiet || warn "git pull failed — continuing"
elif [[ -d "$INSTALL_DIR" ]]; then
  warn "$INSTALL_DIR exists but not a git checkout — leaving as-is"
else
  dim "cloning to $INSTALL_DIR …"
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
dim "installing dependencies …"
npm install --silent
dim "building …"
npm run build --silent
if ! npm link 2>&1 | tail -5; then
  warn "npm link failed — try: sudo npm link  (or check 'npm config get prefix' is in PATH)"
fi

# Fix executable permissions on dist files
chmod +x "$INSTALL_DIR/dist"/*.js 2>/dev/null || true

# Verify mdr is on PATH
if ! command -v mdr >/dev/null 2>&1; then
  NPM_PREFIX="$(npm config get prefix 2>/dev/null || echo '')"
  warn "mdr not on PATH"
  dim "npm bin dir: ${NPM_PREFIX}/bin"
  dim "add to your shell rc:  export PATH=\"${NPM_PREFIX}/bin:\$PATH\""
fi

ok "mdr installed ($(mdr --version 2>/dev/null || echo 'ok'))"

echo ""
echo -e "${GREEN}All done.${NC}"
echo ""
echo "  Try:"
echo "    mdr README.md"
echo "    mdr --help"
echo ""