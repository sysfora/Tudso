#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/Tudso.app"

if [[ ! -d "$SRC" ]]; then
  osascript -e 'display dialog "Open Install Tudso from the Tudso disk image, next to the Tudso icon." buttons {"OK"} default button 1 with title "Tudso"'
  exit 1
fi

xattr -cr "$SRC" || true

DEST="/Applications/Tudso.app"
if [[ ! -w /Applications ]]; then
  mkdir -p "$HOME/Applications"
  DEST="$HOME/Applications/Tudso.app"
fi

rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -cr "$DEST" || true
open "$DEST"
