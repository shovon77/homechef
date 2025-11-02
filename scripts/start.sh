#!/usr/bin/env bash
set -e
export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
echo "node: $(command -v node || echo missing)  npm: $(command -v npm || echo missing)  npx: $(command -v npx || echo missing)"

# write app/env.ts from Replit Secrets so Expo Web always sees your keys
URL="${EXPO_PUBLIC_SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}"
mkdir -p app
: "${URL:=}"; : "${KEY:=}"
cat > app/env.ts <<EOTS
export const SUPABASE_URL = "${URL}";
export const SUPABASE_ANON_KEY = "${KEY}";
EOTS
[ -z "$URL" -o -z "$KEY" ] && echo "⚠️  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Tools → Secrets."

# clean caches, install, start
rm -rf .expo .cache node_modules/.cache 2>/dev/null || true
npm install --no-audit --no-fund
npx expo start --web --port 3000
