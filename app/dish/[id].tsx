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

export default function DishDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dishId = Number(id);
  const [dish, setDish] = useState<Dish | null>(null);
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
  useEffect(() => {
    let mounted = true;
    (async () => {
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
    })();
    return () => { mounted = false; };
  }, [dishId]);

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
      </View>
    );
  }
  if (!dish) {
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

        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={{ color: theme.colors.white, fontSize: 24, fontWeight: "900" }}>{dish.name}</Text>
          {!!dish.chef && <Text style={{ color: "#cbd5e1" }}>by {dish.chef}</Text>}
          <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: "900" }}>${Number(dish.price || 0).toFixed(2)}</Text>

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
        </View>
      </View>
    </ScrollView>
  );
}
