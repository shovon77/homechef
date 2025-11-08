<<<<<<< HEAD
import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";
import StarRating from "../components/StarRating";
import { useResponsiveColumns } from "../../utils/responsive";

// Optional cart hook (won't crash if missing)
let useCart: any = () => ({ addToCart: () => {} });
try { useCart = require("../../context/CartContext").useCart; } catch {}

type Dish = {
  id: number;
  name: string;
  image?: string | null;
  price?: number | null;
  chef?: string | null;
  chef_id?: number | string | null;
  description?: string | null;
  category?: string | null;
};

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
=======
'use client';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { cart } from '../../lib/cart';

const C = {
  pageBg:    '#08150E',
  panelBg:   '#0F2418',
  cardBg:    '#12301F',
  border:    '#1d4d35',
  text:      '#e7f3ec',
  subtext:   '#b8d2c6',
  accent:    '#fbbf24',
  link:      '#0ea5e9',
};

type Dish = {
  id:number;
  name?:string|null;
  price?:number|null;
  description?:string|null;
  details?:string|null;
  image_url?:string|null;
  image?:string|null;
  thumbnail?:string|null;
  photo_url?:string|null;
  photo?:string|null;
  picture?:string|null;
  chef_id?:number|null;
  chef?:string|null;
};

function StarRow({ value=0, size=18 }:{ value?:number; size?:number }) {
  const full = Math.max(0, Math.min(5, Math.floor(value)));
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {Array.from({length:full}).map((_,i)=><Text key={'f'+i} style={{color: C.accent, fontSize:size, marginRight:2}}>★</Text>)}
      {half ? <Text style={{color: C.accent, fontSize:size, marginRight:2}}>⯪</Text> : null}
      {Array.from({length:empty}).map((_,i)=><Text key={'e'+i} style={{color:'#5b7b6e', fontSize:size, marginRight:2}}>☆</Text>)}
    </View>
  );
}
>>>>>>> origin/main

export default function DishDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  const dishId = (() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g,'');
    return tail ? Number(tail) : NaN;
  })();

  const [dish, setDish] = useState<Dish | null>(null);
<<<<<<< HEAD
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToCart } = useCart();
  const { width } = useResponsiveColumns();
  const isMobile = width < 768;

  // Load dish and ratings
=======
  const [avg, setAvg] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [error, setError] = useState<string|null>(null);

>>>>>>> origin/main
  useEffect(() => {
    if (!Number.isFinite(dishId)) { setError('Invalid dish id'); return; }
    (async () => {
<<<<<<< HEAD
      setLoading(true);
      const { data, error } = await supabase.from("dishes")
        .select("id,name,image,price,chef,chef_id,description,category")
        .eq("id", dishId).single();
      if (!mounted) return;
      if (error) console.log("dish fetch error", error);
      setDish(data as Dish);
      
      // Load ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("dish_ratings")
        .select("rating, user_id, comment")
        .eq("dish_id", dishId);
      
      if (!ratingsError && ratingsData) {
        const ratings = ratingsData.map(r => Number(r.rating || 0)).filter(n => n > 0);
        setRatingCount(ratings.length);
        setAvgRating(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
        
        // Check if user has already rated
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userRatingData = ratingsData.find(r => r.user_id === user.id);
          if (userRatingData) {
            setUserRating(Number(userRatingData.rating || 0));
            setComment(userRatingData.comment || "");
          }
        }
      }
      
      setLoading(false);
=======
      try {
        // load dish
        const dres = await supabase.from('dishes').select('*').eq('id', dishId).maybeSingle();
        if (dres.error) throw dres.error;
        setDish(dres.data as any);

        // ratings from dish_ratings (support rating/stars/value)
        const rres = await supabase
          .from('dish_ratings')
          .select('id,rating,stars,value')
          .eq('dish_id', dishId);

        let avgVal = 0, cnt = 0;
        if (!rres.error && Array.isArray(rres.data) && rres.data.length) {
          const vals = rres.data
            .map((r:any) => Number(r.rating ?? r.stars ?? r.value ?? 0))
            .filter((n:number) => Number.isFinite(n));
          cnt = vals.length;
          avgVal = cnt ? vals.reduce((a:number,b:number)=>a+b,0) / cnt : 0;
        } else {
          // fallback: dish.avg_rating if exists
          const anyAvg = (dres.data as any)?.avg_rating;
          if (anyAvg != null) { avgVal = Number(anyAvg); cnt = (dres.data as any)?.rating_count ?? 0; }
        }
        setCount(cnt);
        setAvg(avgVal);
      } catch (e:any) {
        console.error('Dish load error:', e?.message || e);
        setError(e?.message || String(e));
      }
>>>>>>> origin/main
    })();
  }, [raw]);

