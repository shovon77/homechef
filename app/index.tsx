import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, StyleSheet, TextInput, Platform, useWindowDimensions, Animated, Easing } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme, elev } from "../lib/theme";
import Screen from "../components/Screen";
import { getDishRatings, getChefById } from "../lib/db";
import { safeToFixed, toNumber } from "../lib/number";
import { formatCad } from "../lib/money";

type Chef = Record<string, any>;
type Dish = { id: number; name: string; image?: string | null; price?: number | null; chef_id?: number | null; chef?: string | null };

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);

// Primary color from design: #2C4E4B
const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';

// Circular dish card for featured section
function CircularDishCard({ dish }: { dish: Dish }) {
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [chefInfo, setChefInfo] = useState<{ name?: string; photo?: string } | null>(null);

  useEffect(() => {
    let m = true;
    getDishRatings(Number(dish.id)).then((stats) => {
      if (m) setRating({ avg: stats.average, count: stats.count });
    });
    if (dish.chef_id) {
      getChefById(Number(dish.chef_id)).then((chef) => {
        if (m && chef) setChefInfo({ name: chef.name, photo: chef.photo || chef.avatar });
      });
    }
    return () => { m = false; };
  }, [dish.id, dish.chef_id]);

  const chefName = chefInfo?.name || dish.chef || 'Chef';

  return (
    <Link href={`/dish/${dish.id}`} asChild>
      <TouchableOpacity activeOpacity={0.9} style={styles.circularDishCard}>
        <View style={styles.circularDishImageContainer}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={styles.circularDishImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.circularDishInfo}>
          <Text style={styles.circularDishTitle} numberOfLines={1}>
            {dish.name} by {chefName}
          </Text>
          <Text style={styles.circularDishSubtitle} numberOfLines={1}>
            {formatCad(dish.price)} • ★ {safeToFixed(rating?.avg)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// Dish card matching HTML design
function HomeDishCard({ dish }: { dish: Dish }) {
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [chefInfo, setChefInfo] = useState<{ name?: string; photo?: string } | null>(null);

  useEffect(() => {
    let m = true;
    getDishRatings(Number(dish.id)).then((stats) => {
      if (m) setRating({ avg: stats.average, count: stats.count });
    });
    if (dish.chef_id) {
      getChefById(Number(dish.chef_id)).then((chef) => {
        if (m && chef) setChefInfo({ name: chef.name, photo: chef.photo || chef.avatar });
      });
    }
    return () => { m = false; };
  }, [dish.id, dish.chef_id]);

  const chefName = chefInfo?.name || dish.chef || 'Chef';
  const chefPhoto = chefInfo?.photo || `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(dish.chef_id || dish.id))}`;

  return (
    <Link href={`/dish/${dish.id}`} asChild>
      <TouchableOpacity activeOpacity={0.9} style={styles.dishCard}>
        <View style={styles.dishImageContainer}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={styles.dishImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.dishInfo}>
          <Text style={styles.dishName} numberOfLines={1}>{dish.name}</Text>
          <View style={styles.dishChefRow}>
            <Image
              source={{ uri: chefPhoto }}
              style={styles.chefAvatarSmall}
            />
            <Text style={styles.dishChefName} numberOfLines={1}>{chefName}</Text>
          </View>
          <View style={styles.dishFooter}>
            <Text style={styles.dishPrice}>{formatCad(dish.price)}</Text>
            <View style={styles.dishRating}>
              <Text style={styles.starIcon}>★</Text>
              <Text style={styles.ratingText}>{safeToFixed(rating?.avg)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollX = React.useRef(new Animated.Value(0)).current;

  const CARD_WIDTH = 240;
  const GAP = 24;
  const TOTAL_ITEM_WIDTH = CARD_WIDTH + GAP;

  // Create enough duplicates to fill screen and loop seamlessly
  const infiniteDishes = useMemo(() => {
    if (dishes.length === 0) return [];
    // Ensure we have enough items to fill the screen width + buffer
    // 6 copies is usually safe
    return [...dishes, ...dishes, ...dishes, ...dishes, ...dishes, ...dishes];
  }, [dishes]);

  useEffect(() => {
    if (dishes.length === 0) return;
    
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -(dishes.length * TOTAL_ITEM_WIDTH),
        duration: dishes.length * 6000, // Slower: 6s per item
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    
    return () => animation.stop();
  }, [dishes.length, scrollX, TOTAL_ITEM_WIDTH]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: d }] = await Promise.all([
        // Show only featured chefs on homepage, ordered by rating
        supabase.from("chefs").select("*").eq("featured", true).order("rating", { ascending: false }).limit(5),
        supabase.from("dishes").select("id,name,image,price,chef_id,chef").order("id", { ascending: false }).limit(8),
      ]);
      if (!mounted) return;
      setChefs((c || []) as Chef[]);
      setDishes((d || []) as Dish[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: "/browse",
        params: { q: searchQuery.trim() },
      });
    } else {
      router.push("/browse");
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F0EF' }}>
    <Screen 
      contentPadding={0}
      style={{ backgroundColor: '#F2F0EF' }}
      fixedFooterHeight={Platform.select({
        web: 100,
        default: 80,
      })}
    >
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          {/* Hero section - matches HTML design */}
          <View style={[styles.hero, isMobile && styles.heroMobile]}>
            <Image
              source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCvaMIyS8SnO_Cv8rsakKzzeevi_5ZMvJ-s-7_Ex52zv-wcN7sP-9pra9fhdBPSOgbcpv6OhmyP5atDXUERJXJ41g-zpV8yzvkLGWU6HC3CKyhdMfsrrPDYZjPW03dbcH6-h7mYXuOZId16eciMoAyZ6dJGG-S1amRb23hQCz7zUeEXiDxiZoGWheTe6UPP-VdMm1tAIZJxTvtqXmVBu8l6hp3-W6REKdmdaZl16sSMuOw7Vw7k82QwbHVZalpFexATBa4dyvn3UXhT" }}
              style={styles.heroBackgroundImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]} adjustsFontSizeToFit>
                Authentic Homemade Meals.
              </Text>
              <Text style={[styles.heroSubtitle, isMobile && styles.heroSubtitleMobile]}>
                Discover and order from the best home chefs in your neighborhood.
              </Text>
            </View>
          </View>

          {/* Featured Dishes section - Infinite Scroll */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Featured Dishes</Text>
            <View style={{ overflow: 'hidden', width: '100%' }}>
              <Animated.View 
                style={{ 
                  flexDirection: 'row', 
                  gap: GAP,
                  paddingHorizontal: GAP / 2,
                  transform: [{ translateX: scrollX }],
                  width: infiniteDishes.length * TOTAL_ITEM_WIDTH,
                }}
              >
                {infiniteDishes.map((dish, index) => (
                  <View key={`${dish.id}-${index}`} style={{ width: CARD_WIDTH }}>
                    <CircularDishCard dish={dish} />
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>

          {/* How It Works section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>How It Works</Text>
            <View style={[styles.howItWorksGrid, isMobile && styles.howItWorksGridMobile]}>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Text style={styles.howItWorksIcon}>🔍</Text>
                </View>
                <Text style={styles.howItWorksTitle}>1. Discover</Text>
                <Text style={styles.howItWorksText}>
                  Browse authentic dishes made by talented home chefs in your local area.
                </Text>
              </View>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Text style={styles.howItWorksIcon}>🛒</Text>
                </View>
                <Text style={styles.howItWorksTitle}>2. Order</Text>
                <Text style={styles.howItWorksText}>
                  Select your meal, customize your order, and schedule a delivery time that works for you.
                </Text>
              </View>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Text style={styles.howItWorksIcon}>🍽️</Text>
                </View>
                <Text style={styles.howItWorksTitle}>3. Enjoy</Text>
                <Text style={styles.howItWorksText}>
                  Receive your delicious, freshly prepared homemade meal right at your doorstep.
                </Text>
              </View>
            </View>
          </View>

          {/* Featured Chefs section - matches HTML design */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Featured Chefs</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {chefs.map((chef, i) => (
                <View key={`${normalizeId(chef.id)}-${i}`} style={styles.featuredChefCardWrapper}>
                  <Link href={{ pathname: "/chef/[id]", params: { id: normalizeId(chef.id) } }} asChild>
                    <TouchableOpacity activeOpacity={0.9} style={styles.featuredChefCard}>
                      <Image
                        source={{ uri: chef?.photo || chef?.avatar || `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}` }}
                        style={styles.featuredChefAvatar}
                      />
                      <Text style={styles.featuredChefName}>{chef.name}</Text>
                      <Text style={styles.featuredChefCuisine}>{chef.cuisine || 'Chef'}</Text>
                      {chef.location && (
                        <Text style={styles.featuredChefLocation} numberOfLines={1}>
                          📍 {chef.location}
                        </Text>
                      )}
                      <View style={styles.featuredChefRating}>
                        <Text style={styles.starIcon}>★</Text>
                        <Text style={styles.ratingText}>{safeToFixed(toNumber(chef?.rating, 0))}</Text>
                      </View>
                    </TouchableOpacity>
                  </Link>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Screen>

      {/* Floating Search Bar - fixed at bottom of viewport */}
      <View style={styles.floatingSearchContainer}>
        <View style={styles.floatingSearchBar}>
          <View style={styles.searchIconContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
            <TextInput
              placeholder="Search biryani"
              placeholderTextColor="#555555"
              style={styles.floatingSearchInput}
              value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Text style={styles.searchButtonText}>{isMobile ? "Search" : "Find Food"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "center",
    paddingHorizontal: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.md,
    }),
    paddingTop: theme.spacing.lg,
    paddingBottom: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing['2xl'],
    }),
    backgroundColor: '#F2F0EF',
  },
  // Hero section
  hero: {
    minHeight: Platform.select({
      web: 275,
      default: 240,
    }),
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    marginBottom: theme.spacing['3xl'],
    position: "relative",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  heroBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  heroContent: {
    alignItems: "center",
    gap: theme.spacing.md,
    maxWidth: 672,
    zIndex: 2,
    position: "relative",
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: Platform.select({
      web: 42,
      default: 28,
    }),
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: Platform.select({
      web: 42 * 1.2,
      default: 28 * 1.2,
    }),
    letterSpacing: -0.033,
    textAlign: "center",
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: Platform.select({
      web: theme.typography.fontSize.base,
      default: theme.typography.fontSize.sm,
    }),
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: Platform.select({
      web: theme.typography.fontSize.base * 1.5,
      default: theme.typography.fontSize.sm * 1.5,
    }),
    textAlign: "center",
  },
  floatingSearchContainer: {
    position: "absolute",
    bottom: Platform.select({
      web: theme.spacing['2xl'],
      default: theme.spacing.xl,
    }),
    left: 0,
    right: 0,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    zIndex: 1000,
    elevation: 1000, // for android
    pointerEvents: "box-none",
  },
  floatingSearchBar: {
    flexDirection: "row",
    alignItems: "stretch",
    height: Platform.select({
      web: 64,
      default: 56,
    }),
    borderRadius: 9999, // rounded-full
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    ...elev('xl'),
    overflow: "hidden",
    width: "100%",
    maxWidth: Platform.select({
      web: 580,
      default: '100%',
    }),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  floatingSearchInput: {
    flex: 1,
    color: '#333333',
    fontSize: Platform.select({
      web: theme.typography.fontSize.base,
      default: theme.typography.fontSize.sm,
    }),
    paddingVertical: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.sm,
    }),
    paddingHorizontal: theme.spacing.sm,
  },
  searchIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 20,
    color: '#555555',
  },
  searchInput: {
    flex: 1,
    color: '#333333',
    fontSize: Platform.select({
      web: theme.typography.fontSize.base,
      default: theme.typography.fontSize.sm,
    }),
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  searchButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Platform.select({
      web: theme.spacing.lg,
      default: theme.spacing.md,
    }),
    paddingRight: Platform.select({
      web: theme.spacing.lg,
      default: theme.spacing.md,
    }),
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 9999,
    height: Platform.select({
      web: 48,
      default: 40,
    }),
    margin: Platform.select({
      web: 8,
      default: 6,
    }),
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  // Sections
  section: {
    marginBottom: theme.spacing['3xl'],
  },
  sectionTitle: {
    color: '#333333',
    fontSize: Platform.select({
      web: 30,
      default: 22,
    }),
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: -0.015,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  // Featured Dishes
  horizontalScrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  dishCardWrapper: {
    width: 288, // w-72
    flexShrink: 0,
  },
  dishCard: {
    flex: 1,
    gap: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    ...elev('md'),
  },
  dishImageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: theme.radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
  },
  dishImage: {
    width: "100%",
    height: "100%",
  },
  dishInfo: {
    padding: theme.spacing.md,
    paddingTop: 0,
    gap: theme.spacing.md,
    flex: 1,
    justifyContent: "space-between",
  },
  dishName: {
    color: '#333333',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.fontSize.lg * 1.5,
  },
  dishChefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  chefAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  dishChefName: {
    color: '#555555',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  dishFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.md,
  },
  dishPrice: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
  },
  dishRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs / 2,
  },
  starIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: ACCENT_COLOR,
  },
  ratingText: {
    color: '#555555',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  // How It Works
  howItWorksGrid: {
    flexDirection: Platform.select({
      web: "row",
      default: "column",
    }),
    gap: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.md,
  },
  howItWorksCard: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing['2xl'],
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    textAlign: "center",
  },
  howItWorksIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${PRIMARY_COLOR}33`, // primary/20
    justifyContent: "center",
    alignItems: "center",
  },
  howItWorksIcon: {
    fontSize: 32,
  },
  howItWorksTitle: {
    color: '#333333',
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
  },
  howItWorksText: {
    color: '#555555',
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.5,
    textAlign: "center",
  },
  // Featured Chefs
  featuredChefCardWrapper: {
    width: 192, // w-48
    flexShrink: 0,
  },
  featuredChefCard: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing['2xl'],
    backgroundColor: '#F4F4F4',
    borderRadius: theme.radius.xl,
    textAlign: "center",
  },
  featuredChefAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: `${PRIMARY_COLOR}80`, // primary/50
  },
  featuredChefName: {
    color: '#333333',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
  },
  featuredChefCuisine: {
    color: '#555555',
    fontSize: theme.typography.fontSize.sm,
  },
  featuredChefLocation: {
    color: '#777777',
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs / 2,
    textAlign: 'center',
  },
  featuredChefRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs / 2,
    marginTop: theme.spacing.sm,
  },
  // Mobile Styles
  containerMobile: {
    paddingHorizontal: theme.spacing.md,
  },
  heroMobile: {
    minHeight: 200,
    padding: theme.spacing.sm,
  },
  heroTitleMobile: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroSubtitleMobile: {
    fontSize: theme.typography.fontSize.sm,
  },
  sectionTitleMobile: {
    fontSize: 24,
    paddingHorizontal: 0,
  },
  howItWorksGridMobile: {
    flexDirection: "column",
    gap: theme.spacing.lg,
  },
  // Circular Dish Card
  circularDishCard: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  circularDishImageContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    ...elev('md'),
    backgroundColor: '#fff',
  },
  circularDishImage: {
    width: '100%',
    height: '100%',
  },
  circularDishInfo: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
    paddingHorizontal: 8,
  },
  circularDishTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  circularDishSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
