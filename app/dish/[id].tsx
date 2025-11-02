import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";

// Optional cart hook (won't crash if missing)
let useCart: any = () => ({ addToCart: () => {} });
try { useCart = require("../../context/CartContext").useCart; } catch {}

type Dish = {
  id: number;
  name: string;
  image?: string | null;
  price?: number | null;
  chef?: string | null;
  description?: string | null;
  category?: string | null;
};

export default function DishDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dishId = Number(id);
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { addToCart } = useCart();

  // Load dish
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("dishes").select("*").eq("id", dishId).single();
      if (!mounted) return;
      if (error) {
        console.log("dish fetch error", error);
      } else {
        setDish(data as Dish);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [dishId]);

  const onUploadPhoto = async () => {
    try {
      if (!dish) return;
      setUploading(true);

      // 1) permission
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access to upload.");
        setUploading(false);
        return;
      }

      // 2) pick
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (picked.canceled) {
        setUploading(false);
        return;
      }

      const asset = picked.assets[0];
      const uri = asset.uri;
      const baseName = uri.split("/").pop() || `dish-${Date.now()}.jpg`;
      const extGuess = (baseName.split(".").pop() || "jpg").toLowerCase();
      const contentType =
        asset.mimeType ||
        (extGuess === "png" ? "image/png" :
         extGuess === "webp" ? "image/webp" : "image/jpeg");

      // 3) blob
      const res = await fetch(uri);
      const blob = await res.blob();

      // 4) upload (bucket must exist: dish-images, public; policies allow insert/update)
      const path = `dishes/${dish.id}/${Date.now()}-${baseName}`;
      const { error: upErr } = await supabase.storage
        .from("dish-images")
        .upload(path, blob, { upsert: true, contentType, cacheControl: "3600" });
      if (upErr) {
        console.log("[upload] storage error:", upErr);
        Alert.alert("Upload failed", upErr.message);
        setUploading(false);
        return;
      }

      // 5) public URL
      const { data: pub } = await supabase.storage.from("dish-images").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        Alert.alert("Upload failed", "Could not obtain public URL");
        setUploading(false);
        return;
      }

      // 6) update row
      const { error: rowErr } = await supabase.from("dishes").update({ image: publicUrl }).eq("id", dish.id);
      if (rowErr) {
        console.log("[upload] row update error:", rowErr);
        Alert.alert("Save failed", rowErr.message);
        setUploading(false);
        return;
      }

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
        <ActivityIndicator />
      </View>
    );
  }

  if (!dish) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.colors.white }}>Dish not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ maxWidth: 1100, width: "100%", alignSelf: "center", padding: 16 }}>
        <Image
          source={{
            uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80&auto=format&fit=crop",
          }}
          onError={(e) => console.log("Detail image error:", dish?.image, e?.nativeEvent?.error)}
          style={{ width: "100%", height: 260, borderRadius: 14 }}
        />

        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={{ color: theme.colors.white, fontSize: 24, fontWeight: "900" }}>{dish.name}</Text>
          {!!dish.chef && <Text style={{ color: "#cbd5e1" }}>by {dish.chef}</Text>}
          <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: "900" }}>${Number(dish.price || 0).toFixed(2)}</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <TouchableOpacity
              onPress={() => addToCart({ id: dish.id, name: dish.name, price: Number(dish.price || 0), quantity: 1, image: dish.image || undefined })}
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
          </View>

          {!!dish.description && (
            <Text style={{ color: "#cbd5e1", marginTop: 10 }}>{dish.description}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
