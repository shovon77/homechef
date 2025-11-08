import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { useResponsiveColumns } from "../utils/responsive";

type Dish = { id: number; name: string; chef: string; price: number; category?: string; rating?: number; image?: string; };

export default function DishesPage() {
  const [all, setAll] = useState<Dish[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { getColumns } = useResponsiveColumns();
  const columns = getColumns(3);
  const PAGE_SIZE = columns * 5; // 5 rows

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("dishes").select("*").limit(500);
      const list = (data as Dish[] | null) ?? [];
      // Sort by rating desc
      setAll([...list].sort((a, b) => Number(b.rating||0) - Number(a.rating||0)));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return all.filter(d =>
      (d.name||"").toLowerCase().includes(q) ||
      (d.chef||"").toLowerCase().includes(q) ||
      (d.category||"").toLowerCase().includes(q)
    );
  }, [all, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;
  const current = filtered.slice(start, start + PAGE_SIZE);

  const DishCard = ({ item }: { item: Dish }) => (
    <Link href={`/dish/${item.id}`} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#1f4f3f",
          width: "100%",
        }}
      >
        <Image
          source={{ uri: item.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80" }}
          style={{ width: "100%", height: 160 }}
        />
        <View style={{ padding: 12 }}>
          <Text style={{ color: theme.colors.white, fontWeight: "800" }} numberOfLines={1}>{item.name}</Text>
          <Text style={{ color: theme.colors.muted, marginTop: 4 }} numberOfLines={1}>by {item.chef}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
            <Text style={{ color: "#FFD54F", fontWeight: "900" }}>★</Text>
            <Text style={{ color: theme.colors.white, fontWeight: "700", marginLeft: 4 }}>
              {(item.rating ?? 0).toFixed(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 12, paddingTop: 18 }}>
        {/* Header + Search */}
        <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: "900", marginBottom: 10 }}>All Dishes</Text>
        <View style={{
          backgroundColor: theme.colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: 1, borderColor: "#1f4f3f", marginBottom: 14
        }}>
          <TextInput
            placeholder="Search dishes, chefs, categories…" placeholderTextColor={theme.colors.muted}
            value={query} onChangeText={(t)=>{ setQuery(t); setPage(1); }}
            style={{ color: theme.colors.white, fontSize: 16 }}
          />
        </View>

        {/* Grid */}
        <FlatList
          data={current}
          keyExtractor={(it)=>String(it.id)}
          renderItem={({ item }) => (
            <View style={{ flex: 1, marginHorizontal: 6, marginBottom: 12 }}>
              <DishCard item={item}/>
            </View>
          )}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? {} : undefined}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={{ color: theme.colors.muted, textAlign: "center", marginTop: 24 }}>No dishes found</Text>}
        />

        {/* Pagination */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 24 }}>
          <TouchableOpacity
            disabled={clampedPage <= 1}
            onPress={()=>setPage(p=>Math.max(1, p-1))}
            style={{
              opacity: clampedPage<=1 ? 0.5 : 1,
              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
              backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: "#1f4f3f"
            }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "700" }}>← Prev</Text>
          </TouchableOpacity>

          <Text style={{ color: theme.colors.muted }}>Page {clampedPage} / {totalPages}</Text>

          <TouchableOpacity
            disabled={clampedPage >= totalPages}
            onPress={()=>setPage(p=>Math.min(totalPages, p+1))}
            style={{
              opacity: clampedPage>=totalPages ? 0.5 : 1,
              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
              backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: "#1f4f3f"
            }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "700" }}>Next →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
