import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { useResponsiveColumns } from "../utils/responsive";
import { Screen } from "../components/Screen";

type Chef = Record<string, any>;
type Dish = { id: number; name: string; image?: string | null; price?: number | null; chef_id?: number | null };

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
const getAvatar = (c: Chef) =>
  c.photo || c.photo || c.avatar || c.photo || c.photo || c.photo || c.avatar || c.image || "https://i.pravatar.cc/200?img=5";

export default function HomePage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const { width, getColumns } = useResponsiveColumns();
  
  const chefColumns = getColumns(3);
  const dishColumns = getColumns(4);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from("chefs").select("*").order("rating", { ascending: false }).limit(6),
        supabase.from("dishes").select("id,name,image,price,chef_id").order("id", { ascending: false }).limit(8),
      ]);
      if (!mounted) return;
      setChefs((c || []) as Chef[]);
      setDishes((d || []) as Dish[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const chefCardW = width < 768 ? width - 48 : width < 1024 ? (width - 64) / 2 : Math.min(360, (width - 96) / chefColumns);
  const dishCardW = width < 768 ? width - 48 : width < 1024 ? (width - 64) / 2 : Math.min(320, (width - 96) / dishColumns);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen useScrollView contentStyle={{ paddingBottom: 24 }}>
      <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", padding: 12 }}>
        {/* Hero section */}
        <View style={{ width: "100%", height: 180, backgroundColor: theme.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginTop: 8, marginBottom: 16, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 20 }}>Welcome to HomeChef</Text>
        </View>

        {/* Top Chefs section */}
        <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 22 }}>Top Chefs</Text>
          <Link href="/chefs" asChild>
            <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>View all</Text>
            </TouchableOpacity>
          </Link>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {chefs.map((chef, i) => (
            <Link key={`${normalizeId(chef.id)}-${i}`} href={{ pathname: "/chef/[id]", params: { id: normalizeId(chef.id) } }} asChild>
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  width: chefCardW,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 12,
                  marginRight: 8,
                }}
              >
                <Image
                  source={{ uri: getAvatar(chef) }}
                  style={{ width: "100%", height: 120, borderRadius: 12, marginBottom: 10 }}
                />
                <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 18 }}>{chef.name}</Text>
                {!!chef.location && <Text style={{ color: "#a8b3cf", marginTop: 4 }}>{chef.location}</Text>}
                {!!chef.rating && (
                  <Text style={{ color: theme.colors.primary, marginTop: 8, fontWeight: "900" }}>
                    ★ {Number(chef.rating).toFixed(1)}
                  </Text>
                )}
              </TouchableOpacity>
            </Link>
          ))}
        </ScrollView>

        {/* Fresh Dishes section */}
        <View style={{ marginTop: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 22 }}>Fresh Dishes</Text>
          <Link href="/dishes" asChild>
            <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>View all</Text>
            </TouchableOpacity>
          </Link>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
        >
          {dishes.map((dish) => (
            <Link key={String(dish.id)} href={{ pathname: "/dish/[id]", params: { id: String(dish.id) } }} asChild>
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  width: dishCardW,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 12,
                  marginRight: 8,
                }}
              >
                <Image
                  source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
                  style={{ width: "100%", height: 110, borderRadius: 12, marginBottom: 10 }}
                />
                <Text style={{ color: theme.colors.white, fontWeight: "900" }}>{dish.name}</Text>
                <Text style={{ color: theme.colors.primary, fontWeight: "900", marginTop: 6 }}>
                  ${Number(dish.price || 0).toFixed(2)}
                </Text>
              </TouchableOpacity>
            </Link>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}
