import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";
import StarRating from "../components/StarRating";
import { useCart } from "../../context/CartContext";

type Chef = {
  id: number;
  name: string;
  location?: string | null;
  bio?: string | null;
  avatar?: string | null;
};

type Dish = {
  id: number;
  name: string;
  price: number;
  image?: string | null;
  chef?: string | null;
  description?: string | null;
  category?: string | null;
};

export default function ChefDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chefId = Number(id);
  const router = useRouter();
  const { addToCart } = useCart();

  const [chef, setChef] = useState<Chef | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"dishes" | "reviews">("dishes");
  const [loading, setLoading] = useState(true);
  const [savingRating, setSavingRating] = useState(false);

  const avatar = chef?.avatar || "https://i.pravatar.cc/300?u=chef-" + chefId;

  const load = async () => {
    if (!chefId) return;
    setLoading(true);

    const chefRes = await supabase.from("chefs").select("*").eq("id", chefId).maybeSingle();
    if (chefRes.error) console.error("Load chef error:", chefRes.error);
    setChef((chefRes.data as Chef) ?? null);

    const dishesRes = await supabase.from("dishes").select("*").eq("chef_id", chefId).order("price", { ascending: true });
    if (dishesRes.error) console.error("Load dishes error:", dishesRes.error);
    setDishes((dishesRes.data as Dish[]) ?? []);

    const ratingRes = await supabase.from("chef_ratings").select("stars").eq("chef_id", chefId);
    if (ratingRes.error) {
      console.error("Load chef ratings error:", ratingRes.error);
      setAvgRating(0);
    } else if (ratingRes.data?.length) {
      const avg = ratingRes.data.reduce((s: number, r: any) => s + (Number(r.stars) || 0), 0) / ratingRes.data.length;
      setAvgRating(avg);
    } else {
      setAvgRating(0);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [chefId]);

  const handleRate = async (stars: number) => {
    if (!chefId) return;
    try {
      setSavingRating(true);
      const { error } = await supabase.from("chef_ratings").insert({ chef_id: chefId, stars }).select().single();
      if (error) {
        console.error("Chef rate error:", {
          message: error.message, details: (error as any).details, hint: (error as any).hint, code: error.code
        });
        return;
      }
      await load();
    } finally {
      setSavingRating(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!chef) {
    return (
      <View style={{ flex: 1, padding: 20, backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.white, marginBottom: 10 }}>Chef not found (id="{id}").</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10, alignSelf: "flex-start" }}>
          <Text style={{ color: theme.colors.white, fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16, gap: 16, maxWidth: 1000, width: "100%", alignSelf: "center" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.white, fontSize: 26, fontWeight: "900" }}>{chef.name}</Text>
            {!!chef.location && <Text style={{ color: "#cbd5e1" }}>{chef.location}</Text>}
            <View style={{ marginTop: 6 }}>
              <StarRating value={avgRating} onChange={handleRate} />
              {savingRating && <Text style={{ color: "#94a3b8", fontSize: 12 }}>Saving…</Text>}
            </View>
          </View>
        </View>

        {!!chef.bio && (
          <Text style={{ color: "#cbd5e1", lineHeight: 20 }}>
            {chef.bio}
          </Text>
        )}

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {(["dishes", "reviews"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveTab(t)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: activeTab === t ? theme.colors.primary : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: theme.colors.white, fontWeight: "700", textTransform: "capitalize" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {activeTab === "dishes" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {dishes.map((dish) => (
              <View
                key={dish.id}
                style={{
                  width: "100%",
                  maxWidth: 300,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
                  style={{ width: "100%", height: 160 }}
                />
                <View style={{ padding: 12, gap: 6 }}>
                  <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 16 }}>{dish.name}</Text>
                  <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>${Number(dish.price || 0).toFixed(2)}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      addToCart({
                        id: dish.id,
                        name: dish.name,
                        price: Number(dish.price || 0),
                        quantity: 1,
                        image: dish.image || undefined,
                      })
                    }
                    style={{ backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 6 }}
                  >
                    <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Add to cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {dishes.length === 0 && (
              <Text style={{ color: "#94a3b8", paddingVertical: 12 }}>No dishes yet.</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#cbd5e1" }}>
              Community reviews coming soon. You can already rate this chef above ⭐️
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
