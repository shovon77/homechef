#!/usr/bin/env bash
set -e
URL="${EXPO_PUBLIC_SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}"
mkdir -p app
: "${URL:=}"; : "${KEY:=}"
cat > app/env.ts <<EOTS
export const SUPABASE_URL = "${URL}";
export const SUPABASE_ANON_KEY = "${KEY}";
EOTS
[ -z "$URL" -o -z "$KEY" ] && echo "⚠️  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Tools → Secrets."
