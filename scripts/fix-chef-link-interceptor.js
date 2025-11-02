const fs = require('fs');
const p = 'app/_layout.tsx';
if (!fs.existsSync(p)) { console.error('❌ app/_layout.tsx not found'); process.exit(1); }
let s = fs.readFileSync(p,'utf8');

function ensureImport(src, names){
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${src}['"];?`);
  if (re.test(s)) {
    s = s.replace(re, (m,g1)=>{
      const set=new Set(g1.split(',').map(x=>x.trim()).filter(Boolean));
      names.forEach(n=>set.add(n));
      return `import { ${Array.from(set).join(', ')} } from '${src}';`;
    });
  } else {
    s = `import { ${names.join(', ')} } from '${src}';\n` + s;
  }
}

// Ensure needed imports
ensureImport('react', ['useEffect']);
ensureImport('react-native', ['Platform']);
if (!/from ['"]expo-router['"]/.test(s)) s = `import { useRouter } from 'expo-router';\n` + s;
else if (!/useRouter/.test(s)) s = s.replace(/from 'expo-router';/, "from 'expo-router';");
if (!/from ['"]\.\.\/lib\/supabase['"]/.test(s) && !/from ['"]\.\.\/\.\.\/lib\/supabase['"]/.test(s)) {
  // _layout.tsx usually sits in app/, so ../lib/supabase
  s = `import { supabase } from '../lib/supabase';\n` + s;
}

// Inject a hook inside the root component to intercept chef links
if (!/interceptChefLinks/.test(s)) {
  s = s.replace(/export default function [^(]+\([^)]*\)\s*\{/,
`$&
  const router = typeof useRouter === 'function' ? useRouter() : undefined;

  // Web-only: intercept links like /chef/s_0 and redirect to /chef/<numericId>
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    async function resolveAndNav(idx) {
      const { data, error } = await supabase
        .from('chefs')
        .select('id')
        .order('id',{ ascending:true })
        .range(idx, idx);
      const realId = data?.[0]?.id;
      if (realId) router?.replace('/chef/' + realId);
    }
    function onClick(e) {
      const a = (e.target as HTMLElement)?.closest?.('a');
      if (!a) return;
      const href = (a.getAttribute('href')||'');
      // only intercept chef links in the s_<n> format
      const m = href.match(/^\\/chef\\/s_(\\d+)$/);
      if (m) {
        e.preventDefault();
        const idx = Number(m[1]);
        if (Number.isFinite(idx)) resolveAndNav(idx);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
`);
}

fs.writeFileSync(p,s);
console.log('✅ Added web-only interceptor for /chef/s_<n> links in app/_layout.tsx.');
