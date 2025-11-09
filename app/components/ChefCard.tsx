import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { theme, cardStyle } from "../../lib/theme";
import { Stars } from "../../components/ui/Stars";
import { toNumber } from "../../lib/number";

type Chef = {
  id: number | string;
  name: string;
  photo?: string | null;
  avatar?: string | null;
  bio?: string | null;
  location?: string | null;
  rating?: number | null;
};


export default function ChefCard({ chef }: { chef: Chef }) {
  const avatar =
    chef?.photo ||
    chef?.avatar ||
    `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}`;

  return (
    <Link href={`/chef/${chef.id}`} asChild>
      <TouchableOpacity activeOpacity={0.85} style={[styles.card, cardStyle()]}>
        <View style={styles.container}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.name}>
              {chef.name}
            </Text>
            <Text numberOfLines={1} style={styles.location}>
              {chef.location || "—"}
            </Text>
            <View style={styles.rating}>
              <Stars value={toNumber(chef?.rating, 0)} size={16} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
  },
  container: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  location: {
    color: theme.colors.subtle,
    marginTop: theme.spacing.xs / 2,
    fontSize: theme.typography.fontSize.sm,
  },
  rating: {
    marginTop: theme.spacing.sm,
  },
});
