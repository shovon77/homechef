import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { getChefAvatar } from "../lib/avatars";

type Chef = { id: number | string; name: string; location?: string; avatar?: string; rating?: number; bio?: string; };
type Dish = { id: number; name: string; chef: string; rating?: number; image?: string; };

const PAGE_SIZE = 15; // 3 cols × 5 rows

export default function ChefsPage() {
  const [all, setAll] = useState<Chef[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      // Try the chefs table first
      const { data: chefs, error } = await supabase.from("chefs").select("id,name,location,avatar,rating,bio").limit(500);
      if (!error && chefs && chefs.length) {
        const list = (chefs as Chef[]).map(c => ({ ...c, avatar: c.avatar || getChefAvatar(c.name, 128) }));
        setAll(list.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)));
        return;
      }
      // Fallback: synthesize chefs from dishes
      const { data: dishes } = await supabase.from("dishes").select("*").limit(1000);
      const arr = (dishes as Dish[] | null) ?? [];
      const byChef: Record<string, { n:number, r:number, img?:string }> = {};
      arr.forEach(d=>{
        const key = d.chef || "Unknown Chef";
        if (!byChef[key]) byChef[key] = { n:0, r:0, img:d.image };
        byChef[key].n += 1; byChef[key].r += Number(d.rating||0);
      });
      const synth: Chef[] = Object.entries(byChef).map(([name, v], i)=>({
        id: `s_${i}`, name, location: "Toronto, ON",
        avatar: v.img || getChefAvatar(name, 128),
        rating: v.n ? v.r/v.n : 0,
        bio: "Community chef on HomeChef."
      }));
      setAll(synth.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)));
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return all.filter(c =>
      (c.name||"").toLowerCase().includes(q) ||
      (c.location||"").toLowerCase().includes(q) ||
      (c.bio||"").toLowerCase().includes(q)
    );
  }, [all, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;
  const current = filtered.slice(start, start + PAGE_SIZE);

  const ChefCard = ({ item }: { item: Chef }) => (
    <Link href={`/chef/${item.id}`} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#1f4f3f",
          alignItems: "center",
          paddingVertical: 14,
          width: "100%",
        }}
      >
        <Image
          source={{ uri: item.avatar || getChefAvatar(item.name, 128) }}
          style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.colors.primary, marginBottom: 10 }}
        />
        <View style={{ paddingHorizontal: 12, alignItems: "center" }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900" }} numberOfLines={1}>{item.name}</Text>
          <Text style={{ color: theme.colors.muted, marginTop: 2 }} numberOfLines={1}>{item.location || "—"}</Text>
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 12, paddingTop: 18 }}>
        {/* Header + Search */}
        <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: "900", marginBottom: 10 }}>All Chefs</Text>
        <View style={{
          backgroundColor: theme.colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: 1, borderColor: "#1f4f3f", marginBottom: 14
        }}>
          <TextInput
            placeholder="Search chefs, locations, bios…" placeholderTextColor={theme.colors.muted}
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
              <ChefCard item={item}/>
            </View>
          )}
          numColumns={3}
          columnWrapperStyle={{}}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={{ color: theme.colors.muted, textAlign: "center", marginTop: 24 }}>No chefs found</Text>}
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
