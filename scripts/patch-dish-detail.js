const fs = require('fs');
const path = 'app/dishes/[id].tsx';
if (!fs.existsSync(path)) {
  console.error('❌ File not found:', path);
  process.exit(1);
}
let s = fs.readFileSync(path, 'utf8');

// add missing React hooks
if (/from 'react';/.test(s) && !/useEffect|useState/.test(s)) {
  s = s.replace(/import\s*\{\s*([^}]*)\}\s*from\s*'react';/,
                (m, g1) => `import { ${g1.replace(/\s+/g,' ').trim()}, useEffect, useState } from 'react';`);
}
if (/from 'react-native';/.test(s) && !/Image|ScrollView/.test(s)) {
  s = s.replace(/import\s*\{\s*([^}]*)\}\s*from\s*'react-native';/,
                (m, g1) => `import { ${g1.replace(/\s+/g,' ').trim()}, Image, ScrollView } from 'react-native';`);
}

// ensure we have a dishId variable — keep existing logic
if (!/const\s+dishId\b/.test(s) && /useLocalSearchParams/.test(s)) {
  // try to derive dishId if ID exists
  s = s.replace(/const\s*\{\s*id\s*\}\s*=\s*useLocalSearchParams\(\);\s*/,
    "$&\n  const dishId = normalizeId(id as string);\n");
}

// inject state + effect after dishId declaration if not present
if (!/useEffect\s*\(/.test(s)) {
  s = s.replace(/const\s+dishId[^\n]*;\s*/, (m) => {
    return m + `
  type Dish = { id:number; name:string; description:string; price:number; image_url?:string; };
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
}

// replace the simple "ID:" UI with a richer view (only if that placeholder exists)
if (/ID:\s*\{dishId\}/.test(s)) {
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

// write back
fs.writeFileSync(path, s);
console.log('✅ Patched dish detail to fetch from Supabase and render full details.');
