'use client';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/formatPhone';
import { Tabs } from '../../components/Tabs';
import { useCart } from '../../context/CartContext';
import { getChefById, getDishesByChefId, getChefReviews } from '../../lib/db';
import type { Chef, Dish, ChefReview } from '../../lib/types';

/** Color tokens aligned with homepage */
const C = {
  pageBg:    '#08150E',
  panelBg:   '#0F2418',
  cardBg:    '#12301F',
  border:    '#1d4d35',
  text:      '#e7f3ec',
  subtext:   '#b8d2c6',
  accent:    '#fbbf24',  // gold
  link:      '#0ea5e9',
};

function StarRow({ value=0 }:{ value?: number }) {
  const full = Math.max(0, Math.min(5, Math.floor(value)));
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {Array.from({length:full}).map((_,i)=><Text key={'f'+i} style={{color: C.accent, fontSize:16, marginRight:2}}>★</Text>)}
      {half ? <Text style={{color: C.accent, fontSize:16, marginRight:2}}>⯪</Text> : null}
      {Array.from({length:empty}).map((_,i)=><Text key={'e'+i} style={{color: '#5b7b6e', fontSize:16, marginRight:2}}>☆</Text>)}
    </View>
  );
}

export default function ChefDetailView() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  const numericFromAny = (() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g, '');
    return tail ? Number(tail) : NaN;
  })();

  const [chefId, setChefId] = useState<number | null>(null);
  const [chef, setChef] = useState<Chef | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<ChefReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    setError(null);
    if (Number.isFinite(numericFromAny) && numericFromAny > 0) {
      setChefId(numericFromAny);
    } else {
      // default to first chef if route was malformed
      setChefId(1);
    }
  }, [raw]);

  useEffect(() => {
    if (!chefId) return;
    (async () => {
      try {
        // Use db helpers
        const chefData = await getChefById(chefId);
        if (!chefData) {
          setError('Chef not found');
          return;
        }
        setChef(chefData);

        // Get dishes using db helper (handles chef_id fallback automatically)
        const dishesData = await getDishesByChefId(chefId);
        setDishes(dishesData);

        // Get reviews using db helper
        const reviewsData = await getChefReviews(chefId);
        setReviews(reviewsData);
      } catch (e:any) {
        setError(e.message || String(e));
      }
    })();
  }, [chefId]);

  const avatar = chef?.photo || '';
  const title  = chef?.name || (chefId ? `Chef #${chefId}` : 'Chef');
  const bio    = chef?.bio ?? chef?.description ?? '';

  const reelUrls = useMemo(() => {
    try {
      if (chef?.reels_json) {
        const parsed = JSON.parse(String(chef.reels_json));
        if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0,6);
      }
    } catch {}
    const list = (chef?.reels || '')
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean);
    if (chef?.youtube_url) list.unshift(chef.youtube_url);
    return list.slice(0,6);
  }, [chef?.reels, chef?.reels_json, chef?.youtube_url]);

  const Header = (
    <View style={{
      backgroundColor: C.cardBg,
      borderWidth:1, borderColor: C.border,
      borderRadius:16, padding:14, gap:12
    }}>
      <View style={{ flexDirection:'row', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <View style={{ width:140, height:140, borderRadius:12, overflow:'hidden', backgroundColor:'#061009', alignItems:'center', justifyContent:'center' }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width:'100%', height:'100%' }} /> : (
            <Text style={{ color:'#6c8f81' }}>No photo</Text>
          )}
        </View>
        <View style={{ flex:1, minWidth:220, gap:6 }}>
          <Text style={{ color:C.text, fontSize:24, fontWeight:'900' }}>{title}</Text>
          {chef?.location ? <Text style={{ color:C.subtext }}>{chef.location}</Text> : null}
          {chef?.phone ? <Text style={{ color:C.subtext }}>{formatPhone(chef.phone)}</Text> : null}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:4 }}>
            <StarRow value={Number(chef?.avg_rating ?? 0)} />
            <Text style={{ color:C.subtext }}>{Number(chef?.avg_rating ?? 0).toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {bio ? <Text style={{ color:C.text, lineHeight:20 }}>{bio}</Text> : null}

      {/* Social placeholders */}
      <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap', marginTop:4 }}>
        <TouchableOpacity
          onPress={()=>{ try { if (Platform.OS==='web' && chef?.instagram) window.open(chef.instagram,'_blank'); } catch {} }}
          style={{ backgroundColor:'#1a3d2b', borderWidth:1, borderColor:C.border, paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'800' }}>Instagram</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={()=>{ try { if (Platform.OS==='web' && chef?.facebook) window.open(chef.facebook,'_blank'); } catch {} }}
          style={{ backgroundColor:'#1a3d2b', borderWidth:1, borderColor:C.border, paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'800' }}>Facebook</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  function handleAddToCart(d: Dish) {
    const img = d.image || d.thumbnail || '';
    const result = addToCart({ 
      id: d.id, 
      name: d.name || '', 
      price: d.price ?? 0, 
      quantity: 1, 
      image: img,
      chef_id: chefId, // Use current chef's ID for single-chef constraint
    });
    if (result.success) {
      console.log('Added to cart:', { id: d.id, name: d.name });
    }
    // Alert already shown by CartContext if blocked
  }

  const DishesTab = (
    <View style={{ gap:12 }}>
      {dishes.length === 0 ? (
        <Text style={{ color:C.subtext }}>No dishes yet.</Text>
      ) : (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {dishes.map(d => {
            const img = d.image || d.thumbnail || '';
            return (
              <View key={d.id} style={{
                width:220, backgroundColor:C.cardBg,
                borderWidth:1, borderColor:C.border,
                borderRadius:12, overflow:'hidden'
              }}>
                {/* Clickable area goes to dish detail */}
                <TouchableOpacity
                  onPress={() => router.push(`/dish/${d.id}`)}
                  style={{ width:'100%', height:140, backgroundColor:'#0a1a13', alignItems:'center', justifyContent:'center' }}>
                  {img ? <Image source={{ uri: img }} style={{ width:'100%', height:'100%' }} /> : <Text style={{ color:'#6c8f81' }}>No image</Text>}
                </TouchableOpacity>

                <View style={{ padding:10, gap:6 }}>
                  <Text style={{ color:C.text, fontWeight:'800' }} numberOfLines={1}>{d.name || ('Dish #' + d.id)}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={{ color:C.accent }}>{d.price != null ? `$${Number(d.price).toFixed(2)}` : ''}</Text>
                    <TouchableOpacity
                      onPress={() => handleAddToCart(d)}
                      style={{ backgroundColor:'#0ea5e9', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
                      <Text style={{ color:'#fff', fontWeight:'800' }}>Add to cart</Text>
                    </TouchableOpacity>
                  </View>
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
      {reviews.length === 0 ? <Text style={{ color:C.subtext }}>No reviews yet.</Text> : (
        <View style={{ gap:10 }}>
          {reviews.map(r => (
            <View key={r.id} style={{ backgroundColor:C.cardBg, borderWidth:1, borderColor:C.border, borderRadius:12, padding:10 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <StarRow value={r.rating} />
                <Text style={{ color:C.subtext, fontWeight:'700' }}>{r.rating.toFixed(1)}</Text>
                {r.user_name ? <Text style={{ color:'#88a79a' }}>· {r.user_name}</Text> : null}
                {r.created_at ? <Text style={{ color:'#6f8d81', marginLeft:6, fontSize:12 }}>{new Date(r.created_at).toLocaleDateString()}</Text> : null}
              </View>
              {r.comment ? <Text style={{ color:C.text, marginTop:6 }}>{r.comment}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const CookingTab = (
    <View style={{ gap:12 }}>
      <Text style={{ color:C.subtext }}>
        Drop your YouTube URL or Instagram Reel in Supabase fields: <Text style={{ color:C.link }}>youtube_url</Text>, <Text style={{ color:C.link }}>reels</Text> or <Text style={{ color:C.link }}>reels_json</Text>.
      </Text>
      {Platform.OS === 'web' ? (
        <View style={{ gap:12 }}>
          {reelUrls.length === 0 ? (
            <View style={{ backgroundColor:C.cardBg, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12 }}>
              <Text style={{ color:'#88a79a' }}>No video yet. Add a URL to show it here.</Text>
            </View>
          ) : reelUrls.map((u, i) => (
            <View key={i} style={{ backgroundColor:C.cardBg, borderWidth:1, borderColor:C.border, borderRadius:12, overflow:'hidden' }}>
              <iframe
                src={u}
                style={{ width:'100%', height:360, border:'0' } as any}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color:C.subtext }}>Video embed preview is web-only. On native, open links in a WebView.</Text>
      )}
    </View>
  );

  if (error) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text style={{ color:'tomato' }}>Error: {error}</Text>
      </View>
    );
  }
  if (!chefId || !chef) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text style={{ color:C.subtext }}>Loading chef…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow:1, alignItems:'center', padding:20, backgroundColor:C.pageBg }}>
      <View style={{ width:'100%', maxWidth:1024, backgroundColor:C.panelBg, borderRadius:16, padding:16, gap:16, borderWidth:1, borderColor:C.border, marginBottom:20 }}>
        {/* Header stays visible regardless of active tab */}
        {Header}

        {/* Tabs content */}
        <Tabs
          tabs={[
            { key:'dishes',  title:'Dishes',         content: DishesTab },
            { key:'reviews', title:'Reviews',        content: ReviewsTab },
            { key:'cooking', title:"What's cooking?", content: CookingTab },
          ]}
          initial={0}
        />
      </View>
    </ScrollView>
  );
}
