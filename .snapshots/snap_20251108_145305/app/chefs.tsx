import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { useResponsiveColumns } from "../utils/responsive";

type Chef = Record<string, any>;

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
const getAvatar = (c: Chef) =>
  c.photo || c.photo || c.avatar || c.photo || c.photo || c.photo || c.avatar || c.image || "https://i.pravatar.cc/200?img=12";

export default function ChefsPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const { width, getColumns } = useResponsiveColumns();
  const columns = getColumns(3);
  
  const cardW = width < 768 ? width - 48 : width < 1024 ? (width - 64) / 2 : Math.min(360, (width - 96) / columns);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("chefs").select("*").order("rating", { ascending: false });
      if (!mounted) return;
      if (error) console.log("chefs error", error);
      setChefs((data || []) as Chef[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const renderCard = ({ item }: { item: Chef }) => {
    const href = { pathname: "/chef/[id]", params: { id: normalizeId(item.id) } };
    return (
      <Link href={href} asChild>
        <TouchableOpacity
          activeOpacity={0.9}
          style={{
            width: cardW,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            borderRadius: 16,
            padding: 12,
            margin: 8,
          }}
        >
          <Image
            source={{ uri: getAvatar(item) }}
            style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 10 }}
          />
          <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 18 }}>{item.name}</Text>
          {!!item.location && <Text style={{ color: "#a8b3cf", marginTop: 4 }}>{item.location}</Text>}
          {!!item.rating && (
            <Text style={{ color: theme.colors.primary, marginTop: 8, fontWeight: "900" }}>
              ★ {Number(item.rating).toFixed(1)}
            </Text>
          )}
        </TouchableOpacity>
      </Link>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, paddingTop: 16 }}>
      <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 12 }}>
        <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 24, marginBottom: 12 }}>Top Chefs</Text>
        <FlatList
          contentContainerStyle={{ alignItems: "center" }}
          data={chefs}
          keyExtractor={(c, i) => `${normalizeId(c.id)}-${i}`}
          renderItem={renderCard}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}
