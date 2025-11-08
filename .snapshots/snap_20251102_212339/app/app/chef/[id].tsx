'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/formatPhone';
import Rating from '../../components/Rating';
import { Tabs } from '../../components/Tabs';

type Chef = {
  id: number;
  name?: string | null;
  location?: string | null;
  phone?: string | null;
  bio?: string | null;
  description?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  photo?: string | null;
  reels_json?: string | null;
  reels?: string | null;
  avg_rating?: number | null;
};
type Dish = { id:number; name?:string|null; price?:number|null; image?:string|null; image_url?:string|null; thumbnail?:string|null; };
type Review = { id:number; rating:number; comment?:string|null; user_name?:string|null; created_at?:string|null; };

export default function ChefDetail() {
  const { id } = useLocalSearchParams();
  const rawId = String(Array.isArray(id) ? id[0] : id || '');
  const numberFromRaw = (() => { const m = rawId.match(/(\d+)/); return m ? Number(m[1]) : NaN; })();

  const [resolvedId, setResolvedId] = useState<number | null>(null);
  const [chef, setChef] = useState<Chef | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const commentRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null); setChef(null); setResolvedId(null);
        const numeric = Number(rawId.replace(/\D+/g,''));
        if (Number.isFinite(numeric) && numeric > 0) {
          setResolvedId(numeric);
          return;
        }
        if (Number.isFinite(numberFromRaw)) {
          const N = numberFromRaw;
          const { data, error } = await supabase
            .from('chefs')
            .select('id')
            .order('id', { ascending: true })
            .range(N, N);
          if (error) throw error;
          const real = data?.[0]?.id;
          if (real) { setResolvedId(real); return; }
        }
        setError('Chef not found');
      } catch (e:any) { setError(e.message || String(e)); }
    })();
  }, [rawId]);

  useEffect(() => {
    if (!resolvedId) return;
    (async () => {
      try {
        const [{ data: chefRow, error: ce }, { data: dishRows }, { data: revRows }] = await Promise.all([
          supabase.from('chefs').select('*').eq('id', resolvedId).maybeSingle(),
          supabase.from('dishes').select('id,name,price,image,image_url,thumbnail,chef_id').eq('chef_id', resolvedId).order('id', { ascending: true }).limit(200),
          supabase.from('chef_reviews').select('id,rating,comment,user_name,created_at').eq('chef_id', resolvedId).order('created_at', { ascending: false }).limit(100),
        ]);
        if (ce) throw ce;
        setChef(chefRow ?? { id: resolvedId });
        setDishes((dishRows as any[]) || []);
        setReviews((revRows as any[]) || []);
      } catch (e:any) { setError(e.message || String(e)); }
    })();
  }, [resolvedId]);

  const title = chef?.name || (resolvedId ? ('Chef #' + resolvedId) : 'Chef');
  const desc = chef?.bio ?? chef?.description ?? 'Local home chef.';
  const avatar = chef?.photo || '';
  const avg = Number(chef?.avg_rating ?? 0);

  const reelUrls = useMemo(() => {
    try {
      if (chef?.reels_json) {
        const v = JSON.parse(String(chef.reels_json));
        if (Array.isArray(v)) return v.filter(Boolean).slice(0,6);
      }
    } catch {}
    return String(chef?.reels || '')
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean)
      .slice(0,6);
  }, [chef?.reels_json, chef?.reels]);

  if (error) return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text style={{color:'red'}}>Error: {error}</Text></View>;
  if (!resolvedId || !chef) return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}><Text>Loading chef…</Text></View>;

  function openURL(u: string) {
    try {
      const url = u.startsWith('http') ? u : `https://${u}`;
      if (Platform.OS === 'web') (window as any).open(url, '_blank');
      else Linking.openURL(url);
    } catch {}
  }

  const ProfileTab = (
    <View style={{ gap:12 }}>
      <View style={{ flexDirection:'row', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <View style={{ width:160, height:160, borderRadius:12, overflow:'hidden', backgroundColor:'#111827', alignItems:'center', justifyContent:'center' }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width:'100%', height:'100%' }} /> : <Text style={{ color:'#9ca3af' }}>No photo</Text>}
        </View>
        <View style={{ gap:6, flex:1, minWidth:220 }}>
          <Text style={{ fontSize:24, fontWeight:'900', color:'#f8fafc' }}>{title}</Text>
          {chef.location ? <Text style={{ color:'#cbd5e1' }}>{chef.location}</Text> : null}
          {chef.phone ? <Text style={{ color:'#cbd5e1' }}>{formatPhone(chef.phone)}</Text> : null}
          <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginTop:6 }}>
            <Rating value={avg} />
            <Text style={{ color:'#cbd5e1' }}>{avg.toFixed(1)}</Text>
          </View>
        </View>
      </View>
      <Text style={{ color:'#e2e8f0', lineHeight:20 }}>{desc}</Text>
      <View style={{ flexDirection:'row', gap:12, marginTop:6, flexWrap:'wrap' }}>
        {chef.facebook ? <SocialButton title="Facebook" onPress={()=>openURL(chef.facebook!)} /> : null}
        {chef.instagram ? <SocialButton title="Instagram" onPress={()=>openURL(chef.instagram!)} /> : null}
      </View>
    </View>
  );

  const DishesTab = (
    <View style={{ gap:12 }}>
      {dishes.length === 0 ? <Text style={{ color:'#cbd5e1' }}>No dishes yet.</Text> : (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {dishes.map(d => {
            const img = d.image_url || d.image || d.thumbnail || '';
            return (
              <View key={d.id} style={{ width:200, borderRadius:12, overflow:'hidden', backgroundColor:'#111827', borderWidth:1, borderColor:'#1f4f3f' }}>
                <View style={{ width:'100%', height:120, backgroundColor:'#0b1220', alignItems:'center', justifyContent:'center' }}>
                  {img ? <Image source={{ uri: img }} style={{ width:'100%', height:'100%' }} /> : <Text style={{ color:'#9ca3af' }}>No image</Text>}
                </View>
                <View style={{ padding:10, gap:4 }}>
                  <Text style={{ color:'#f8fafc', fontWeight:'800' }} numberOfLines={1}>{d.name || ('Dish #' + d.id)}</Text>
                  {d.price != null ? <Text style={{ color:'#fbbf24' }}>$ {Number(d.price).toFixed(2)}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const ReviewsTab = (
    <View style={{ gap:12 }}>
      {reviews.length === 0 ? <Text style={{ color:'#cbd5e1' }}>No reviews yet.</Text> : (
        <View style={{ gap:12 }}>
          {reviews.map(r=>(
            <View key={r.id} style={{ backgroundColor:'#111827', padding:12, borderRadius:12, borderWidth:1, borderColor:'#1f4f3f' }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Rating value={r.rating} />
                <Text style={{ color:'#cbd5e1', fontWeight:'700' }}>{r.rating.toFixed(1)}</Text>
                {r.user_name ? <Text style={{ color:'#94a3b8' }}>· {r.user_name}</Text> : null}
                {r.created_at ? <Text style={{ color:'#64748b', marginLeft:6, fontSize:12 }}>{new Date(r.created_at).toLocaleString()}</Text> : null}
              </View>
              {r.comment ? <Text style={{ color:'#e2e8f0', marginTop:6 }}>{r.comment}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ alignItems:'center', padding:20 }}>
      <View style={{ width:'100%', maxWidth:1024, backgroundColor:'#0f172a', borderRadius:16, padding:16, gap:16 }}>
        <Tabs
          tabs={[
            { key:'profile', title:'Profile', content: ProfileTab },
            { key:'dishes',  title:'Dishes',  content: DishesTab  },
            { key:'reviews', title:'Reviews', content: ReviewsTab },
          ]}
        />
      </View>
    </ScrollView>
  );
}
