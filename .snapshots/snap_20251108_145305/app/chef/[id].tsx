import React, { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";
import { useResponsiveColumns } from "../../utils/responsive";

type Chef = { id: number | string; name: string; photo?: string | null; avatar?: string | null; bio?: string | null; location?: string | null; rating?: number | null; };

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);

export default function ChefDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chefId = normalizeId(id);
  const [chef, setChef] = useState<Chef | null>(null);
  const [loading, setLoading] = useState(true);
  const { width } = useResponsiveColumns();
  const isMobile = width < 768;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chefs")
        .select("id,name,photo,bio,location,rating")
        .eq("id", chefId)
        .single();
      if (!mounted) return;
      if (error) console.log("chef fetch error", error);
      setChef(data as any);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [chefId]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  if (!chef) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.colors.white }}>Chef not found.</Text></View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ maxWidth: 1100, width: "100%", alignSelf: "center", padding: 16 }}>
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 14 }}>
          <View style={{ flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: isMobile ? "center" : "flex-start" }}>
            <Image
              source={{ uri: ((chef.photo || chef.avatar || chef.image)||(chef.photo || chef.avatar || chef.image)) || "https://i.pravatar.cc/200?img=15" }}
              style={{ width: isMobile ? 120 : 140, height: isMobile ? 120 : 140, borderRadius: 14, alignSelf: isMobile ? "center" : "flex-start" }}
            />
            <View style={{ flex: 1, alignItems: isMobile ? "center" : "flex-start" }}>
              <Text style={{ color: theme.colors.white, fontSize: 24, fontWeight: "900" }}>{chef.name}</Text>
              {!!chef.location && <Text style={{ color: "#a8b3cf", marginTop: 4 }}>{chef.location}</Text>}
              {!!chef.rating && (
                <Text style={{ color: theme.colors.primary, marginTop: 8, fontWeight: "900" }}>
                  ★ {chef.rating.toFixed(1)}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <Link href={{ pathname: "/chef/[id]/reviews", params: { id: chefId } }} asChild>
                  <TouchableOpacity style={{ backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}>
                    <Text style={{ color: theme.colors.white, fontWeight: "900" }}>Write a review</Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/chefs" asChild>
                  <TouchableOpacity style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}>
                    <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>Back to list</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
          {!!chef.bio && <Text style={{ color: "#cbd5e1", marginTop: 14 }}>{chef.bio}</Text>}
        </View>
      </View>
    </ScrollView>
  );
}
