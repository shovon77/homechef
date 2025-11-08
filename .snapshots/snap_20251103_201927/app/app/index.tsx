import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import Banner from "./components/Banner";
import HorizontalCarousel from "./components/HorizontalCarousel";
import { getChefAvatar } from "../lib/avatars";

type Dish = { id: number; name: string; chef: string; price: number; category?: string; rating?: number; image?: string; };
type Chef = { id: number | string; name: string; location?: string; avatar?: string; rating?: number; bio?: string; };

const BROWSE_LIMIT = 20;

export default function Home() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [filtered, setFiltered] = useState<Dish[]>([]);
  const [popularDishes, setPopularDishes] = useState<Dish[]>([]);
  const [popularChefs, setPopularChefs] = useState<Chef[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: allDishes } = await supabase.from("dishes").select("*").limit(120);
      const list = (allDishes as Dish[] | null) ?? [];
      const sorted = [...list].sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)));
      setDishes(sorted);
      setFiltered(sorted);
      setPopularDishes(sorted.slice(0, 12));

      const { data: topChefs, error: chefsErr } = await supabase
        .from("chefs")
        .select("id,name,location,avatar,rating,bio")
        .limit(50);

      if (!chefsErr && topChefs && topChefs.length) {
        const c = (topChefs as Chef[])
          .map((chef) => ({ ...chef, avatar: chef.avatar || getChefAvatar(chef.name, 128) }))
          .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
          .slice(0, 12);
        setPopularChefs(c);
      } else {
        const byChef: Record<string, { n: number; r: number; img?: string }> = {};
        sorted.forEach((d) => {
          const key = d.chef || "Unknown Chef";
          if (!byChef[key]) byChef[key] = { n: 0, r: 0, img: d.image };
          byChef[key].n += 1; byChef[key].r += Number(d.rating || 0);
        });
        const synth: Chef[] = Object.entries(byChef)
          .map(([name, v], i) => ({
            id: `s_${i}`,
            name,
            location: "Toronto, ON",
            avatar: v.img || getChefAvatar(name, 128),
            rating: v.n ? v.r / v.n : 0,
            bio: "Community chef on HomeChef.",
          }))
          .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
          .slice(0, 12);
        setPopularChefs(synth);
      }
    })();
  }, []);

  const onSearch = (txt: string) => {
    setSearch(txt);
    const q = txt.toLowerCase();
    setFiltered(
      dishes.filter(
        (d) =>
          (d.name || "").toLowerCase().includes(q) ||
          (d.chef || "").toLowerCase().includes(q) ||
          (d.category || "").toLowerCase().includes(q)
      )
    );
  };

  const DishCard = ({ item }: { item: Dish }) => (
    <Link href={`/dish/${item.id}`} asChild>
      <TouchableOpacity
        style={{
          width: "100%",
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          paddingBottom: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#1f4f3f",
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80" }}
          style={{ width: "100%", height: 130 }}
        />
        <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          <Text style={{ fontWeight: "800", fontSize: 14, color: theme.colors.white }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: theme.colors.muted, fontSize: 12 }} numberOfLines={1}>
            by {item.chef}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Text style={{ color: "#FFD54F", fontWeight: "900" }}>★</Text>
            <Text style={{ color: theme.colors.white, fontWeight: "700", marginLeft: 4, fontSize: 12 }}>
              {(item.rating ?? 0).toFixed(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );

  const Header = useMemo(() => (
    <View>
      <Banner />
      <View style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#1f4f3f",
        marginBottom: 14
      }}>
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search dishes, chefs, categories..."
          placeholderTextColor={theme.colors.muted}
          style={{ color: theme.colors.white, fontSize: 16 }}
        />
      </View>

      <HorizontalCarousel title="Popular Dishes" items={popularDishes} kind="dish" seeAllHref="/dishes" />
      <HorizontalCarousel title="Top Chefs" items={popularChefs} kind="chef" seeAllHref="/chefs" />

      <Text style={{ color: theme.colors.white, fontSize: 18, fontWeight: "800", marginBottom: 8, marginTop: 6 }}>
        Browse All
      </Text>
    </View>
  ), [search, popularDishes, popularChefs]);

  const showMoreFooter = (count: number) => {
    if (count <= BROWSE_LIMIT) return null;
    return (
      <View style={{ marginTop: 8, marginBottom: 24, alignItems: "center" }}>
        <Link href="/dishes" asChild>
          <TouchableOpacity
            activeOpacity={0.9}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: theme.colors.primary,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "800" }}>
              Show more dishes →
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  };

  const visible = filtered.slice(0, BROWSE_LIMIT);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 12, paddingTop: 18 }}>
        <FlatList
          data={visible}
          keyExtractor={(it) => String(it.id)}
          renderItem={({ item }) => (
            <View style={{ flex: 1, marginHorizontal: 4, marginBottom: 10 }}>
              <DishCard item={item} />
            </View>
          )}
          numColumns={4}  // 👈 Four columns per row
          columnWrapperStyle={{ justifyContent: "space-between" }}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.muted, textAlign: "center", marginTop: 24 }}>
              No results
            </Text>
          }
          ListFooterComponent={showMoreFooter(filtered.length)}
          removeClippedSubviews={false}
        />
      </View>
    </View>
  );
}
