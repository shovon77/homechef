import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, useWindowDimensions, TouchableOpacity, Platform, ScrollView, Image, Animated, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DishCard from '../components/DishCard';
import ChefCard from '../components/ChefCard';
import { theme, elev } from '../../lib/theme';
import { SortIcon } from '../../components/SortIcon';
import { useLocationModal } from '../../context/LocationModalContext';

const PER_PAGE = 25; // 5x5 grid layout
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
  
  // Initialize sortBy from URL param if present, or default to 'nearest' for dishes tab
  const initialSort = (() => {
    const s = Array.isArray(paramSort) ? paramSort[0] : paramSort;
    if (s === 'none' || s === 'price_asc' || s === 'price_desc' || s === 'popular' || s === 'newest' || s === 'nearest') {
      return s;
    }
    // Always default to 'nearest' (dishes tab is default)
    return 'nearest';
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
      // If no sort param, default based on tab
      const currentTab = tab || 'dishes';
      setSortBy(currentTab === 'dishes' ? 'nearest' : 'none');
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
  
  // Ensure "nearest" sort is applied when dishes tab is active and no sort is specified in URL
  // Only set if sortBy is 'none' or undefined to allow user to change it
  // Don't override if paramSort is explicitly set (including 'nearest')
  useEffect(() => {
    const currentTab = tab || 'dishes';
    const s = Array.isArray(paramSort) ? paramSort[0] : paramSort;
    if (currentTab === 'dishes' && !s && (sortBy === 'none' || !sortBy)) {
      setSortBy('nearest');
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

  // Animated placeholder logic
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const PLACEHOLDERS = [
    "In the mood for spicy mutton biryani?",
    "Or maybe a classic chicken pulao?",
    "No wait, let's get a quick fuchka?",
    "How about samosa & shingara like school days?",
    "Find the taste of home only a click away!"
  ];

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
  }, []);

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
  }, [tab, debouncedQuery, sortBy]);

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
        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        if (tab === 'dishes') {
          let request = supabase
            .from('dishes')
            .select('id,name,description,price,image,rating,chef_id,created_at, chefs!inner(status, name, location)', { count: 'exact' })
            .eq('chefs.status', 'active');

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
            // Default to 'nearest' for dishes tab if no sort is specified
            effectiveSort = 'nearest';
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
            // For nearest sort, fetch more dishes to calculate distances
            // We'll filter by distance client-side after geocoding
            request = request.order('created_at', { ascending: false });
            // Fetch more dishes for distance calculation (up to 200)
            request = request.range(0, 199);
          } else {
            // Fallback: always sort by created_at
            request = request.order('created_at', { ascending: false });
          }

          // Only apply pagination if not using nearest sort (nearest handles pagination after filtering)
          if (effectiveSort !== 'nearest') {
            request = request.range(from, to);
          }

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
          
          // If nearest sort, calculate distances and filter
          if (effectiveSort === 'nearest' && profile?.location && data && Array.isArray(data) && data.length > 0) {
            try {
              console.log('Calculating distances for nearest sort. User location:', profile.location);
              console.log('Total dishes to process:', data.length);
              
              // Geocode user location
              const { data: userGeoData, error: userGeoError } = await supabase.functions.invoke('google-geocode-forward', {
                body: { address: profile.location },
              });
              
              console.log('User geocoding result:', { userGeoData, userGeoError });
              
              if (userGeoError) {
                console.error('User geocoding error:', userGeoError);
                setDishes([]);
                setTotal(0);
                return;
              }
              
              if (userGeoData?.lat && userGeoData?.lng) {
                const userLat = userGeoData.lat;
                const userLng = userGeoData.lng;
                
                console.log('User coordinates:', { lat: userLat, lng: userLng });
                
                // Helper function to calculate distance using Haversine formula
                const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
                  const R = 6371; // Earth's radius in km
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLng = (lng2 - lng1) * Math.PI / 180;
                  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  return R * c;
                };
                
                // Geocode chef locations and calculate distances
                const dishesWithDistance = await Promise.all(
                  (data as any[]).map(async (dish: any) => {
                    if (!dish.chefs?.location) {
                      console.log('Dish missing chef location:', dish.id);
                      return { dish, distance: Infinity };
                    }
                    
                    try {
                      const { data: chefGeoData, error: chefGeoError } = await supabase.functions.invoke('google-geocode-forward', {
                        body: { address: dish.chefs.location },
                      });
                      
                      if (!chefGeoError && chefGeoData?.lat && chefGeoData?.lng) {
                        const distance = calculateDistance(userLat, userLng, chefGeoData.lat, chefGeoData.lng);
                        console.log(`Dish ${dish.id} - Chef location: ${dish.chefs.location}, Distance: ${distance.toFixed(2)}km`);
                        return { dish, distance };
                      } else {
                        console.log('Chef geocoding failed:', { chefLocation: dish.chefs.location, chefGeoError, chefGeoData });
                      }
                    } catch (err) {
                      console.error('Error geocoding chef location:', err, dish.chefs.location);
                    }
                    
                    return { dish, distance: Infinity };
                  })
                );
                
                // Filter dishes within 50km and sort by distance
                const nearbyDishes = dishesWithDistance
                  .filter(({ distance }) => {
                    const isNearby = distance <= 50;
                    if (!isNearby) {
                      console.log(`Dish filtered out - distance: ${distance.toFixed(2)}km`);
                    }
                    return isNearby;
                  })
                  .sort((a, b) => a.distance - b.distance)
                  .map(({ dish }) => dish);
                
                console.log(`Filtered ${nearbyDishes.length} dishes within 50km out of ${dishesWithDistance.length} total`);
                
                // Apply pagination
                const paginatedDishes = nearbyDishes.slice(from, to + 1);
                
                setDishes(paginatedDishes);
                setTotal(nearbyDishes.length);
              } else {
                console.error('Failed to geocode user location:', { userGeoError, userGeoData });
                // If geocoding fails, don't show any dishes for nearest sort
                setDishes([]);
                setTotal(0);
              }
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
            .select('id,name,location,photo,rating,cuisine', { count: 'exact' })
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
  }, [tab, page, debouncedQuery, sortBy, profile?.location, authLoading]);

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
            { label: 'Newest', value: 'newest' },
            { label: 'Nearest', value: 'nearest' },
            { label: 'Popularity', value: 'popular' },
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
        contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        style={{ backgroundColor: '#F2F0EF' }}
        fixedFooterHeight={Platform.select({
          web: 100,
          default: 80,
        })}
      >
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.title}>Explore meals near you</Text>
          <Text style={styles.subtitle}>Find your next favorite homemade dish</Text>
        </View>

        <View style={[styles.tabs, { overflow: 'visible' }]}>
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
            style={[styles.tab, styles.tabSpacing, tab === 'cuisines' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'cuisines' && styles.tabTextActive]}>Cuisines</Text>
          </Pressable>
          
          {tab === 'dishes' && (
            <View style={{ position: 'relative', marginLeft: 10, flexShrink: 0, zIndex: 10001, overflow: 'visible' }}>
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
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <SortIcon size={20} color="#FE734C" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }} numberOfLines={1}>
                    {sortBy === 'none' ? 'Sort' :
                     sortBy === 'newest' ? 'Newest' :
                     sortBy === 'nearest' ? 'Nearest' :
                     sortBy === 'popular' ? 'Popularity' :
                     sortBy === 'price_asc' ? 'Price ↑' :
                     'Price ↓'}
                  </Text>
                </TouchableOpacity>

                {sortBy !== 'none' && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSortBy('none');
                      // Update URL to persist sort selection
                      const currentTab = tab || 'dishes';
                      const currentQuery = query ? `&q=${encodeURIComponent(query)}` : '';
                      router.push(`/browse?tab=${currentTab}${currentQuery}`);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ fontSize: 14, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                )}
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
                    { label: 'Newest', value: 'newest' },
                    { label: 'Nearest', value: 'nearest' },
                    { label: 'Popularity', value: 'popular' },
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
          )}
        </View>

        {/* Old search bar removed */}

        {loading ? (
          <View style={styles.loader}><ActivityIndicator /></View>
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
              <View key={dish.id} style={[styles.cardWrapper, { width: `${100 / gridColumns}%` }]}>
                <DishCard 
                  dish={dish} 
                  style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FE734C', ...elev('lg') }} 
                  chefNameColor="#555555"
                  ratingColor="#FE734C"
                  priceColor="#FE734C"
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
                  style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FE734C', ...elev('lg') }}
                  nameColor="#FE734C"
                  ratingColor="#FE734C"
                />
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
          <TouchableOpacity 
            style={styles.searchIconContainer}
            onPress={handleSearch}
          >
            <Image 
              source={require('../../assets/search.png')} 
              style={styles.searchIconImage} 
            />
          </TouchableOpacity>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {!query && (
              <Animated.Text 
                style={[
                  styles.floatingSearchPlaceholder, 
                  { opacity: fadeAnim }
                ]}
                numberOfLines={1}
              >
                {PLACEHOLDERS[placeholderIndex]}
              </Animated.Text>
            )}
            <TextInput
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
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '800',
    color: '#33393A',
  },
  subtitle: {
    color: '#33393A',
    marginTop: 4,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FE734C',
    flexShrink: 0,
  },
  tabActive: {
    backgroundColor: '#FE734C',
  },
  tabText: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.display,
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
    color: '#0f172a',
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
    color: '#475569',
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
    color: '#64748b',
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
    ...elev('lg'),
    overflow: "hidden",
    width: "100%",
    maxWidth: Platform.select<any>({
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
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    zIndex: 2, // Ensure input is above placeholder
  },
  floatingSearchPlaceholder: {
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    color: '#555555',
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
    tintColor: '#FE734C',
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
    color: '#101828',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
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
    tintColor: '#FE734C',
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
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
});