<<<<<<< HEAD
  const onUploadPhoto = async () => {
    try {
      if (!dish) return;
      setUploading(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Permission needed", "Please allow photo access to upload."); setUploading(false); return; }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (picked.canceled) { setUploading(false); return; }
      const asset = picked.assets[0];
      const uri = asset.uri;
      const baseName = uri.split("/").pop() || `dish-${Date.now()}.jpg`;
      const extGuess = (baseName.split(".").pop() || "jpg").toLowerCase();
      const contentType = asset.mimeType || (extGuess === "png" ? "image/png" : extGuess === "webp" ? "image/webp" : "image/jpeg");
      const res = await fetch(uri);
      const blob = await res.blob();
      const path = `dishes/${dish.id}/${Date.now()}-${baseName}`;
      const { error: upErr } = await supabase.storage.from("dish-images").upload(path, blob, { upsert: true, contentType, cacheControl: "3600" });
      if (upErr) { console.log("[upload] storage error:", upErr); Alert.alert("Upload failed", upErr.message); setUploading(false); return; }
      const { data: pub } = await supabase.storage.from("dish-images").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) { Alert.alert("Upload failed", "Could not obtain public URL"); setUploading(false); return; }
      const { error: rowErr } = await supabase.from("dishes").update({ image: publicUrl }).eq("id", dish.id);
      if (rowErr) { console.log("[upload] row update error:", rowErr); Alert.alert("Save failed", rowErr.message); setUploading(false); return; }
      setDish(prev => prev ? { ...prev, image: publicUrl } : prev);
      Alert.alert("Done", "Photo updated!");
    } catch (e: any) {
      console.log("[upload] exception:", e);
      Alert.alert("Upload failed", e?.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
=======
  const img = useMemo(() => {
    if (!dish) return '';
    const d:any = dish;
    return d.image_url || d.image || d.thumbnail || d.photo_url || d.photo || d.picture || '';
  }, [dish]);

  function handleBackToChef() {
    const cid = (dish as any)?.chef_id;
    if (cid) router.push(`/chef/${cid}`);
    else router.push('/browse');
  }

  function handleAddToCart() {
    if (!dish) return;
    cart.add({ id: dish.id, name: dish.name, price: dish.price ?? 0, image: img, qty: 1 });
  }

  if (error) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text style={{ color:'tomato' }}>Error: {error}</Text>
>>>>>>> origin/main
      </View>
    );
  }
  if (!dish) {
<<<<<<< HEAD
    return <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.colors.white }}>Dish not found.</Text></View>;
  }

  const chefId = dish.chef_id != null ? normalizeId(dish.chef_id) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ maxWidth: 1100, width: "100%", alignSelf: "center", padding: isMobile ? 12 : 16 }}>
        <Image
          source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80&auto=format&fit=crop" }}
          onError={(e) => console.log("Detail image error:", dish?.image, e?.nativeEvent?.error)}
          style={{ width: "100%", height: isMobile ? 200 : 260, borderRadius: 14 }}
        />
=======
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text style={{ color:C.subtext }}>Loading dish…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow:1, alignItems:'center', padding:20, backgroundColor:C.pageBg }}>
      <View style={{ width:'100%', maxWidth:920, backgroundColor:C.panelBg, borderRadius:16, padding:16, gap:16, borderWidth:1, borderColor:C.border }}>
        {/* Back to chef */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <TouchableOpacity onPress={handleBackToChef} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#12301F', borderWidth:1, borderColor:C.border }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>← View Chef</Text>
          </TouchableOpacity>
        </View>
>>>>>>> origin/main

        {/* Image */}
        <View style={{ width:'100%', height:380, backgroundColor:'#0a1a13', borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:C.border }}>
          {img ? <Image source={{ uri: img }} style={{ width:'100%', height:'100%' }} /> : (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'#6c8f81' }}>No image</Text>
            </View>
          )}
        </View>

