import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, useWindowDimensions, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import DishCard from '../components/DishCard';
import ChefCard from '../components/ChefCard';
import { theme, elev } from '../../lib/theme';
import { SortIcon } from '../../components/SortIcon';

const PER_PAGE = 25; // 5x5 grid layout
const GRID_COLUMNS = 5;
const PRIMARY_COLOR = '#2C4E4B';

type Dish = {
  id: number;
  name: string;
  price: number | null;
  image: string | null;
  chef_id: number | null;
  chefs?: { name: string | null } | null;
};

type Chef = {
  id: number;
  name: string;
  location: string | null;
  photo: string | null;
  rating: number | null;
  cuisine: string | null;
};

export default function BrowsePage() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
  const gridColumns = isMobile ? 1 : isTablet ? 3 : 5;
  
  const { q } = useLocalSearchParams();
  const [tab, setTab] = useState<'dishes' | 'chefs' | 'cuisines'>('dishes');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    if (typeof q === 'string') {
      setQuery(q);
    }
  }, [q]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PER_PAGE)), [total]);

  useEffect(() => {
    setPage(1);
    setTotal(0);
    setError(null);
    setDishes([]);
    setChefs([]);
    setCuisines([]);
  }, [tab, query, sortBy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        if (tab === 'dishes') {
          let request = supabase
            .from('dishes')
            .select('id,name,price,image,chef_id, chefs!inner(status, name, rating)', { count: 'exact' })
            .eq('chefs.status', 'active');

          if (sortBy === 'price_asc') {
            request = request.order('price', { ascending: true });
          } else if (sortBy === 'price_desc') {
            request = request.order('price', { ascending: false });
          } else if (sortBy === 'popular') {
            request = request.order('rating', { foreignTable: 'chefs', ascending: false });
          } else {
            request = request.order('created_at', { ascending: false });
          }

          request = request.range(from, to);

          if (query.trim()) {
            const term = query.trim();
            // Sanitize term to avoid breaking the OR syntax (commas split conditions)
            const safeTerm = term.replace(/,/g, ' ');
            // Use websearch_to_tsquery (wfts) for natural language search
            // This handles multi-word queries better than ilike (e.g. "chicken rice" finds documents with both words)
            const searchFilter = [
              `name.wfts.${safeTerm}`,
              `description.wfts.${safeTerm}`,
              `category.wfts.${safeTerm}`,
              `chef.wfts.${safeTerm}`
            ].join(',');
            request = request.or(searchFilter);
          }

          const { data, error, count } = await request;
          if (cancelled) return;
          if (error) throw error;
          setDishes(data ?? []);
          setTotal(count ?? (data?.length ?? 0));
        } else if (tab === 'chefs') {
          let request = supabase
            .from('chefs')
            .select('id,name,location,photo,rating,cuisine', { count: 'exact' })
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .range(from, to);

          if (query.trim()) {
            const term = query.trim();
            const safeTerm = term.replace(/,/g, ' ');
            // Use websearch_to_tsquery (wfts) for natural language search
            const searchFilter = [
              `name.wfts.${safeTerm}`,
              `location.wfts.${safeTerm}`,
              `bio.wfts.${safeTerm}`
            ].join(',');
            request = request.or(searchFilter);
          }

          const { data, error, count } = await request;
          if (cancelled) return;
          if (error) throw error;
          setChefs(data ?? []);
          setTotal(count ?? (data?.length ?? 0));
        } else {
          // Cuisines tab
          // Fetch active chefs to get available cuisines
          let request = supabase
            .from('chefs')
            .select('cuisine')
            .eq('status', 'active')
            .not('cuisine', 'is', null);

          if (query.trim()) {
             // Simple filtering if they search in Cuisines tab
             request = request.ilike('cuisine', `%${query.trim()}%`);
          }

          const { data, error } = await request;
          if (cancelled) return;
          if (error) throw error;
          
          if (data) {
            const uniqueCuisines = Array.from(new Set(data.map(c => c.cuisine).filter(Boolean))).sort();
            // Manual pagination for cuisines since we do distinct client-side
            const pagedCuisines = uniqueCuisines.slice(from, to + 1);
            setCuisines(pagedCuisines);
            setTotal(uniqueCuisines.length);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('browse load error', err);
          setError(err?.message ?? 'Failed to load');
          setDishes([]);
          setChefs([]);
          setCuisines([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, page, query, sortBy]);

  const go = (next: number) => {
    setPage(Math.max(1, Math.min(totalPages, next)));
  };

  const pages = useMemo(() => {
    const windowSize = 5;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + windowSize - 1);
    const normalizedStart = Math.max(1, end - windowSize + 1);
    const list: number[] = [];
    for (let i = normalizedStart; i <= end; i += 1) {
      list.push(i);
    }
    return list;
  }, [page, totalPages]);

  const showPagination = total > PER_PAGE;

  const renderPagination = () => (
    <View style={styles.pager}>
      <Pressable style={styles.pageBtn} disabled={page <= 1} onPress={() => go(page - 1)}>
        <Text style={[styles.pageBtnText, page <= 1 && styles.disabled]}>‹</Text>
      </Pressable>
      {pages.map((p) => (
        <Pressable
          key={p}
          style={[styles.pageNumber, p === page && styles.pageNumberActive]}
          onPress={() => go(p)}
        >
          <Text style={[styles.pageNumberText, p === page && styles.pageNumberTextActive]}>{p}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.pageBtn} disabled={page >= totalPages} onPress={() => go(page + 1)}>
        <Text style={[styles.pageBtnText, page >= totalPages && styles.disabled]}>›</Text>
      </Pressable>
    </View>
  );

  const list = tab === 'dishes' ? dishes : tab === 'chefs' ? chefs : cuisines;

  const handleSearch = () => {
    setPage(1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F0EF' }}>
      <Screen 
        contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        style={{ backgroundColor: '#F2F0EF' }}
        fixedFooterHeight={Platform.select({
          web: 100,
          default: 80,
        })}
      >
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.title}>Explore Meals Near You</Text>
          <Text style={styles.subtitle}>Find your next favorite homemade dish</Text>
        </View>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab('dishes')}
            style={[styles.tab, styles.tabSpacing, tab === 'dishes' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'dishes' && styles.tabTextActive]}>Dishes</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('chefs')}
            style={[styles.tab, styles.tabSpacing, tab === 'chefs' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'chefs' && styles.tabTextActive]}>Chefs</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('cuisines')}
            style={[styles.tab, tab === 'cuisines' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'cuisines' && styles.tabTextActive]}>Cuisines</Text>
          </Pressable>
        </View>

        {tab === 'dishes' && (
          <View style={[styles.sortContainer, { zIndex: 10 }]}>
            <View style={{ position: 'relative' }}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setShowSortMenu(!showSortMenu)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <SortIcon size={24} color="#475569" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>
                  {sortBy === 'popular' ? 'Popularity' :
                   sortBy === 'price_asc' ? 'Price low to high' :
                   'Price high to low'}
                </Text>
              </TouchableOpacity>
              
              {showSortMenu && (
                <View style={styles.dropdownMenu}>
                  {[
                    { label: 'Popularity', value: 'popular' },
                    { label: 'Price low to high', value: 'price_asc' },
                    { label: 'Price high to low', value: 'price_desc' },
                  ].map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.dropdownItem, sortBy === opt.value && styles.dropdownItemActive]}
                      onPress={() => {
                        setSortBy(opt.value);
                        setShowSortMenu(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, sortBy === opt.value && styles.dropdownItemTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Old search bar removed */}

        {loading ? (
          <View style={styles.loader}><ActivityIndicator /></View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : list.length === 0 ? (
          <View style={styles.loader}><Text style={styles.subtitle}>No results found.</Text></View>
        ) : tab === 'dishes' ? (
          <View style={styles.grid}>
            {dishes.map((dish) => (
              <View key={dish.id} style={[styles.cardWrapper, { width: `${100 / gridColumns}%` }]}>
                <DishCard dish={dish} />
              </View>
            ))}
          </View>
        ) : tab === 'chefs' ? (
          <View style={styles.grid}>
            {chefs.map((chef) => (
              <View key={chef.id} style={[styles.cardWrapper, { width: `${100 / gridColumns}%` }]}>
                <ChefCard chef={{ ...chef, rating: typeof chef.rating === 'number' ? chef.rating : null }} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {cuisines.map((cuisine) => (
              <View key={cuisine} style={[styles.cardWrapper, { width: `${100 / (isMobile ? 2 : isTablet ? 4 : 6)}%` }]}>
                <TouchableOpacity 
                  style={styles.cuisineCard}
                  onPress={() => {
                    setQuery(cuisine);
                    setTab('dishes');
                  }}
                >
                  <Text style={styles.cuisineText}>{cuisine}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {showPagination && !loading && list.length > 0 && renderPagination()}
      </Screen>

      {/* Floating Search Bar */}
      <View style={styles.floatingSearchContainer}>
        <View style={styles.floatingSearchBar}>
          <TextInput
            placeholder="In the mood for biryani?"
            placeholderTextColor="#555555"
            style={styles.floatingSearchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.searchIconContainer}
            onPress={handleSearch}
          >
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e2f5ee',
  },
  tabActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#065f46',
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  // Old search style removed/ignored
  search: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    color: '#0f172a',
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -6,
  },
  cardWrapper: {
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  pager: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 24,
    alignItems: 'center',
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  pageBtnText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  disabled: {
    color: '#94a3b8',
  },
  pageNumber: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  pageNumberActive: {
    backgroundColor: '#10b981',
  },
  pageNumberText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  pageNumberTextActive: {
    color: 'white',
  },
  tabSpacing: {
    marginRight: 10,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: Platform.select({ web: 0, default: 4 }),
    zIndex: 10, // Ensure dropdown is above content
  },
  sortLabel: {
    color: '#475569',
    fontWeight: '600',
    marginRight: 12,
    fontSize: 14,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sortButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  sortButtonIcon: {
    color: '#64748b',
    fontSize: 14,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 8,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 4,
    ...elev('lg'),
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#f0fdf4',
  },
  dropdownItemText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  sortOptions: {
    gap: 8,
    paddingRight: 20,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortChipActive: {
    backgroundColor: '#10b981', // PRIMARY_COLOR-ish or Green
    borderColor: '#10b981',
  },
  sortChipText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
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
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
  },
  searchIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: theme.spacing.lg,
    paddingLeft: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 24,
    color: PRIMARY_COLOR,
  },
  cuisineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cuisineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
});