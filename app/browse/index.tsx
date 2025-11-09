import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { theme } from "../../lib/theme";
import { useResponsiveColumns } from "../../utils/responsive";
import { supabase } from "../../lib/supabase";
import { Screen } from "../../components/Screen";
import { getDishRatings, getChefById } from "../../lib/db";
import type { Dish } from "../../lib/types";
import { safeToFixed, toNumber } from "../../lib/number";

// Colors from HTML design
const PRIMARY_COLOR = '#17cfa1';
const BACKGROUND_LIGHT = '#f6f8f7';
const TEXT_DARK = '#18181b';
const TEXT_MUTED = '#71717a';
const TEXT_GRAY = '#6b7280';
const BORDER_LIGHT = 'rgba(23, 207, 161, 0.2)';

const LIMIT = 24;

type SortOption = 'rating' | 'alphabetical';

export default function BrowsePage() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishRatings, setDishRatings] = useState<Map<number, { avg: number; count: number }>>(new Map());
  const [chefNames, setChefNames] = useState<Map<number, string>>(new Map());
  const [search, setSearch] = useState(params.q || "");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const { width } = useResponsiveColumns();
  
  // Calculate columns based on width
  const getColumns = () => {
    if (width >= 1280) return 4; // xl
    if (width >= 1024) return 3; // lg
    if (width >= 640) return 2;  // sm
    return 1; // mobile
  };
  const columns = getColumns();

  // Load dishes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const offset = (page - 1) * LIMIT;
      
      let query = supabase
        .from("dishes")
        .select("id,name,image,price,chef,chef_id,category")
        .order("id", { ascending: false });

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%,chef.ilike.%${search.trim()}%`);
      }

      query = query.range(offset, offset + LIMIT - 1);

      const { data, error } = await query;
      if (!mounted) return;
      
      if (error) {
        console.error("Error loading dishes:", error);
        setLoading(false);
        return;
      }

      const dishesData = (data || []) as Dish[];
      
      if (page === 1) {
        setDishes(dishesData);
      } else {
        setDishes(prev => [...prev, ...dishesData]);
      }

      // Load ratings for all dishes
      const ratingsMap = new Map<number, { avg: number; count: number }>();
      for (const dish of dishesData) {
        const stats = await getDishRatings(dish.id);
        ratingsMap.set(dish.id, stats);
      }
      setDishRatings(prev => new Map([...prev, ...ratingsMap]));

      // Load chef names
      const chefIds = [...new Set(dishesData.map(d => d.chef_id).filter(Boolean))];
      const namesMap = new Map<number, string>();
      for (const chefId of chefIds) {
        const chef = await getChefById(Number(chefId));
        if (chef) {
          namesMap.set(Number(chefId), chef.name);
        }
      }
      setChefNames(prev => new Map([...prev, ...namesMap]));

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [page, search]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
    setDishes([]);
    setDishRatings(new Map());
    setChefNames(new Map());
  }, [search]);

  // Sort dishes
  const sortedDishes = React.useMemo(() => {
    const sorted = [...dishes];
    if (sortBy === 'rating') {
      sorted.sort((a, b) => {
        const aRating = toNumber(dishRatings.get(a.id)?.avg, 0);
        const bRating = toNumber(dishRatings.get(b.id)?.avg, 0);
        return bRating - aRating;
      });
    } else if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return sorted;
  }, [dishes, sortBy, dishRatings]);

  const cardW = width < 640 
    ? width - 48 
    : width < 1024 
      ? (width - 64) / 2 
      : width < 1280
        ? (width - 96) / 3
        : Math.min(280, (width - 128) / 4);

  const DishCard = ({ item }: { item: Dish }) => {
    const rating = dishRatings.get(item.id);
    const chefName = item.chef_id ? chefNames.get(Number(item.chef_id)) || item.chef : item.chef;
    
    // Flatten style array to object for web compatibility
    const cardStyle = StyleSheet.flatten([styles.dishCard, { width: cardW }]);
    
    return (
      <Link href={{ pathname: "/dish/[id]", params: { id: String(item.id) } }} asChild>
        <TouchableOpacity
          activeOpacity={0.9}
          style={cardStyle}
        >
          <Image
            source={{ uri: item.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80" }}
            style={styles.dishImage}
            resizeMode="cover"
          />
          <View style={styles.dishCardContent}>
            <Text style={styles.dishName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.dishInfo} numberOfLines={1}>
              {chefName || 'Chef'} | ${safeToFixed(item.price, 2, '0.00')}
            </Text>
            {(() => {
              const avg = toNumber(rating?.avg, NaN);
              const count = toNumber(rating?.count, 0);
              const label = count > 0 ? safeToFixed(avg) : 'New';
              return count > 0 ? (
                <View style={styles.ratingContainer}>
                  <Text style={styles.starIcon}>★</Text>
                  <Text style={StyleSheet.flatten([styles.ratingText, { marginLeft: 4 }])}>{label}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </TouchableOpacity>
      </Link>
    );
  };

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={styles.container}>
        {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Explore Meals Near You</Text>
            </View>
            <Text style={styles.headerSubtitle}>Find your next favorite homemade dish</Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchIconContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search for dishes, chefs, or cuisines..."
              placeholderTextColor={TEXT_MUTED}
              style={styles.searchInput}
            />
          </View>

          {/* Sort Buttons */}
          <View style={styles.sortContainer}>
            <Text style={StyleSheet.flatten([styles.sortLabel, { marginRight: theme.spacing.sm }])}>Sort by:</Text>
            <TouchableOpacity
              style={StyleSheet.flatten([styles.sortButton, { marginRight: theme.spacing.sm }, sortBy === 'rating' && styles.sortButtonActive])}
              onPress={() => setSortBy('rating')}
            >
              <Text style={StyleSheet.flatten([styles.sortButtonText, sortBy === 'rating' && styles.sortButtonTextActive])}>
                Rating (High to Low)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={StyleSheet.flatten([styles.sortButton, sortBy === 'alphabetical' && styles.sortButtonActive])}
              onPress={() => setSortBy('alphabetical')}
            >
              <Text style={StyleSheet.flatten([styles.sortButtonText, sortBy === 'alphabetical' && styles.sortButtonTextActive])}>
                Alphabetically (A-Z)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dishes Grid */}
        {loading && dishes.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        ) : sortedDishes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search ? "No dishes found matching your search." : "No dishes available."}
            </Text>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={sortedDishes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <DishCard item={item} />}
            numColumns={columns}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            onEndReached={() => {
              if (!loading && dishes.length >= LIMIT * page) {
                setPage(p => p + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loading ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} style={{ marginVertical: 20 }} />
            ) : null}
          />
        )}

        {/* Pagination */}
        {dishes.length > 0 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={StyleSheet.flatten([styles.paginationButton, { marginRight: theme.spacing.xs }])}
              onPress={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <Text style={styles.paginationIcon}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={StyleSheet.flatten([styles.paginationPage, { marginRight: theme.spacing.xs }, page === 1 && styles.paginationPageActive])}
              onPress={() => setPage(1)}
            >
              <Text style={StyleSheet.flatten([styles.paginationPageText, page === 1 && styles.paginationPageTextActive])}>1</Text>
            </TouchableOpacity>
            {page > 1 && page < 10 && (
              <>
                <TouchableOpacity
                  style={StyleSheet.flatten([styles.paginationPage, { marginRight: theme.spacing.xs }, page === 2 && styles.paginationPageActive])}
                  onPress={() => setPage(2)}
                >
                  <Text style={StyleSheet.flatten([styles.paginationPageText, page === 2 && styles.paginationPageTextActive])}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={StyleSheet.flatten([styles.paginationPage, { marginRight: theme.spacing.xs }, page === 3 && styles.paginationPageActive])}
                  onPress={() => setPage(3)}
                >
                  <Text style={StyleSheet.flatten([styles.paginationPageText, page === 3 && styles.paginationPageTextActive])}>3</Text>
                </TouchableOpacity>
              </>
            )}
            {page < 10 && (
              <TouchableOpacity
                style={StyleSheet.flatten([styles.paginationPage, { marginRight: theme.spacing.xs }])}
                onPress={() => setPage(10)}
              >
                <Text style={styles.paginationPageText}>10</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.paginationButton}
              onPress={() => setPage(p => p + 1)}
              disabled={loading || dishes.length < LIMIT * page}
            >
              <Text style={styles.paginationIcon}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.md,
    }),
    paddingVertical: theme.spacing['2xl'],
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  headerTextContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    minWidth: 288,
  },
  headerTitle: {
    color: TEXT_DARK,
    fontSize: 36,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.033,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal,
    textAlign: 'center',
  },
  searchContainer: {
    width: '100%',
    maxWidth: 672,
    height: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  searchIconContainer: {
    backgroundColor: 'rgba(23, 207, 161, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: theme.spacing.md,
    paddingRight: 0,
  },
  searchIcon: {
    fontSize: 24,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(23, 207, 161, 0.2)',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  sortContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortLabel: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  sortButton: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(23, 207, 161, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  sortButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  sortButtonTextActive: {
    color: TEXT_DARK,
  },
  list: {
    flex: 1,
  },
  listContent: {
    alignItems: 'center',
    paddingBottom: theme.spacing['2xl'],
  },
  dishCard: {
    backgroundColor: BACKGROUND_LIGHT,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    margin: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dishImage: {
    width: '100%',
    height: undefined,
    ...Platform.select({
      web: {
        aspectRatio: '16/9',
      },
      default: {
        aspectRatio: 16 / 9,
      },
    }),
  },
  dishCardContent: {
    padding: theme.spacing.md,
  },
  dishName: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  dishInfo: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    marginBottom: theme.spacing.xs / 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs / 2,
  },
  starIcon: {
    fontSize: theme.typography.fontSize.base,
    color: '#fbbf24',
  },
  ratingText: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.sm,
  },
  loadingContainer: {
    flex: 1,
    padding: theme.spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: theme.spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing['2xl'],
    marginTop: theme.spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  paginationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationIcon: {
    color: TEXT_DARK,
    fontSize: 20,
  },
  paginationPage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationPageActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  paginationPageText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
  },
  paginationPageTextActive: {
    color: TEXT_DARK,
    fontWeight: theme.typography.fontWeight.bold,
  },
});
