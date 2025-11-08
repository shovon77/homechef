import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../constants/theme";

type Chef = {
  id: number | string;
  name: string;
  photo?: string | null;
  avatar?: string | null;
  bio?: string | null;
  location?: string | null;
  rating?: number | null;
};

function Stars({ value = 0 }: { value?: number | null }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value || 0))));
  const full = "★".repeat(v);
  const empty = "☆".repeat(5 - v);
  return (
    <Text style={{ color: "#ffd166", fontWeight: "700", letterSpacing: 1 }}>
      {full}
      <Text style={{ color: "#94a3b8" }}>{empty}</Text>
      <Text style={{ color: "#94a3b8", marginLeft: 6 }}> ({Number(value || 0).toFixed(1)})</Text>
    </Text>
  );
}

export default function ChefCard({ chef }: { chef: Chef }) {
  const avatar =
    chef?.photo ||
    chef?.avatar ||
    `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}`;

  return (
    <Link href={`/chef/${chef.id}`} asChild>
      <TouchableOpacity activeOpacity={0.85}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          padding: 14,
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Image source={{ uri: avatar }} style={{ width: 64, height: 64, borderRadius: 32 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.white, fontSize: 18, fontWeight: "800" }}>
              {chef.name}
            </Text>
            <Text numberOfLines={1} style={{ color: "#9fb6a9", marginTop: 2 }}>
              {chef.location || "—"}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Stars value={chef.rating ?? 0} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}
