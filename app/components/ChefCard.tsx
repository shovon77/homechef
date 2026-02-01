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
};

export default function ChefCard({ chef, style, nameColor, ratingColor, distanceKm, hideBio, metaVariant = 'default' }: Props) {
  const avatar =
    chef?.photo ||
    chef?.avatar ||
    `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}`;

  const ratingVal = toNumber(chef?.rating, 0);
  const starTint = ratingColor ?? ACCENT_COLOR;
  const metaTint = ratingColor ?? '#FE734C';
  const showDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0;
  const distanceText = showDistance
    ? (distanceKm > 10
        ? '>10 km'
        : distanceKm < 1
          ? '<1 km'
          : `${distanceKm.toFixed(1)} km`)
    : '';
  const locationText = chef.location ? formatLocationCityState(chef.location) : '';
  const showLocation = !!locationText;

  return (
    <View style={[styles.card, style]}>
      <Link href={`/chef/${chef.id}`} asChild>
        <Pressable style={styles.pressable} activeOpacity={0.9}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={[styles.name, nameColor ? { color: nameColor } : undefined]} numberOfLines={1}>{chef.name}</Text>
            <Text style={styles.cuisine} numberOfLines={1}>{formatCuisine(chef.cuisine)}</Text>
            {chef.bio && !hideBio && (
              <Text style={styles.bio} numberOfLines={2}>{chef.bio}</Text>
            )}
            {metaVariant === 'homepage' ? (
              <>
                {ratingVal > 0 && (
                  <View style={styles.rating}>
                    <Image 
                      source={require('../../assets/star.png')} 
                      style={styles.starIconImage}
                      tintColor={starTint}
                      resizeMode="contain" 
                    />
                    <Text style={styles.ratingText}>{safeToFixed(ratingVal)}</Text>
                  </View>
                )}
                {showDistance && (
                  <View style={styles.distanceRow}>
                    <Image
                      source={require('../../assets/map.png')}
                      style={styles.metaIconImage}
                      tintColor={metaTint}
                      resizeMode="contain"
                    />
                    <Text style={styles.distanceText}>{distanceText}</Text>
                  </View>
                )}
                {showLocation && (
                  <View style={styles.locationRow}>
                    <Image 
                      source={require('../../assets/locationnewicon.png')} 
                      style={styles.metaIconImage}
                      tintColor={metaTint}
                      resizeMode="contain" 
                    />
                    <Text style={styles.location} numberOfLines={1}>
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
                      style={styles.metaIconImage}
                      tintColor={metaTint}
                      resizeMode="contain" 
                    />
                    <Text style={styles.location} numberOfLines={1}>
                      {locationText}
                    </Text>
                  </View>
                )}
                {ratingVal > 0 && (
                  <View style={styles.rating}>
                    <Image 
                      source={require('../../assets/star.png')} 
                      style={styles.starIconImage}
                      tintColor={starTint}
                      resizeMode="contain" 
                    />
                    <Text style={styles.ratingText}>{safeToFixed(ratingVal)}</Text>
                  </View>
                )}
                {showDistance && (
                  <View style={styles.distanceRow}>
                    <Image
                      source={require('../../assets/map.png')}
                      style={styles.metaIconImage}
                      tintColor={metaTint}
                      resizeMode="contain"
                    />
                    <Text style={styles.distanceText}>{distanceText}</Text>
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
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: "100%",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: theme.spacing.md,
    gap: 0,
  },
  avatar: {
    width: 140,
    alignSelf: 'stretch',
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
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
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
});
