const fs = require('fs');
const p  = 'app/chef/_layout.tsx';
if (!fs.existsSync(p)) { console.error('❌ File not found:', p); process.exit(1); }
let s = fs.readFileSync(p, 'utf8');

// Ensure supabase import exists (relative from app/chef/_layout.tsx)
if (!/from ['"]\.\.\/\.\.\/lib\/supabase['"]/.test(s)) {
  s = `import { supabase } from '../../lib/supabase';\n` + s;
}

// Replace any getSupabase().auth.* → supabase.auth.*
s = s.replace(/getSupabase\(\)\.auth\./g, 'supabase.auth.');

// Replace any getSupabase().from(…) → supabase.from(…)
s = s.replace(/getSupabase\(\)\.from\(/g, 'supabase.from(');

// Optional: if code destructures like "const { data } = await getSupabase().auth.getSession();"
// the above covers it. If there are other variants (e.g., getSupabase()?.auth), handle them too:
s = s.replace(/getSupabase\(\)\?\.\s*auth\./g, 'supabase.auth.');

fs.writeFileSync(p, s);
console.log('✅ Patched app/chef/_layout.tsx to use supabase client directly.');
