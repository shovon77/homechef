import React, { useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../constants/theme";
import { useResponsiveColumns } from "../../utils/responsive";
import { getChefsPaginated } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { Tabs } from "../../components/Tabs";
import { Screen } from "../../components/Screen";
import type { Chef, Dish } from "../../lib/types";

const LIMIT = 24;

export default function BrowsePage() {
  const [activeTab, setActiveTab] = useState<"dishes" | "chefs">("dishes");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [search, setSearch] = useState("");
  const [dishesPage, setDishesPage] = useState(1);
  const [chefsPage, setChefsPage] = useState(1);
  const [dishesLoading, setDishesLoading] = useState(true);
  const [chefsLoading, setChefsLoading] = useState(true);
  const { width, getColumns } = useResponsiveColumns();
  const columns = getColumns(3);

  // Load dishes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setDishesLoading(true);
      const offset = (dishesPage - 1) * LIMIT;
      
      let query = supabase
        .from("dishes")
        .select("id,name,image,price,chef,chef_id,category")
        .order("id", { ascending: false });

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`);
      }

      query = query.range(offset, offset + LIMIT - 1);

      const { data, error } = await query;
      if (!mounted) return;
      
      if (error) {
        console.error("Error loading dishes:", error);
      } else {
        if (dishesPage === 1) {
          setDishes((data || []) as Dish[]);
        } else {
          setDishes(prev => [...prev, ...(data || [])]);
        }
      }
      setDishesLoading(false);
    })();
    return () => { mounted = false; };
  }, [dishesPage, search]);

  // Load chefs
  useEffect(() => {
    let mounted = true;
    (async () => {
      setChefsLoading(true);
      const offset = (chefsPage - 1) * LIMIT;
      const data = await getChefsPaginated({ 
        search: search.trim() || undefined, 
        limit: LIMIT, 
        offset 
      });
      if (!mounted) return;
      
      if (chefsPage === 1) {
        setChefs(data);
      } else {
        setChefs(prev => [...prev, ...data]);
      }
      setChefsLoading(false);
    })();
    return () => { mounted = false; };
  }, [chefsPage, search]);

  // Reset pages when search changes
  useEffect(() => {
    setDishesPage(1);
    setChefsPage(1);
  }, [search]);

  const cardW = width < 768 ? width - 48 : width < 1024 ? (width - 64) / 2 : Math.min(360, (width - 96) / columns);

  const DishCard = ({ item }: { item: Dish }) => (
    <Link href={{ pathname: "/dish/[id]", params: { id: String(item.id) } }} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          width: cardW,
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          margin: 8,
        }}
      >
        <Image
          source={{ uri: item.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80" }}
          style={{ width: "100%", height: 160 }}
        />
        <View style={{ padding: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
            {item.name}
          </Text>
          {item.chef && (
            <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 14 }} numberOfLines={1}>
              by {item.chef}
            </Text>
          )}
          <Text style={{ color: theme.colors.primary, fontWeight: "900", marginTop: 6, fontSize: 16 }}>
            ${(item.price || 0).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );

  const ChefCard = ({ item }: { item: Chef }) => (
    <Link href={{ pathname: "/chef/[id]", params: { id: String(item.id) } }} asChild>
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
          source={{ uri: item.photo || "https://i.pravatar.cc/200?img=12" }}
          style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 10 }}
        />
        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18 }}>{item.name}</Text>
        {item.location && <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 14 }}>{item.location}</Text>}
        {item.rating && (
          <Text style={{ color: theme.colors.primary, marginTop: 8, fontWeight: "900", fontSize: 14 }}>
            ★ {Number(item.rating).toFixed(1)}
          </Text>
        )}
      </TouchableOpacity>
    </Link>
  );

  const DishesTab = (
    <>
      {dishesLoading && dishes.length === 0 ? (
        <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : dishes.length === 0 ? (
        <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.textMuted }}>
            {search ? "No dishes found matching your search." : "No dishes available."}
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: 32 }}
          data={dishes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <DishCard item={item} />}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onEndReached={() => {
            if (!dishesLoading && dishes.length >= LIMIT * dishesPage) {
              setDishesPage(p => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={dishesLoading ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} /> : null}
        />
      )}
    </>
  );

  const ChefsTab = (
    <>
      {chefsLoading && chefs.length === 0 ? (
        <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : chefs.length === 0 ? (
        <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.textMuted }}>
            {search ? "No chefs found matching your search." : "No chefs available."}
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: 32 }}
          data={chefs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ChefCard item={item} />}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onEndReached={() => {
            if (!chefsLoading && chefs.length >= LIMIT * chefsPage) {
              setChefsPage(p => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={chefsLoading ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} /> : null}
        />
      )}
    </>
  );

  return (
    <Screen>
      <View style={{ flex: 1, width: "100%", maxWidth: 1200, alignSelf: "center" }}>
        {/* Fixed header with search */}
        <View style={{ padding: 16, paddingBottom: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 28, marginBottom: 16 }}>Browse</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={activeTab === "dishes" ? "Search dishes by name or category..." : "Search chefs by name or location..."}
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

        {/* Tabs with scrollable content */}
        <View style={{ flex: 1 }}>
          <Tabs
            tabs={[
              { key: "dishes", title: "Dishes", content: DishesTab },
              { key: "chefs", title: "Chefs", content: ChefsTab },
            ]}
            initial={0}
            onTabChange={(key) => setActiveTab(key as "dishes" | "chefs")}
          />
        </View>
      </View>
    </Screen>
  );
}

