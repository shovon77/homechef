import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from "react-native";
import { Link } from "expo-router";
import { theme } from "../constants/theme";
import { useResponsiveColumns } from "../utils/responsive";
import { getChefsPaginated } from "../lib/db";
import { Screen } from "../components/Screen";
import type { Chef } from "../lib/types";

const getAvatar = (c: Chef) => c.photo || "https://i.pravatar.cc/200?img=12";

export default function ChefsPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { width, getColumns } = useResponsiveColumns();
  const columns = getColumns(3);
  const LIMIT = 24;
  
  const cardW = width < 768 ? width - 48 : width < 1024 ? (width - 64) / 2 : Math.min(360, (width - 96) / columns);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const offset = (page - 1) * LIMIT;
      const data = await getChefsPaginated({ search: search.trim() || undefined, limit: LIMIT, offset });
      if (!mounted) return;
      if (page === 1) {
        setChefs(data);
      } else {
        setChefs(prev => [...prev, ...data]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [page, search]);

  const renderCard = ({ item }: { item: Chef }) => {
    const href = { pathname: "/chef/[id]", params: { id: String(item.id) } };
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

  if (loading && chefs.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, width: "100%", maxWidth: 1200, alignSelf: "center" }}>
        {/* Fixed header */}
        <View style={{ padding: 16, paddingBottom: 12 }}>
          <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 24, marginBottom: 12 }}>Top Chefs</Text>
          <TextInput
            value={search}
            onChangeText={(text) => { setSearch(text); setPage(1); }}
            placeholder="Search chefs by name or location..."
            placeholderTextColor={theme.colors.textMuted}
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: 12,
              color: theme.colors.text,
              fontSize: 14,
            }}
          />
        </View>

        {/* Scrollable list */}
        {chefs.length === 0 && !loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Text style={{ color: theme.colors.textMuted }}>
              {search ? "No chefs found matching your search." : "No chefs available."}
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: 32 }}
            data={chefs}
            keyExtractor={(c) => String(c.id)}
            renderItem={renderCard}
            numColumns={columns}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            onEndReached={() => {
              if (!loading && chefs.length >= LIMIT * page) {
                setPage(p => p + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loading ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} /> : null}
          />
        )}
      </View>
    </Screen>
  );
}