<<<<<<< HEAD
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <TouchableOpacity
              onPress={() => (useCart()?.addToCart
                ? useCart().addToCart({ id: dish.id, name: dish.name, price: Number(dish.price || 0), quantity: 1, image: dish.image || undefined })
                : null)}
              style={{ backgroundColor: theme.colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 }}
            >
              <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Add to cart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onUploadPhoto}
              disabled={uploading}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                opacity: uploading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>
                {uploading ? "Uploading…" : "Upload photo"}
              </Text>
            </TouchableOpacity>

            {chefId && (
              <Link href={{ pathname: "/chef/[id]", params: { id: chefId } }} asChild>
                <TouchableOpacity
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>
                    View Chef
                  </Text>
                </TouchableOpacity>
              </Link>
            )}
          </View>

          {!!dish.description && (
            <Text style={{ color: "#cbd5e1", marginTop: 10 }}>{dish.description}</Text>
          )}

          {/* Rating Section */}
          <View style={{ marginTop: 24, padding: 16, backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 8 }}>
              {ratingCount > 0 ? `Rating: ${avgRating.toFixed(1)} (${ratingCount} ${ratingCount === 1 ? 'rating' : 'ratings'})` : 'No ratings yet'}
            </Text>
            {ratingCount > 0 && (
              <View style={{ marginBottom: 16 }}>
                <StarRating value={avgRating} readonly size={20} />
              </View>
            )}

            <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16, marginTop: 16, marginBottom: 12 }}>
              {userRating > 0 ? 'Update your rating' : 'Rate this dish'}
            </Text>
            
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 14, marginBottom: 8 }}>Rating (required)</Text>
              <StarRating
                value={userRating}
                onChange={setUserRating}
                size={28}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 14, marginBottom: 8 }}>Comment (optional)</Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Share your thoughts..."
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: 12,
                  color: theme.colors.text,
                  fontSize: 14,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <TouchableOpacity
              onPress={async () => {
                if (!userRating || userRating < 1 || userRating > 5) {
                  Alert.alert("Rating required", "Please select 1–5 stars.");
                  return;
                }

                try {
                  setSubmitting(true);
                  
                  // Check authentication
                  const { data: { user }, error: authError } = await supabase.auth.getUser();
                  if (authError || !user) {
                    Alert.alert("Authentication required", "Please sign in to rate dishes.");
                    setSubmitting(false);
                    return;
                  }

                  // Upsert rating
                  const { error: upsertError } = await supabase
                    .from("dish_ratings")
                    .upsert({
                      dish_id: dishId,
                      user_id: user.id,
                      rating: userRating,
                      comment: comment.trim() || null,
                    }, {
                      onConflict: "dish_id,user_id"
                    });

                  if (upsertError) {
                    Alert.alert("Error", upsertError.message);
                    setSubmitting(false);
                    return;
                  }

                  // Reload ratings to update average
                  const { data: ratingsData, error: ratingsError } = await supabase
                    .from("dish_ratings")
                    .select("rating, user_id, comment")
                    .eq("dish_id", dishId);

                  if (!ratingsError && ratingsData) {
                    const ratings = ratingsData.map(r => Number(r.rating || 0)).filter(n => n > 0);
                    setRatingCount(ratings.length);
                    setAvgRating(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
                    
                    // Update user's rating and comment
                    const userRatingData = ratingsData.find(r => r.user_id === user.id);
                    if (userRatingData) {
                      setUserRating(Number(userRatingData.rating || 0));
                      setComment(userRatingData.comment || "");
                    }
                  }

                  Alert.alert("Thanks!", "Your rating has been submitted.");
                } catch (e: any) {
                  Alert.alert("Error", e?.message || "Failed to submit rating.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || !userRating}
              style={{
                backgroundColor: submitting || !userRating ? "rgba(229, 57, 53, 0.5)" : theme.colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                opacity: submitting || !userRating ? 0.7 : 1,
              }}
            >
              <Text style={{ color: theme.colors.white, fontWeight: "800", textAlign: "center" }}>
                {submitting ? "Submitting..." : userRating > 0 ? "Update Rating" : "Submit Rating"}
              </Text>
            </TouchableOpacity>
          </View>
=======
        {/* Title / Price / Rating / Actions */}
        <View style={{ gap:8 }}>
          <Text style={{ color:C.text, fontSize:26, fontWeight:'900' }}>{dish.name || `Dish #${dish.id}`}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <StarRow value={Number(avg || 0)} />
            <Text style={{ color:C.subtext }}>{count ? `${avg.toFixed(1)} • ${count} rating${count>1?'s':''}` : 'No ratings yet'}</Text>
          </View>

          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
            <Text style={{ color:C.accent, fontSize:20, fontWeight:'900' }}>
              {dish.price != null ? `$ ${Number(dish.price).toFixed(2)}` : ''}
            </Text>
            <TouchableOpacity
              onPress={handleAddToCart}
              style={{ backgroundColor:'#0ea5e9', paddingVertical:10, paddingHorizontal:14, borderRadius:10 }}>
              <Text style={{ color:'#fff', fontWeight:'900' }}>Add to cart</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        <View style={{ backgroundColor:C.cardBg, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12 }}>
          <Text style={{ color:C.text, lineHeight:20 }}>
            {dish.description || dish.details || 'No description provided.'}
          </Text>
>>>>>>> origin/main
        </View>
      </View>
    </ScrollView>
  );
}
