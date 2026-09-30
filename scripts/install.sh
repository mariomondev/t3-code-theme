#!/bin/sh
# Development install: copy the desktop half into Hermes' desktop-plugins root.
# Hermes hot-reloads it. Do not combine with "hermes plugins install" of the
# same plugin: two folders would claim the same plugin id.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/t3-code-theme"
mkdir -p "$DEST"
cp "$ROOT/desktop/plugin.js" "$ROOT/LICENSE" "$ROOT/LICENSE-T3-Code" "$ROOT/LICENSE-Hermes" "$ROOT/LICENSE-LobeHub" "$ROOT/README.md" "$DEST/"
echo "Installed t3-code-theme -> $DEST"
