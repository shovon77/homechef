import React from "react";
import { View, Text, Image, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../lib/theme";
import { toNumber, safeToFixed } from "../../lib/number";

const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';

type Chef = {
  id: number | string;
  name: string;
  photo?: string | null;
  avatar?: string | null;
  bio?: string | null;
  location?: string | null;
  rating?: number | null;
  cuisine?: string | null;
};

type Props = {
  chef: Chef;
  style?: StyleProp<ViewStyle>;
  nameColor?: string;
  ratingColor?: string;
};

export default function ChefCard({ chef, style, nameColor, ratingColor }: Props) {
  const avatar =
    chef?.photo ||
    chef?.avatar ||
    `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}`;

  return (
    <View style={[styles.card, style]}>
      <Link href={`/chef/${chef.id}`} asChild>
        <Pressable style={styles.pressable} activeOpacity={0.9}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <Text style={[styles.name, nameColor ? { color: nameColor } : undefined]}>{chef.name}</Text>
          <Text style={styles.cuisine}>{chef.cuisine || 'Chef'}</Text>
          {chef.location && (
            <Text style={styles.location} numberOfLines={1}>
              📍 {chef.location}
            </Text>
          )}
          <View style={styles.rating}>
            <Text style={[styles.starIcon, ratingColor ? { color: ratingColor } : undefined]}>★</Text>
            <Text style={styles.ratingText}>{safeToFixed(toNumber(chef?.rating, 0))}</Text>
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing['2xl'],
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    textAlign: "center",
  },
  pressable: {
    alignItems: "center",
    width: "100%",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: `${PRIMARY_COLOR}80`, // primary/50
  },
  name: {
    color: '#333333',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cuisine: {
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  location: {
    color: '#777777',
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs / 2,
    textAlign: 'center',
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs / 2,
    marginTop: theme.spacing.sm,
  },
  starIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: ACCENT_COLOR,
  },
  ratingText: {
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
