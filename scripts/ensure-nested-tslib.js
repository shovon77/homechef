/**
 * Metro static/web bundles resolve bare `tslib` from paths like
 * `node_modules/@supabase/functions-js/dist/module/*.js` and only walk
 * that package's local `node_modules`. Hoisted `tslib` at the repo root
 * is not always found; symlink it into each `@supabase/*` package.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tslibRoot = path.join(root, 'node_modules', 'tslib');
const supabaseDir = path.join(root, 'node_modules', '@supabase');

if (!fs.existsSync(tslibRoot) || !fs.existsSync(supabaseDir)) {
  process.exit(0);
}

for (const name of fs.readdirSync(supabaseDir, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const nestedTslib = path.join(supabaseDir, name.name, 'node_modules', 'tslib');
  if (fs.existsSync(nestedTslib)) continue;
  fs.mkdirSync(path.dirname(nestedTslib), { recursive: true });
  const rel = path.relative(path.dirname(nestedTslib), tslibRoot);
  fs.symlinkSync(rel, nestedTslib, 'dir');
}
