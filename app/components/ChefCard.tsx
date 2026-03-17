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

// Show only city and state (e.g. "Toronto, ON"). Handles "York, Toronto, ON" or "Street, York, Toronto, ON, Canada"
const formatLocationCityState = (location: string | null | undefined): string => {
  if (!location?.trim()) return '';
  const parts = location.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  // Last part is likely country (e.g. "Canada") when it's longer than 2 chars — then take the two before it (city, state)
  if (parts.length >= 3 && parts[parts.length - 1].length > 2) {
    return parts.slice(-3, -1).join(', ');
  }
  // Otherwise take last two parts (city, state) e.g. "York, Toronto, ON" -> "Toronto, ON"
  return parts.slice(-2).join(', ');
};

const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';
const BRAND_BLACK = '#33393A';

type Chef = {
  id: number | string;
  slug?: string | null;
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
  distanceKm?: number | null;
  hideBio?: boolean;
  metaVariant?: 'default' | 'homepage';
  /** Compact layout for grid (e.g. explore page desktop/tablet). Smaller avatar and typography. */
  compact?: boolean;
};

export default function ChefCard({ chef, style, nameColor, ratingColor, distanceKm, hideBio, metaVariant = 'default', compact = false }: Props) {
  const avatar =
    chef?.photo ||
    chef?.avatar ||
    `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}`;

  const ratingVal = toNumber(chef?.rating, 0);
  const starTint = ratingColor ?? ACCENT_COLOR;
  const metaTint = ratingColor ?? '#FE734C';
  const showDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0;
  const distanceText = showDistance
    ? (metaVariant === 'homepage'
        ? (distanceKm > 10 ? '>10 km' : distanceKm < 1 ? '<1 km' : `${Number(distanceKm).toFixed(1)} km`)
        : `${Number(distanceKm).toFixed(1)} km`)
    : '';
  const locationText = chef.location ? formatLocationCityState(chef.location) : '';
  const showLocation = !!locationText;

  // Flatten style arrays so DOM (e.g. Link > Pressable on web) never receives numeric keys
  const cardStyle = StyleSheet.flatten([styles.card, style]);
  const pressableStyle = StyleSheet.flatten([styles.pressable, compact && styles.pressableCompact]);
  const avatarStyle = StyleSheet.flatten([styles.avatar, compact && styles.avatarCompact]);
  const infoStyle = StyleSheet.flatten([styles.info, compact && styles.infoCompact]);

  return (
    <View style={cardStyle}>
      <Link href={`/chef/${chef.slug ?? chef.id}`} asChild>
        <Pressable style={pressableStyle} activeOpacity={0.9}>
          <Image source={{ uri: avatar }} style={avatarStyle} resizeMode="cover" />
          <View style={infoStyle}>
            <Text style={StyleSheet.flatten([styles.name, compact && styles.nameCompact, nameColor ? { color: nameColor } : undefined])} numberOfLines={1}>{chef.name}</Text>
            <Text style={StyleSheet.flatten([styles.cuisine, compact && styles.cuisineCompact])} numberOfLines={1}>{formatCuisine(chef.cuisine)}</Text>
            {chef.bio && !hideBio && (
              <Text style={StyleSheet.flatten([styles.bio, compact && styles.bioCompact])} numberOfLines={2}>{chef.bio}</Text>
            )}
            {metaVariant === 'homepage' ? (
              <>
                {ratingVal > 0 && (
                  <View style={styles.rating}>
                    <Image 
                      source={require('../../assets/star.png')} 
                      style={[styles.starIconImage, compact && styles.starIconImageCompact]}
                      tintColor={starTint}
                      resizeMode="contain" 
                    />
                    <Text style={[styles.ratingText, compact && styles.ratingTextCompact]}>{safeToFixed(ratingVal)}</Text>
                  </View>
                )}
                {showDistance && (
                  <View style={styles.distanceRow}>
                    <Image
                      source={require('../../assets/map.png')}
                      style={[styles.metaIconImage, compact && styles.metaIconImageCompact]}
                      tintColor={metaTint}
                      resizeMode="contain"
                    />
                    <Text style={[styles.distanceText, compact && styles.ratingTextCompact]}>{distanceText}</Text>
                  </View>
                )}
                {showLocation && (
                  <View style={styles.locationRow}>
                    <Image 
                      source={require('../../assets/locationnewicon.png')} 
                      style={[styles.metaIconImage, compact && styles.metaIconImageCompact]}
                      tintColor={metaTint}
                      resizeMode="contain" 
                    />
                    <Text style={[styles.location, compact && styles.locationCompact]} numberOfLines={1}>
                      {locationText}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {showLocation && (
                  <View style={styles.locationRow}>
                    <Image 
                      source={require('../../assets/locationnewicon.png')} 
                      style={[styles.metaIconImage, compact && styles.metaIconImageCompact]}
                      tintColor={metaTint}
                      resizeMode="contain" 
                    />
                    <Text style={[styles.location, compact && styles.locationCompact]} numberOfLines={1}>
                      {locationText}
                    </Text>
                  </View>
                )}
                {(ratingVal > 0 || showDistance) && (
                  <View style={styles.ratingAndDistanceRow}>
                    {ratingVal > 0 && (
                      <View style={styles.rating}>
                        <Image 
                          source={require('../../assets/star.png')} 
                          style={[styles.starIconImage, compact && styles.starIconImageCompact]}
                          tintColor={starTint}
                          resizeMode="contain" 
                        />
                        <Text style={[styles.ratingText, compact && styles.ratingTextCompact]}>{safeToFixed(ratingVal)}</Text>
                      </View>
                    )}
                    {showDistance && (
                      <View style={styles.distanceInline}>
                        <Image
                          source={require('../../assets/map.png')}
                          style={[styles.metaIconImage, compact && styles.metaIconImageCompact]}
                          tintColor={metaTint}
                          resizeMode="contain"
                        />
                        <Text style={[styles.distanceText, compact && styles.ratingTextCompact]}>{distanceText}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
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
    minHeight: 140,
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    width: "100%",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: theme.spacing.md,
    gap: 0,
    minHeight: 140,
  },
  avatar: {
    width: 140,
    height: 140,
    borderTopLeftRadius: theme.radius.xl,
    borderBottomLeftRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  info: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingLeft: theme.spacing.md,
  },
  name: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cuisine: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  bio: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  location: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  ratingAndDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: ACCENT_COLOR,
  },
  starIconImage: {
    width: 18,
    height: 18,
  },
  metaIconImage: {
    width: 18,
    height: 18,
  },
  ratingText: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distanceText: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
  },
  // Compact variant (explore grid desktop/tablet)
  pressableCompact: {
    paddingRight: theme.spacing.sm,
    minHeight: 88,
  },
  avatarCompact: {
    width: 88,
    height: 88,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  infoCompact: {
    gap: 2,
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
  },
  nameCompact: {
    fontSize: theme.typography.fontSize.sm,
  },
  cuisineCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  bioCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  locationCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  starIconImageCompact: {
    width: 14,
    height: 14,
  },
  metaIconImageCompact: {
    width: 14,
    height: 14,
  },
  ratingTextCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
});
