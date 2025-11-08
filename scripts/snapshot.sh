#!/usr/bin/env bash
set -euo pipefail
ts="$(date +%Y%m%d_%H%M%S)"
dest=".snapshots/snap_$ts"
mkdir -p "$dest"
echo "📸  Creating snapshot at $dest"

copy_dir () {
  local src="$1"
  if [ -d "$src" ]; then
    echo "• copying $src ..."
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --exclude='.expo' --exclude='.cache' --exclude='node_modules' "$src"/ "$dest/$src"/
    else
      mkdir -p "$dest/$src"
      cp -R "$src"/ "$dest/$src"/
    fi
  else
    echo "⚠️  Skipping missing folder: $src"
  fi
}

copy_dir app
copy_dir components

echo "✅  Snapshot complete. Contents:"
ls -la "$dest"
