const fs = require('fs');
const p = 'app/chef/_layout.tsx';
if (!fs.existsSync(p)) { console.error('❌ File not found:', p); process.exit(0); }
let s = fs.readFileSync(p, 'utf8');

// Ensure supabase import exists (in case it was using getSupabase before)
if (!/from ['"]\.\.\/\.\.\/lib\/supabase['"]/.test(s)) {
  s = `import { supabase } from '../../lib/supabase';\n` + s;
}

// Optionally bring in usePathname (future use), but we won't rely on it now
if (!/usePathname/.test(s) && /expo-router/.test(s)) {
  s = s.replace(/from 'expo-router';/, "from 'expo-router';");
}

// Replace any hard redirects to /auth inside effects/guards
// Strategy: comment them out and keep session optional
s = s
  // Replace strict getSession usage with a try/catch optional fetch
  .replace(/const\s*\{\s*data\s*\}\s*=\s*await\s*supabase\.auth\.getSession\(\);?/g,
           "let data = {}; try { ({ data } = await supabase.auth.getSession()); } catch {}")
  // Neutralize router.replace('/auth') or router.push('/auth')
  .replace(/router\.(replace|push)\(['"]\/auth['"]\);?/g, '// (public profile) auth not required for /chef/[id]');

fs.writeFileSync(p, s);
console.log('✅ Updated app/chef/_layout.tsx: Chef profiles are public; auth redirects removed.');
