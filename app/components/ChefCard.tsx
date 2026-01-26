import React from "react";
import { View, Text, Image, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../lib/theme";
import { toNumber, safeToFixed } from "../../lib/number";

// Helper function to format cuisine type
const formatCuisine = (cuisine: any): string => {
  if (!cuisine) return 'Chef';
  
  // If it's already a string (comma-separated), return it
  if (typeof cuisine === 'string') {
    // Check if it's a JSON string
    if (cuisine.trim().startsWith('[') || cuisine.trim().startsWith('"')) {
      try {
        const parsed = JSON.parse(cuisine);
        if (Array.isArray(parsed)) {
          return parsed.join(', ');
        }
        return String(parsed);
      } catch {
        // If parsing fails, treat as regular string
        return cuisine;
      }
    }
    return cuisine;
  }
  
  // If it's an array, join it
  if (Array.isArray(cuisine)) {
    return cuisine.join(', ');
  }
  
  return 'Chef';
};

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

  const ratingVal = toNumber(chef?.rating, 0);

  return (
    <View style={[styles.card, style]}>
      <Link href={`/chef/${chef.id}`} asChild>
        <Pressable style={styles.pressable} activeOpacity={0.9}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={[styles.name, nameColor ? { color: nameColor } : undefined]} numberOfLines={1}>{chef.name}</Text>
            <Text style={styles.cuisine} numberOfLines={1}>{formatCuisine(chef.cuisine)}</Text>
          {chef.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
              <Image 
                source={require('../../assets/locationnewicon.png')} 
                style={{ width: 16, height: 16, tintColor: '#FE734C' }} 
                resizeMode="contain" 
              />
              <Text style={[styles.location, { marginTop: 0 }]} numberOfLines={1}>
                {chef.location?.split(',')[0]}
              </Text>
            </View>
          )}
            {ratingVal > 0 && (
          <View style={styles.rating}>
            <Text style={[styles.starIcon, ratingColor ? { color: ratingColor } : undefined]}>★</Text>
                <Text style={styles.ratingText}>{safeToFixed(ratingVal)}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: "100%",
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  info: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
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
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 2,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs / 2,
    marginTop: 4,
  },
  starIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: ACCENT_COLOR,
  },
  ratingText: {
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
