'use client';
import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Chef = { id:number; name?:string|null; photo?:string|null; location?:string|null; bio?:string|null };

export default function ChefDetail() {
  const { id } = useLocalSearchParams();
  const chefId = Number(String(id).replace(/\D+/g,''));
  const [chef, setChef] = useState<Chef|null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('chefs').select('*').eq('id', chefId).maybeSingle();
        if (error) throw error;
        setChef(data ?? { id: chefId, name: null });
      } catch (e:any) {
        setError(e.message || String(e));
      }
    })();
  }, [chefId]);

  if (error) return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text style={{color:'red'}}>Error: {error}</Text></View>;
  if (!chef)  return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text>Loading chef…</Text></View>;

  return (
    <ScrollView contentContainerStyle={{ alignItems:'center', padding:20 }}>
      <View style={{ width:'100%', maxWidth:960, backgroundColor:'#0f172a', borderRadius:16, padding:16 }}>
        <View style={{ flexDirection:'row', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <View style={{ width:160, height:160, borderRadius:12, overflow:'hidden', backgroundColor:'#111827', alignItems:'center', justifyContent:'center' }}>
            {chef.photo
              ? <Image source={{ uri: chef.photo }} style={{ width:'100%', height:'100%' }} />
              : <Text style={{ color:'#9ca3af' }}>No photo</Text>
            }
          </View>
          <View style={{ gap:6, flex:1, minWidth:220 }}>
            <Text style={{ fontSize:24, fontWeight:'900', color:'#f8fafc' }}>{chef.name || `Chef #${chefId}`}</Text>
            {chef.location ? <Text style={{ color:'#cbd5e1' }}>{chef.location}</Text> : null}
            <Text style={{ color:'#e2e8f0' }}>{chef.bio || 'Local home chef.'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
