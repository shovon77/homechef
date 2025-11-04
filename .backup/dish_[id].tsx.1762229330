'use client';
import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Dish = { id:number; name?:string|null; title?:string|null; description?:string|null; price?:number|null; image?:string|null; image_url?:string|null; thumbnail?:string|null; rating?:number|null; };

export default function DishDetail() {
  const { id } = useLocalSearchParams();
  const dishId = Number(String(id).replace(/\D+/g,''));
  const [dish, setDish] = useState<Dish|null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('dishes').select('*').eq('id', dishId).maybeSingle();
        if (error) throw error;
        setDish(data ?? { id: dishId });
      } catch (e:any) { setError(e.message || String(e)); }
    })();
  }, [dishId]);

  if (error) return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text style={{color:'red'}}>Error: {error}</Text></View>;
  if (!dish)  return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text>Loading dish…</Text></View>;

  const title = (dish.name ?? dish.title ?? `Dish #${dishId}`);
  const img   = (dish.image_url ?? dish.image ?? dish.thumbnail) || '';

  return (
    <ScrollView contentContainerStyle={{ alignItems:'center', padding:20 }}>
      <View style={{ width:'100%', maxWidth:960, backgroundColor:'#0f172a', borderRadius:16, padding:16 }}>
        <View style={{ flexDirection:'row', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <View style={{ width:360, height:240, borderRadius:12, overflow:'hidden', backgroundColor:'#111827', alignItems:'center', justifyContent:'center' }}>
            {img ? <Image source={{ uri: img }} style={{ width:'100%', height:'100%' }} /> : <Text style={{ color:'#9ca3af' }}>No image</Text>}
          </View>
          <View style={{ gap:8, flex:1, minWidth:220 }}>
            <Text style={{ fontSize:24, fontWeight:'900', color:'#f8fafc' }}>{title}</Text>
            {dish.price != null ? <Text style={{ fontSize:18, fontWeight:'700', color:'#fbbf24' }}>$ {Number(dish.price).toFixed(2)}</Text> : null}
            <Text style={{ color:'#e2e8f0' }}>{dish.description || 'Delicious home-cooked meal.'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
