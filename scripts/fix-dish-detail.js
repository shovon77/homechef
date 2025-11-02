const fs = require('fs');
const path = 'app/dishes/[id].tsx';
if (!fs.existsSync(path)) { console.error('❌ File not found:', path); process.exit(1); }
let s = fs.readFileSync(path, 'utf8');
const ensureImport = (source, items, insertAfterRegex) => {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${source}['"];?`);
  if (re.test(s)) {
    s = s.replace(re, (m, g1) => {
      const have = new Set(g1.split(',').map(x => x.trim()).filter(Boolean));
      items.forEach(i => have.add(i));
      return `import { ${Array.from(have).join(', ')} } from '${source}';`;
    });
  } else {
    const line = `import { ${items.join(', ')} } from '${source}';\n`;
    if (insertAfterRegex && insertAfterRegex.test(s)) {
      s = s.replace(insertAfterRegex, (m) => m + line);
    } else {
      s = line + s;
    }
  }
};
// 1) React hooks
ensureImport('react', ['useState','useEffect']);
// 2) RN widgets
ensureImport('react-native', ['View','Text','Image','ScrollView']);
// 3) expo-router param hook
if (!/useLocalSearchParams/.test(s)) {
  s = `import { useLocalSearchParams } from 'expo-router';\n` + s;
}
// 4) ids helper
if (!/from ['"]\.\.\/\.\.\/lib\/ids['"]/.test(s)) {
  s = `import { normalizeId } from '../../lib/ids';\n` + s;
}
// 5) supabase client
if (!/from ['"]\.\.\/\.\.\/lib\/supabase['"]/.test(s)) {
  s = `import { supabase } from '../../lib/supabase';\n` + s;
}
// 6) ensure dishId exists
if (/useLocalSearchParams\(\);/.test(s) && !/const\s+dishId\b/.test(s)) {
  s = s.replace(/const\s*\{\s*id\s*\}\s*=\s*useLocalSearchParams\(\);\s*/,
                "$&\n  const dishId = normalizeId(id as string);\n");
}
// 7) inject fetch + UI if still showing only ID
if (/ID:\s*\{dishId\}/.test(s) && !/setDish\(/.test(s)) {
  s = s.replace(/const\s+dishId[^\n]*;\s*/, (m) => {
    return m + `
  type Dish = { id:number; name:string; description:string; price:number; image_url?:string };
  const [dish, setDish] = useState<Dish|null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('dishes')
          .select('*')
          .eq('id', Number(dishId))
          .single();
        if (error) throw error;
        setDish(data);
      } catch (e:any) {
        setError(e.message || String(e));
      }
    })();
  }, [dishId]);
`;
  });
  s = s.replace(/return\s*\(\s*<View[^]*?ID:[^]*?<\/View>\s*\);\s*/s, `
  if (error) {
    return (
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
        <Text style={{color:'red'}}>Error: {error}</Text>
      </View>
    );
  }
  if (!dish) {
    return (
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
        <Text>Loading dish...</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{alignItems:'center',padding:20}}>
      {dish.image_url ? (
        <Image source={{ uri: dish.image_url }} style={{ width:300, height:200, borderRadius:12, marginBottom:16 }} />
      ) : null}
      <Text style={{fontSize:24,fontWeight:'bold',marginBottom:8}}>{dish.name}</Text>
      <Text style={{fontSize:16,opacity:0.8,marginBottom:8}}>{dish.description}</Text>
      <Text style={{fontSize:18,fontWeight:'600'}}>Price: $ {Number(dish.price).toFixed(2)}</Text>
    </ScrollView>
  );
`);
}
fs.writeFileSync(path, s);
console.log('✅ Imports fixed and dish detail patched (non-destructive).');
