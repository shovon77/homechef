import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, useWindowDimensions, TouchableOpacity, Platform, ScrollView, Image, Animated, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { toFiniteNumberOrNull } from '../../lib/number';
import DishCard from '../components/DishCard';
import ChefCard from '../components/ChefCard';
import { theme, elev } from '../../lib/theme';
import { useLocationModal } from '../../context/LocationModalContext';

const PER_PAGE = 25; // chefs/cuisines
const DISHES_GRID_COLUMNS = 2;
const DISHES_FETCH_LIMIT = 9999; // fetch all dishes in one page (no pagination)
const GRID_COLUMNS = 5;
const PRIMARY_COLOR = '#FE734C';

function cleanSearchQuery(q: string) {
  let cleaned = q.toLowerCase().trim();
  const phrases = [
    "in the mood for",
    "looking for",
    "i want",
    "show me",
    "search for",
    "find me",
    "find",
    "give me"
  ];
  for (const p of phrases) {
    if (cleaned.startsWith(p)) {
      cleaned = cleaned.substring(p.length).trim();
    }
  }
  return cleaned || q;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

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

type Dish = {
  id: number;
  name: string;
  price: number | null;
  image: string | null;
  chef_id: number | null;
  rating?: number | null;
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
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { setShowLocationModal } = useLocationModal();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
  const gridColumns = isMobile ? 1 : isTablet ? 3 : 5;
  
  const { q, tab: paramTab, sort: paramSort } = useLocalSearchParams<{ q?: string, tab?: string, sort?: string }>();
  const [tab, setTab] = useState<'dishes' | 'chefs' | 'cuisines'>('dishes');
  
  // Initialize sortBy from URL param if present. Default to 'newest' (never auto-apply 'nearest' when user/location may be missing)
  const initialSort = (() => {
    const s = Array.isArray(paramSort) ? paramSort[0] : paramSort;
    if (s === 'none' || s === 'price_asc' || s === 'price_desc' || s === 'popular' || s === 'newest' || s === 'nearest') {
      return s;
    }
    return 'newest';
  })();
  
  const [sortBy, setSortBy] = useState(initialSort);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dropdownReady, setDropdownReady] = useState(false);
  const sortMenuRef = useRef<View>(null);
  const sortButtonRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const t = Array.isArray(paramTab) ? paramTab[0] : paramTab;
    if (t === 'chefs' || t === 'cuisines' || t === 'dishes') {
      setTab(t);
    }
  }, [paramTab]);
  
  useEffect(() => {
    const s = Array.isArray(paramSort) ? paramSort[0] : paramSort;
    if (s === 'none' || s === 'price_asc' || s === 'price_desc' || s === 'popular' || s === 'newest' || s === 'nearest') {
      setSortBy(s);
    } else if (!s) {
      // If no sort param, default based on tab (use 'newest' for dishes - never auto-apply 'nearest')
      const currentTab = tab || 'dishes';
      setSortBy(currentTab === 'dishes' ? 'newest' : 'none');
    }
  }, [paramSort, tab]);

  // Reset dropdown ready state when menu closes
  useEffect(() => {
    if (!showSortMenu) {
      setDropdownReady(false);
    }
  }, [showSortMenu]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showSortMenu) return;

    const handleClickOutside = (event: any) => {
      if (sortMenuRef.current && sortButtonRef.current) {
        // @ts-ignore - web-specific
        const menuNode = sortMenuRef.current as any;
        const buttonNode = sortButtonRef.current as any;
        if (menuNode && buttonNode && 
            !menuNode.contains?.(event.target) && 
            !buttonNode.contains?.(event.target)) {
          setShowSortMenu(false);
        }
      }
    };

    if (Platform.OS === 'web') {
      // Use a small delay to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSortMenu]);
  
  // When dishes tab is active and no sort is specified in URL, default to 'newest' (not 'nearest')
  useEffect(() => {
    const currentTab = tab || 'dishes';
    const s = Array.isArray(paramSort) ? paramSort[0] : paramSort;
    if (currentTab === 'dishes' && !s && (sortBy === 'none' || !sortBy)) {
      setSortBy('newest');
    }
  }, [tab, paramSort]);
  
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 800);
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);

  // Floating search: collapsed mic FAB -> expanded search bar
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput | null>(null);
  const collapsedSize = Platform.select({ web: 64, default: 56 }) as number;
  const expandedWidth = useMemo(
    () => Math.max(collapsedSize, Math.min(580, width - theme.spacing.md * 2)),
    [width, collapsedSize]
  );
  const searchWidth = useMemo(
    () =>
      searchExpandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [collapsedSize, expandedWidth],
      }),
    [searchExpandAnim, collapsedSize, expandedWidth]
  );

  useEffect(() => {
    Animated.spring(searchExpandAnim, {
      toValue: searchExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 12,
      tension: 90,
    }).start(({ finished }) => {
      if (finished && searchExpanded) {
        setTimeout(() => searchInputRef.current?.focus?.(), 50);
      }
    });
  }, [searchExpanded, searchExpandAnim]);

  // Animated placeholder logic
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [PLACEHOLDERS, setPLACEHOLDERS] = useState<string[]>([
    "Craving spicy mutton biryani?",
    "Or maybe a classic chicken pulao?",
    "No wait, let's get a quick fuchka?",
    "Jhalmuri & shingara like school days?",
    "Find the taste of home here!"
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500, // Fade out
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500, // Fade in
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
      }, 500); // Change text halfway through
    }, 3500); // 3s visible + 1s transition

    return () => clearInterval(interval);
  }, [PLACEHOLDERS.length]);

  useEffect(() => {
    if (typeof q === 'string') {
      setQuery(q);
    }
  }, [q]);

  const perPage = PER_PAGE; // dishes tab shows all, no pagination
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);

  useEffect(() => {
    setPage(1);
    setTotal(0);
    setError(null);
    setDishes([]);
    setChefs([]);
    setCuisines([]);
    if (tab !== 'dishes') setCuisineFilter(null);
  }, [tab, debouncedQuery, sortBy]);
  useEffect(() => {
    if (debouncedQuery.trim()) setCuisineFilter(null);
  }, [debouncedQuery]);

  useEffect(() => {
    // Fetch search placeholders
    supabase.from('app_settings').select('value').eq('key', 'search_placeholders').single()
      .then(({ data }) => {
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            if (Array.isArray(parsed) && parsed.length === 5 && parsed.every((p: any) => typeof p === 'string' && p.trim())) {
              setPLACEHOLDERS(parsed);
            }
          } catch (e) {
            console.warn('Failed to parse search placeholders:', e);
          }
        }
      });
  }, []);

  useEffect(() => {
    // If auth is still loading, wait for it to complete
    if (authLoading) {
      return;
    }
    
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pageSize = tab === 'dishes' ? DISHES_FETCH_LIMIT : PER_PAGE;
        const from = tab === 'dishes' ? 0 : (page - 1) * pageSize;
        const to = tab === 'dishes' ? DISHES_FETCH_LIMIT - 1 : from + pageSize - 1;

        if (tab === 'dishes') {
          let request = supabase
            .from('dishes')
            .select('id,name,description,price,image,rating,chef_id,created_at, chefs!inner(status, name, location, cuisine, latitude, longitude)', { count: 'exact' })
            .eq('chefs.status', 'active');
          if (cuisineFilter?.trim()) {
            request = request.ilike('chefs.cuisine', `%${cuisineFilter.trim()}%`);
          }

          // Extract search parameters using AI or fallback
          let searchKeywords = '';
          let maxPrice = null;
          // let sortIntent = null;

          if (debouncedQuery.trim()) {
            try {
                // Attempt AI search
                console.log('Invoking AI search for:', debouncedQuery);
                const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-search', { 
                    body: { query: debouncedQuery } 
                });
                
                if (aiError) {
                    console.warn('AI Search Error:', aiError);
                    searchKeywords = cleanSearchQuery(debouncedQuery);
                } else if (aiData) {
                    console.log('AI Search Result:', aiData);
                    searchKeywords = aiData.keywords || debouncedQuery;
                    maxPrice = aiData.max_price;
                    // if (aiData.sort) setSortBy(aiData.sort); 
                } else {
                    searchKeywords = cleanSearchQuery(debouncedQuery);
                }
            } catch (e) {
                console.error('AI Search Exception:', e);
                // Fallback to local cleaning
                searchKeywords = cleanSearchQuery(debouncedQuery);
            }
          }

          // Apply sorting - prioritize URL param, then sortBy state, then default to 'nearest' for dishes tab
          const sortParam = Array.isArray(paramSort) ? paramSort[0] : paramSort;
          let effectiveSort: string;
          
          // If URL has explicit sort param (including 'nearest'), use it
          if (sortParam && (sortParam === 'none' || sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'popular' || sortParam === 'newest' || sortParam === 'nearest')) {
            effectiveSort = sortParam;
          } else if (sortBy && sortBy !== 'none') {
            // Use sortBy state if it's set and not 'none'
            effectiveSort = sortBy;
          } else if (tab === 'dishes') {
            // Default to 'newest' for dishes tab (never auto-apply 'nearest' when user/location may be missing)
            effectiveSort = 'newest';
          } else {
            // Fallback to 'none' for other tabs
            effectiveSort = 'none';
          }
          
          if (effectiveSort === 'price_asc') {
            request = request.order('price', { ascending: true });
          } else if (effectiveSort === 'price_desc') {
            request = request.order('price', { ascending: false });
          } else if (effectiveSort === 'popular') {
            request = request.order('rating', { ascending: false });
          } else if (effectiveSort === 'newest') {
            request = request.order('created_at', { ascending: false });
          } else if (effectiveSort === 'nearest') {
            // For nearest sort, fetch all dishes for distance calculation
            request = request.order('created_at', { ascending: false });
            request = request.range(0, DISHES_FETCH_LIMIT - 1);
          } else {
            // Fallback: always sort by created_at
            request = request.order('created_at', { ascending: false });
          }

          // Dishes tab: fetch all in one page (no pagination)
          request = request.range(from, to);

          if (maxPrice) {
             request = request.lte('price', maxPrice);
          }

          if (searchKeywords.trim()) {
            const term = searchKeywords.trim();
            // Sanitize term to avoid breaking the OR syntax (commas split conditions)
            const safeTerm = term.replace(/,/g, ' ');
            // Use websearch_to_tsquery (wfts) for natural language search
            // This handles multi-word queries better than ilike (e.g. "chicken rice" finds documents with both words)
            const searchFilter = [
              `name.ilike.%${safeTerm}%`,
              `name.wfts.${safeTerm}`,
              `description.wfts.${safeTerm}`,
              `category.wfts.${safeTerm}`,
              `chef.wfts.${safeTerm}`
            ].join(',');
            request = request.or(searchFilter);
          }

          let { data, error, count } = await request;
          if (cancelled) return;
          if (error) throw error;
          
          // If nearest sort, calculate distances using profile lat/lon (user) and chefs lat/lon
          const profileLat = toFiniteNumberOrNull((profile as any)?.latitude);
          const profileLon = toFiniteNumberOrNull((profile as any)?.longitude);
          const hasUserCoords = profileLat !== null && profileLon !== null;
          const hasUserLocation = !!(profile?.location?.trim());

          if (effectiveSort === 'nearest' && profile && (hasUserCoords || hasUserLocation) && data && Array.isArray(data) && data.length > 0) {
            try {
              // Get user coordinates: use profile lat/lon when available, else geocode
              let userLat: number;
              let userLng: number;
              if (hasUserCoords) {
                userLat = profileLat as number;
                userLng = profileLon as number;
              } else {
                const { data: userGeoData, error: userGeoError } = await supabase.functions.invoke('google-geocode-forward', {
                  body: { address: profile!.location },
                });
                if (userGeoError || !userGeoData?.lat || !userGeoData?.lng) {
                  setDishes([]);
                  setTotal(0);
                  return;
                }
                userLat = userGeoData.lat;
                userLng = userGeoData.lng;
              }

              const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
              };

              // Use chef's profile lat/lon (chefs table) when available; else geocode
              const dishesWithDistance = await Promise.all(
                (data as any[]).map(async (dish: any) => {
                  const chefLat = toFiniteNumberOrNull(dish.chefs?.latitude);
                  const chefLon = toFiniteNumberOrNull(dish.chefs?.longitude);
                  if (chefLat !== null && chefLon !== null) {
                    const distance = calculateDistance(userLat, userLng, chefLat, chefLon);
                    return { dish, distance };
                  }
                  if (!dish.chefs?.location?.trim()) {
                    return { dish, distance: Infinity };
                  }
                  try {
                    const { data: chefGeoData, error: chefGeoError } = await supabase.functions.invoke('google-geocode-forward', {
                      body: { address: dish.chefs.location },
                    });
                    if (!chefGeoError && chefGeoData?.lat != null && chefGeoData?.lng != null) {
                      const distance = calculateDistance(userLat, userLng, chefGeoData.lat, chefGeoData.lng);
                      return { dish, distance };
                    }
                  } catch {
                    // ignore
                  }
                  return { dish, distance: Infinity };
                })
              );

              const nearbyDishes = dishesWithDistance
                .filter(({ distance }) => distance <= 50)
                .sort((a, b) => a.distance - b.distance)
                .map(({ dish }) => dish);

              setDishes(nearbyDishes);
              setTotal(nearbyDishes.length);
            } catch (distError) {
              console.error('Error calculating distances:', distError);
              // If error, don't show any dishes for nearest sort
              setDishes([]);
              setTotal(0);
            }
          } else if (effectiveSort === 'nearest') {
            // Nearest sort selected but no user location or no data
            // Only warn if auth has finished loading (to avoid false warnings on page refresh)
            if (!authLoading) {
              console.warn('Nearest sort selected but missing requirements:', { 
                hasProfile: !!profile, 
                hasLocation: !!profile?.location, 
                hasData: !!data,
                authLoading 
              });
            }
            // If no location, show empty list (user should set location)
            setDishes([]);
            setTotal(0);
          } else {
            // For other sorts, use data as-is
          setDishes((data as any) ?? []);
          setTotal(count ?? (data?.length ?? 0));
          }
        } else if (tab === 'chefs') {
          let request = supabase
            .from('chefs')
            .select('id,name,location,photo,rating,cuisine,bio', { count: 'exact' })
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .range(from, to);

          if (debouncedQuery.trim()) {
            const term = cleanSearchQuery(debouncedQuery.trim());
            const safeTerm = term.replace(/,/g, ' ');
            // Use websearch_to_tsquery (wfts) for natural language search
            const searchFilter = [
              `name.ilike.%${safeTerm}%`,
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

          if (debouncedQuery.trim()) {
             // Simple filtering if they search in Cuisines tab
             request = request.ilike('cuisine', `%${debouncedQuery.trim()}%`);
          }

          const { data, error } = await request;
          if (cancelled) return;
          if (error) throw error;
          
          if (data) {
            // Format each cuisine, split by comma so "Bengali, Indian" → ["Bengali", "Indian"], then unique
            const formattedCuisines = data.map(c => formatCuisine(c.cuisine)).filter(Boolean);
            const splitCuisines = formattedCuisines.flatMap(s =>
              s.split(',').map(c => c.trim()).filter(Boolean)
            );
            const uniqueCuisines = Array.from(new Set(splitCuisines)).sort();
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
  }, [tab, page, debouncedQuery, sortBy, cuisineFilter, profile?.location, authLoading]);

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

  const showPagination = tab !== 'dishes' && total > perPage;

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

  const startDictation = () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
        };
        recognition.start();
      } else {
        alert("Voice search not supported in this browser.");
      }
    } else {
      alert("Voice search coming soon to mobile app.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F0EF' }}>
      {/* Render dropdown outside ScrollView for proper z-index */}
      {showSortMenu && Platform.OS === 'web' && dropdownReady && (
        <View 
          ref={sortMenuRef} 
          style={[
            styles.dropdownMenu,
            {
              top: dropdownPosition.top,
              right: dropdownPosition.right,
            }
          ]}
          // @ts-ignore - web-specific
          onClick={(e: any) => e.stopPropagation()}
        >
          {[
            { label: 'None', value: 'none' },
            { label: 'Nearest', value: 'nearest' },
            { label: 'Price low to high', value: 'price_asc' },
            { label: 'Price high to low', value: 'price_desc' },
          ].map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.dropdownItem, sortBy === opt.value && styles.dropdownItemActive]}
              onPress={(e) => {
                e.stopPropagation();
                setSortBy(opt.value);
                setShowSortMenu(false);
                const currentTab = tab || 'dishes';
                const currentQuery = query ? `&q=${encodeURIComponent(query)}` : '';
                router.push(`/browse?tab=${currentTab}&sort=${opt.value}${currentQuery}`);
              }}
            >
              <Text style={[styles.dropdownItemText, sortBy === opt.value && styles.dropdownItemTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Screen 
        contentStyle={{ paddingHorizontal: 24, paddingTop: 0 }}
        style={{ backgroundColor: '#F2F0EF' }}
        fixedFooterHeight={Platform.select({
          web: 100,
          default: 80,
        })}
      >
        <View style={styles.headerBlock}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Find the taste of home</Text>
            <Text style={styles.subtitle}>Pickup homemade meals near you</Text>
          </View>
          <View style={styles.subtitleDivider} />
        </View>

        <View style={styles.tabsWrap}>
          <View style={styles.tabsRow}>
            <View style={[styles.tabs, { overflow: 'visible' }]}>
              <Pressable
                onPress={() => setTab('dishes')}
                style={[styles.tab, styles.tabSpacing]}
              >
                <Text style={[styles.tabText, tab === 'dishes' && styles.tabTextActive]}>Dishes</Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('chefs')}
                style={[styles.tab, styles.tabSpacing]}
              >
                <Text style={[styles.tabText, tab === 'chefs' && styles.tabTextActive]}>Chefs</Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('cuisines')}
                style={[styles.tab, styles.tabSpacing]}
              >
                <Text style={[styles.tabText, tab === 'cuisines' && styles.tabTextActive]}>Cuisines</Text>
              </Pressable>
            </View>

            {tab === 'dishes' && (
              <View style={styles.tabsFilter}>
                <View style={{ position: 'relative', flexShrink: 0, zIndex: 10001, overflow: 'visible' }}>
                  <View ref={sortButtonRef} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!showSortMenu && Platform.OS === 'web' && sortButtonRef.current) {
                          // Calculate position synchronously before showing dropdown for smooth animation
                          // @ts-ignore - web-specific
                          const button = sortButtonRef.current as any;
                          if (button && typeof button.getBoundingClientRect === 'function') {
                            const rect = button.getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 8,
                              right: window.innerWidth - rect.right,
                            });
                            setDropdownReady(true);
                          }
                        }
                        setShowSortMenu(!showSortMenu);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Image
                        source={require('../../assets/controls (1).png')}
                        style={{ width: 20, height: 20 }}
                        tintColor="#FE734C"
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>

                  {showSortMenu && Platform.OS !== 'web' && (
                    <View
                      ref={sortMenuRef}
                      style={styles.dropdownMenu}
                      onStartShouldSetResponder={() => true}
                      onResponderGrant={() => {}}
                    >
                      {[
                        { label: 'None', value: 'none' },
                        { label: 'Nearest', value: 'nearest' },
                        { label: 'Price low to high', value: 'price_asc' },
                        { label: 'Price high to low', value: 'price_desc' },
                      ].map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={[styles.dropdownItem, sortBy === opt.value && styles.dropdownItemActive]}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSortBy(opt.value);
                            setShowSortMenu(false);
                            const currentTab = tab || 'dishes';
                            const currentQuery = query ? `&q=${encodeURIComponent(query)}` : '';
                            router.push(`/browse?tab=${currentTab}&sort=${opt.value}${currentQuery}`);
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
          </View>
        </View>

        {/* Old search bar removed */}

        {loading ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : list.length === 0 ? (
          tab === 'dishes' ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>No chefs nearby (yet!)</Text>
              <Text style={styles.emptyStateSubtitle}>Try another area or check back soon.</Text>
              <TouchableOpacity
                style={styles.changeLocationButton}
                onPress={() => setShowLocationModal(true)}
              >
                <Text style={styles.changeLocationButtonText}>Change location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.browseAllButton}
                onPress={() => router.push('/browse?tab=chefs')}
              >
                <Text style={styles.browseAllButtonText}>Browse all chefs</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.loader}><Text style={styles.subtitle}>No results found.</Text></View>
          )
        ) : tab === 'dishes' ? (
          <View style={styles.grid}>
            {dishes.map((dish) => (
              <View key={dish.id} style={[styles.cardWrapper, { width: `${100 / DISHES_GRID_COLUMNS}%` }]}>
                <DishCard 
                  dish={dish} 
                  variant="explore"
                  style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent' }} 
                />
              </View>
            ))}
          </View>
        ) : tab === 'chefs' ? (
          <View style={styles.grid}>
            {chefs.map((chef) => (
              <View key={chef.id} style={[styles.cardWrapper, { width: `${100 / gridColumns}%` }]}>
                <ChefCard 
                  chef={{ ...chef, rating: typeof chef.rating === 'number' ? chef.rating : null }} 
                  style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent' }}
                  ratingColor="#FE734C"
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {cuisines.map((cuisine) => (
              <View key={cuisine} style={styles.cuisineCardWrapper}>
                <TouchableOpacity 
                  style={styles.cuisineCard}
                  onPress={() => {
                    setCuisineFilter(cuisine);
                    setQuery('');
                    setTab('dishes');
                    setPage(1);
                  }}
                >
                  <Text style={styles.cuisineText} numberOfLines={1}>{cuisine}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {showPagination && !loading && list.length > 0 && renderPagination()}
      </Screen>

      {/* Floating Search Bar */}
      <View style={styles.floatingSearchContainer}>
        <Animated.View
          style={[
            styles.floatingSearchBar,
            { width: searchWidth },
            searchExpanded ? styles.floatingSearchBarExpanded : styles.floatingSearchBarCollapsed,
          ]}
        >
          {!searchExpanded ? (
            <TouchableOpacity
              style={styles.micFabButton}
              activeOpacity={0.85}
              onPress={() => setSearchExpanded(true)}
            >
              <Image
                source={require('../../assets/search.png')}
                style={styles.searchIconImage}
                tintColor="#FE734C"
              />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.searchIconContainer}
                onPress={handleSearch}
              >
                <Image
                  source={require('../../assets/search.png')}
                  style={styles.searchIconImage}
                  tintColor="#FE734C"
                />
              </TouchableOpacity>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                {!query && (
                  <Animated.Text
                    style={[
                      styles.floatingSearchPlaceholder,
                      { opacity: fadeAnim },
                    ]}
                    numberOfLines={1}
                  >
                    {PLACEHOLDERS[placeholderIndex]}
                  </Animated.Text>
                )}
                <TextInput
                  ref={searchInputRef}
                  placeholder=""
                  placeholderTextColor="transparent"
                  style={styles.floatingSearchInput}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity
                style={styles.micIconContainer}
                onPress={startDictation}
              >
                <Image
                  source={require('../../assets/microphone.png')}
                  style={styles.micIconImage}
                  tintColor="#FE734C"
                />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    alignItems: 'stretch',
    marginBottom: 16,
    // Center title/subtitle vertically between navbar and divider line
    position: 'relative',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: Platform.select({
      web: 96,
      default: 88,
    }),
  },
  headerTextBlock: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '800',
    color: '#33393A',
    textAlign: 'left',
  },
  subtitle: {
    color: '#33393A',
    marginTop: 4,
    textAlign: 'left',
  },
  subtitleDivider: {
    height: 1,
    backgroundColor: '#FFFFFF',
    // Pin divider to bottom so header text can be vertically centered above it
    position: 'absolute',
    left: -24,
    right: -24,
    bottom: 0,
  },
  tabsWrap: {
    position: 'relative',
    width: '100%',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  tabsFilter: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexShrink: 0,
    minHeight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
  },
  // Old search style removed/ignored
  search: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    color: '#33393A',
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
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
    color: '#33393A',
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
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
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
    color: '#33393A',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '600',
  },
  sortButtonIcon: {
    color: '#64748b',
    fontSize: 14,
  },
  dropdownMenu: {
    ...Platform.select({
      web: {
        position: 'fixed',
        minWidth: 180,
        maxWidth: 220,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 4,
        boxShadow: '-4px 4px 6px -1px rgba(0, 0, 0, 0.1)',
        zIndex: 99999,
        pointerEvents: 'auto',
      },
      default: {
    position: 'absolute',
    top: '100%',
        right: 0,
    marginTop: 8,
    minWidth: 180,
        maxWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 4,
        zIndex: 10000,
        ...Platform.select({
          ios: { 
            shadowColor: '#000', 
            shadowOffset: { width: -2, height: 2 }, 
            shadowOpacity: 0.1, 
            shadowRadius: 4,
          },
          android: { 
            elevation: 10,
          },
        }),
      },
    }),
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  dropdownItemActive: {
    backgroundColor: '#fff5f2',
  },
  dropdownItemText: {
    color: '#33393A',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.display,
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
    color: '#33393A',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
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
    left: theme.spacing.md,
    right: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing['2xl'],
    }),
    alignItems: "flex-end",
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  floatingSearchBarCollapsed: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  floatingSearchBarExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  micFabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingSearchInput: {
    flex: 1,
    color: '#33393A',
    fontSize: Platform.select({
      web: theme.typography.fontSize.base,
      default: theme.typography.fontSize.sm,
    }),
    paddingVertical: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.sm,
    }),
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    zIndex: 2, // Ensure input is above placeholder
    // Remove web focus outline ring
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none' as any,
      },
    }),
  },
  floatingSearchPlaceholder: {
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    color: '#33393A',
    fontSize: Platform.select({
      web: theme.typography.fontSize.base,
      default: theme.typography.fontSize.sm,
    }),
    fontFamily: theme.typography.fontFamily.body,
    zIndex: 1,
    pointerEvents: 'none',
  },
  searchIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
  },
  micIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: theme.spacing.lg,
    paddingLeft: theme.spacing.sm,
  },
  searchIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#33393A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#33393A',
    marginBottom: 24,
    textAlign: 'center',
  },
  changeLocationButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
  },
  changeLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  browseAllButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
  },
  browseAllButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  exploreButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
    marginTop: 8,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  micIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  cuisineCardWrapper: {
    padding: 4,
    width: '50%',
  },
  cuisineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 0,
  },
  cuisineText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '400',
    color: '#33393A',
    textAlign: 'center',
  },
});