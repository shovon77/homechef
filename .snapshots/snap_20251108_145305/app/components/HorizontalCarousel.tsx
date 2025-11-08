import React from "react";
import { View, Text, FlatList, TouchableOpacity, Image } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../constants/theme";
import { getChefAvatar } from "../../lib/avatars";

type Item = Record<string, any>;
type Props = {
  title: string;
  items: Item[];
  kind: "dish" | "chef";
  seeAllHref?: string;
};

export default function HorizontalCarousel({ title, items, kind, seeAllHref }: Props) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ paddingHorizontal: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: theme.colors.white, fontSize: 18, fontWeight: "800" }}>{title}</Text>
        {seeAllHref ? (
          <Link asChild href={seeAllHref}>
            <TouchableOpacity
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.focus,
              }}
            >
              <Text style={{ color: theme.colors.white, fontWeight: "700" }}>See all</Text>
            </TouchableOpacity>
          </Link>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={items || []}
        keyExtractor={(it, i) => String(it?.id ?? `${kind}-${i}`)}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={260}
        contentContainerStyle={{ paddingHorizontal: 6 }}
        renderItem={({ item }) => {
          const href = kind === "dish" ? `/dish/${item.id}` : `/chef/${item.id}`;
          const titleText = kind === "dish" ? item?.name ?? "Dish" : item?.name ?? "Chef";
          const subtitle = kind === "dish" ? (item?.chef ? `by ${item.chef}` : "—") : (item?.location ?? "—");
          const rating = Number(item?.rating ?? 0);

          const image = kind === "dish"
            ? (item?.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80")
            : (item?.photo || item?.avatar || getChefAvatar(titleText, 96)); // 👈 unique avatar per chef

          return (
            <Link asChild href={href}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  width: 248,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 16,
                  overflow: "hidden",
                  marginRight: 12,
                  borderWidth: 1,
                  borderColor: "#1f4f3f",
                  alignItems: "center",
                  paddingBottom: 10,
                }}
              >
                {kind === "chef" ? (
                  <View style={{ alignItems: "center", marginTop: 16 }}>
                    <Image
                      source={{ uri: image }}
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        borderWidth: 2,
                        borderColor: theme.colors.primary,
                        marginBottom: 10,
                      }}
                    />
                  </View>
                ) : (
                  <Image source={{ uri: image }} style={{ width: "100%", height: 140 }} />
                )}

                <View style={{ paddingHorizontal: 10, alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.white, fontWeight: "800", textAlign: "center" }}>
                    {titleText}
                  </Text>
                  <Text numberOfLines={1} style={{ color: theme.colors.muted, marginTop: 2, textAlign: "center" }}>
                    {subtitle}
                  </Text>
                  <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: "#FFD54F", fontWeight: "900" }}>★</Text>
                    <Text style={{ color: theme.colors.white, fontWeight: "700", marginLeft: 4 }}>
                      {rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Link>
          );
        }}
      />
    </View>
  );
}
