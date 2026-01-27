import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, StyleSheet, TextInput, Platform, useWindowDimensions, Animated, Easing } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme, elev } from "../lib/theme";
import Screen from "../components/Screen";
import { getDishRatings, getChefById } from "../lib/db";
import { safeToFixed, toNumber } from "../lib/number";
import { formatCad } from "../lib/money";
import { useRole } from "../hooks/useRole";

type Chef = Record<string, any>;
type Dish = { id: number; name: string; image?: string | null; price?: number | null; chef_id?: number | null; chef?: string | null };

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);

// Coordinate cache with persistent storage
const coordinateCache = new Map<string, { lat: number; lon: number } | null>();

// Load cache from localStorage on initialization
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('geocode_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        if (value) {
          coordinateCache.set(key, value);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load geocode cache:', e);
  }
}

// Save cache to localStorage
function saveCacheToStorage() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const cacheObj: Record<string, { lat: number; lon: number } | null> = {};
      coordinateCache.forEach((value, key) => {
        cacheObj[key] = value;
      });
      localStorage.setItem('geocode_cache', JSON.stringify(cacheObj));
    } catch (e) {
      console.warn('Failed to save geocode cache:', e);
    }
  }
}

// Geocode an address with persistent caching and retry logic
async function geocodeAddress(address: string, retries = 2): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  
  // Check in-memory cache first
  if (coordinateCache.has(address)) {
    const cached = coordinateCache.get(address);
    if (cached) return cached; // Only return if we have valid coordinates
    // If cached as null, don't retry immediately (was a persistent failure)
    // But allow one retry attempt
  }

  // Try different address formats
  const addressVariants = [
    address, // Full address first
    address.split(',').slice(0, 2).join(',').trim(), // City, State
    address.split(',')[0]?.trim(), // Just city
  ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Remove duplicates

  for (let variantIndex = 0; variantIndex < addressVariants.length; variantIndex++) {
    const addressToTry = addressVariants[variantIndex];
    
    // Check cache for this variant
    if (coordinateCache.has(addressToTry)) {
      const cached = coordinateCache.get(addressToTry);
      if (cached) {
        // Cache the result for the original address too
        coordinateCache.set(address, cached);
        saveCacheToStorage();
        return cached;
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const encodedAddress = encodeURIComponent(addressToTry);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=0`,
          {
            headers: {
              'User-Agent': 'YourHomeChef/1.0'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          // Validate coordinates
          if (isNaN(coords.lat) || isNaN(coords.lon)) {
            throw new Error('Invalid coordinates returned');
          }
          // Cache for both the variant and original address
          coordinateCache.set(addressToTry, coords);
          coordinateCache.set(address, coords);
          saveCacheToStorage();
          return coords;
        }
        
        // If no results, try next variant or retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between retries
          continue;
        }
        
        // This variant failed, try next one
        break;
      } catch (error: any) {
        if (attempt === retries) {
          // Final attempt for this variant failed, try next variant
          if (variantIndex === addressVariants.length - 1) {
            // All variants failed
            if (error.name === 'AbortError') {
              console.warn('Geocoding timeout for:', address);
            } else {
              console.warn('Geocoding error for:', address, error);
            }
            // Don't cache failures - allow retry on next load
            return null;
          }
          break; // Try next variant
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  
  return null;
}

// Calculate distance using Haversine formula
function calculateDistanceFromCoords(userCoords: { lat: number; lon: number }, chefCoords: { lat: number; lon: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (chefCoords.lat - userCoords.lat) * Math.PI / 180;
  const dLon = (chefCoords.lon - userCoords.lon) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(userCoords.lat * Math.PI / 180) * Math.cos(chefCoords.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate distance between two addresses (with caching)
async function getDistance(userLocation: string | null, chefLocation: string | null): Promise<number | null> {
  if (!userLocation || !chefLocation) return null;
  
  try {
    const [userCoords, chefCoords] = await Promise.all([
      geocodeAddress(userLocation),
      geocodeAddress(chefLocation)
    ]);

    if (!userCoords || !chefCoords) return null;

    return calculateDistanceFromCoords(userCoords, chefCoords);
  } catch (error) {
    console.warn('Distance calculation error:', error);
    return null;
  }
}

// Batch calculate distances for all chefs (optimized with parallel processing and caching)
async function calculateAllDistances(userLocation: string | null, chefs: Chef[]): Promise<Map<string, number>> {
  const distances = new Map<string, number>();
  
  if (!userLocation) return distances;

  try {
    // Geocode user location once (check cache first)
    const userCoords = await geocodeAddress(userLocation);
    if (!userCoords) return distances;

    // Filter chefs with locations and batch geocode in parallel (with concurrency limit)
    const chefsWithLocations = chefs.filter(chef => chef.location);
    
    // Process in batches of 5 to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < chefsWithLocations.length; i += BATCH_SIZE) {
      const batch = chefsWithLocations.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (chef) => {
        const coords = await geocodeAddress(chef.location!);
        return { chefId: normalizeId(chef.id), coords };
      });

      const batchResults = await Promise.all(batchPromises);

      // Calculate distances for this batch
      batchResults.forEach(({ chefId, coords }) => {
        if (coords) {
          const distance = calculateDistanceFromCoords(userCoords, coords);
          distances.set(chefId, distance);
        }
      });
    }
  } catch (error) {
    console.warn('Batch distance calculation error:', error);
  }

  return distances;
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

// Primary color from design: #2C4E4B
const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';

// Circular dish card for featured section
function CircularDishCard({ dish }: { dish: Dish }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
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
        <View style={[styles.circularDishImageContainer, isMobile && styles.circularDishImageContainerMobile]}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={styles.circularDishImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.circularDishInfo}>
          <Text style={styles.circularDishTitle} numberOfLines={2}>
            {dish.name}
          </Text>
          <Text style={styles.circularDishChefName} numberOfLines={1}>
            {chefName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Text style={styles.circularDishSubtitle} numberOfLines={1}>
              {formatCad(dish.price)}
            </Text>
            {rating?.count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <Image 
                  source={require('../assets/star.png')} 
                  style={{ width: 14, height: 14, tintColor: '#FE734C' }} 
                  resizeMode="contain" 
                />
                <Text style={{ fontSize: 12, color: '#666', fontFamily: theme.typography.fontFamily.body }}>
                  {safeToFixed(rating?.avg)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// Chef card with distance calculation
function ChefCardWithDistance({ chef, distance, isMobile }: { chef: Chef, distance: number | null, isMobile: boolean }) {

  return (
    <View style={[styles.featuredChefCardWrapper, isMobile && styles.featuredChefCardWrapperMobile]}>
      <Link href={{ 
        pathname: "/chef/[id]", 
        params: { 
          id: normalizeId(chef.id),
          name: chef.name,
          photo: chef.photo || chef.avatar || "",
          location: chef.location || "",
          rating: chef.rating?.toString() || "",
          rating_count: chef.rating_count?.toString() || "",
          cuisine: chef.cuisine || ""
        } 
      }} asChild>
        <TouchableOpacity activeOpacity={0.9} style={StyleSheet.flatten([styles.featuredChefCard, isMobile && styles.featuredChefCardMobile])}>
          <Image
            source={{ uri: chef?.photo || chef?.avatar || `https://i.pravatar.cc/300?u=chef-${encodeURIComponent(String(chef?.id ?? ""))}` }}
            style={[styles.featuredChefAvatar, isMobile && styles.featuredChefAvatarMobile]}
          />
          <Text style={styles.featuredChefName}>{chef.name}</Text>
          <Text style={styles.featuredChefCuisine}>{formatCuisine(chef.cuisine)}</Text>
          <View style={styles.featuredChefLocationRatingRow}>
            {/* Distance display - only show if distance is calculated, at the front */}
            {distance !== null && (
              <View style={styles.featuredChefDistanceContainer}>
                <Image 
                  source={require('../assets/map.png')} 
                  style={styles.featuredChefIcon} 
                  resizeMode="contain" 
                />
                <Text style={styles.featuredChefDistance}>
                  {distance > 20 ? '>20 km' : `${distance.toFixed(1)} km`}
                </Text>
              </View>
            )}
            {chef.location && (
              <View style={styles.featuredChefLocationContainer}>
                <Image 
                  source={require('../assets/locationnewicon.png')} 
                  style={styles.featuredChefIcon} 
                  resizeMode="contain" 
                />
                <Text style={styles.featuredChefLocation} numberOfLines={1}>
                  {chef.location?.split(',')[1]?.trim() || chef.location?.split(',')[0]}
                </Text>
              </View>
            )}
            <View style={styles.featuredChefRating}>
              <Image 
                source={require('../assets/star.png')} 
                style={styles.featuredChefIcon} 
                resizeMode="contain" 
              />
              <Text style={styles.featuredChefRatingText}>{safeToFixed(toNumber(chef?.rating, 0))}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Link>
    </View>
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
              <Image 
                source={require('../assets/star.png')} 
                style={{ width: 14, height: 14, tintColor: '#FE734C' }} 
                resizeMode="contain" 
              />
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
  const { isChef, isAdmin, profile } = useRole();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [chefDistances, setChefDistances] = useState<Map<string, number>>(new Map());

  // Create a stable key from chef IDs to track changes
  const chefsKey = useMemo(() => {
    return chefs.map(c => normalizeId(c.id)).join(',');
  }, [chefs]);

  // Recalculate distances when profile location or chefs change (optimized with batching and retries)
  useEffect(() => {
    if (profile?.location && chefs.length > 0) {
      let mounted = true;
      const distancesMap = new Map<string, number>();
      let updateTimer: NodeJS.Timeout | null = null;
      let lastUpdateTime = 0;
      
      // Helper to batch state updates (but ensure updates happen)
      const scheduleUpdate = (force = false) => {
        const now = Date.now();
        if (updateTimer && !force) return;
        
        if (force || now - lastUpdateTime > 200) {
          // Immediate update if forced or enough time has passed
          if (updateTimer) clearTimeout(updateTimer);
          if (mounted) {
            setChefDistances(new Map(distancesMap));
            lastUpdateTime = now;
          }
          updateTimer = null;
        } else {
          // Schedule batched update
          if (updateTimer) return;
          updateTimer = setTimeout(() => {
            if (mounted) {
              setChefDistances(new Map(distancesMap));
              lastUpdateTime = Date.now();
            }
            updateTimer = null;
          }, 200);
        }
      };
      
      // Calculate distances using stored coordinates (much faster!)
      (async () => {
        // Get user coordinates - prefer stored, fallback to geocoding
        let userCoords: { lat: number; lon: number } | null = null;
        if (profile.latitude && profile.longitude) {
          userCoords = { lat: profile.latitude, lon: profile.longitude };
        } else if (profile.location) {
          // Fallback to geocoding if coordinates not stored
          userCoords = await geocodeAddress(profile.location);
          if (!userCoords) {
            console.warn('Failed to geocode user location:', profile.location);
            return;
          }
        } else {
          return; // No location available
        }
        
        if (!mounted) return;
        
        const chefsWithLocations = chefs.filter(chef => chef.location);
        const totalChefs = chefsWithLocations.length;
        let completedCount = 0;
        
        // Process all chefs - use stored coordinates when available
        for (const chef of chefsWithLocations) {
          if (!mounted) break;
          
          try {
            let chefCoords: { lat: number; lon: number } | null = null;
            
            // Prefer stored coordinates
            if (chef.latitude && chef.longitude) {
              chefCoords = { lat: chef.latitude, lon: chef.longitude };
            } else if (chef.location) {
              // Fallback to geocoding if coordinates not stored
              chefCoords = await geocodeAddress(chef.location);
            }
            
            if (chefCoords) {
              const distance = calculateDistanceFromCoords(userCoords, chefCoords);
              const chefId = normalizeId(chef.id);
              distancesMap.set(chefId, distance);
              completedCount++;
              scheduleUpdate(); // Schedule batched update
            } else {
              completedCount++;
              console.warn('Failed to get coordinates for chef:', chef.id, chef.location);
            }
          } catch (error) {
            console.warn('Error calculating distance for chef:', chef.id, error);
            if (mounted) completedCount++;
          }
        }
        
        // Final update to ensure all calculated distances are shown
        if (mounted) {
          if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = null;
          }
          setChefDistances(new Map(distancesMap));
          console.log(`Distance calculation complete: ${distancesMap.size}/${totalChefs} chefs`);
        }
      })();
      
      return () => { 
        mounted = false;
        if (updateTimer) clearTimeout(updateTimer);
      };
    } else {
      setChefDistances(new Map());
    }
  }, [profile?.location, chefsKey, chefs]);
  const [bannerUrl, setBannerUrl] = useState("https://lh3.googleusercontent.com/aida-public/AB6AXuCvaMIyS8SnO_Cv8rsakKzzeevi_5ZMvJ-s-7_Ex52zv-wcN7sP-9pra9fhdBPSOgbcpv6OhmyP5atDXUERJXJ41g-zpV8yzvkLGWU6HC3CKyhdMfsrrPDYZjPW03dbcH6-h7mYXuOZId16eciMoAyZ6dJGG-S1amRb23hQCz7zUeEXiDxiZoGWheTe6UPP-VdMm1tAIZJxTvtqXmVBu8l6hp3-W6REKdmdaZl16sSMuOw7Vw7k82QwbHVZalpFexATBa4dyvn3UXhT=s3000");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const featuredScrollRef = React.useRef<ScrollView>(null);
  const isUserScrollingRef = React.useRef(false);
  const autoScrollPosition = React.useRef(0);
  const autoScrollTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animated placeholder logic
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
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
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500, // Fade in
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
      }, 500); // Change text halfway through
    }, 3500); // 3s visible + 1s transition

    return () => clearInterval(interval);
  }, [PLACEHOLDERS.length]);

  const CARD_WIDTH = isMobile ? 200 : 240;
  const GAP = 24;
  const TOTAL_ITEM_WIDTH = CARD_WIDTH + GAP;

  // Use original dishes array (no infinite duplication)
  const displayDishes = useMemo(() => {
    return dishes;
  }, [dishes]);

  // Track if we're in the process of resetting to start
  const isResettingRef = React.useRef(false);
  
  // Function to start auto-scroll from current position
  const startAutoScroll = React.useCallback(() => {
    if (dishes.length === 0) return;
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
    
    const maxScroll = Math.max(0, displayDishes.length * TOTAL_ITEM_WIDTH - width);
    
    // If starting at or very close to the end, reset to beginning first
    if (autoScrollPosition.current >= maxScroll - 5) {
      isResettingRef.current = true;
      autoScrollPosition.current = 0;
      featuredScrollRef.current?.scrollTo({ x: 0, animated: true });
      // Wait for the reset animation to complete before starting auto-scroll
      setTimeout(() => {
        isResettingRef.current = false;
        startAutoScroll();
      }, 500);
      return;
    }
    
    autoScrollTimer.current = setInterval(() => {
      if (!isUserScrollingRef.current && !isResettingRef.current && featuredScrollRef.current) {
        autoScrollPosition.current += 1;
        
        // When reaching the end, smoothly reset to start
        if (autoScrollPosition.current >= maxScroll) {
          isResettingRef.current = true;
          clearInterval(autoScrollTimer.current!);
          autoScrollTimer.current = null;
          
          // Wait a moment at the end, then smoothly scroll back
          setTimeout(() => {
            autoScrollPosition.current = 0;
            featuredScrollRef.current?.scrollTo({ x: 0, animated: true });
            
            // Wait for reset animation, then resume auto-scroll
            setTimeout(() => {
              isResettingRef.current = false;
              startAutoScroll();
            }, 500);
          }, 1000);
        } else {
          featuredScrollRef.current.scrollTo({
            x: autoScrollPosition.current,
            animated: false,
          });
        }
      }
    }, 30); // Smooth scrolling at ~33fps
  }, [dishes.length, displayDishes.length, TOTAL_ITEM_WIDTH, width]);

  // Auto-scroll effect for featured dishes - start on mount
  useEffect(() => {
    startAutoScroll();
    
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [startAutoScroll]);
  

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    (async () => {
      setLoading(true);
      
      // Try to fetch dynamic banner from app_settings (with fallback to default)
      supabase.from('app_settings').select('value').eq('key', 'banner_url').single()
        .then(({ data, error }) => {
          if (!error && mounted && data?.value) {
            let url = data.value;
            if (url.includes('googleusercontent.com')) {
               if (url.match(/=s\d+$/)) {
                 url = url.replace(/=s\d+$/, '=s3000');
               } else if (!url.includes('=')) {
                 url += '=s3000';
               }
            }
            setBannerUrl(url);
          }
          // If error or no data, keep using default bannerUrl from useState
        })
        .catch(() => {
          // Silently fail - use default banner
        });

      // Try to fetch search placeholders from app_settings (with fallback to default)
      supabase.from('app_settings').select('value').eq('key', 'search_placeholders').single()
        .then(({ data, error }) => {
          if (!error && mounted && data?.value) {
            try {
              const parsed = JSON.parse(data.value);
              if (Array.isArray(parsed) && parsed.length === 5 && parsed.every((p: any) => typeof p === 'string' && p.trim())) {
                setPLACEHOLDERS(parsed);
              }
            } catch (e) {
              // Silently fail - use default placeholders
            }
          }
          // If error or no data, keep using default PLACEHOLDERS from useState
        })
        .catch(() => {
          // Silently fail - use default placeholders
        });

      const [{ data: c }, { data: d }] = await Promise.all([
        // Show only featured and active chefs on homepage
        supabase.from("chefs").select("*").eq("featured", true).eq("status", "active").order("rating", { ascending: false }).limit(5),
        // Show all dishes from featured and active chefs, sorted by price (least expensive first)
        supabase.from("dishes")
          .select("id,name,image,price,chef_id,chef, chefs!inner(featured, status)")
          .eq("chefs.featured", true)
          .eq("chefs.status", "active")
          .order("price", { ascending: true }),
      ]);
      if (!mounted) return;
      setChefs((c || []) as Chef[]);
      setDishes((d || []) as Dish[]);
      setLoading(false);

      // Calculate distances for all chefs in parallel (non-blocking)
      if (profile?.location && c && c.length > 0) {
        calculateAllDistances(profile.location, c as Chef[])
          .then(distances => {
            if (mounted) {
              setChefDistances(distances);
            }
          })
          .catch(err => {
            console.warn('Error calculating distances:', err);
          });
      }

      // Subscribe to real-time updates for chefs table
      channel = supabase
        .channel('homepage-chefs-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chefs',
            filter: 'featured=eq.true',
          },
          async () => {
            // Refetch chefs when a featured chef is updated
            if (mounted) {
              const { data: updatedChefs } = await supabase
                .from("chefs")
                .select("*")
                .eq("featured", true)
                .eq("status", "active")
                .order("rating", { ascending: false })
                .limit(5);
              if (mounted && updatedChefs) {
                setChefs(updatedChefs as Chef[]);
                // Recalculate distances when chefs are updated
                if (profile?.location) {
                  calculateAllDistances(profile.location, updatedChefs as Chef[])
                    .then(distances => {
                      if (mounted) {
                        setChefDistances(distances);
                      }
                    })
                    .catch(err => {
                      console.warn('Error calculating distances:', err);
                    });
                }
              }
            }
          }
        )
        .subscribe();
    })();
    
    return () => { 
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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

  const startDictation = () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSearchQuery(transcript);
        };
        recognition.start();
      } else {
        alert("Voice search not supported in this browser.");
      }
    } else {
      alert("Voice search coming soon to mobile app.");
    }
  };

  if (loading) {
    return (
      <Screen style={{ backgroundColor: '#F2F0EF' }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: '#F2F0EF' }}>
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
          <Link href="/browse?tab=chefs" asChild>
            <TouchableOpacity activeOpacity={0.95} style={StyleSheet.flatten([styles.hero, isMobile && styles.heroMobile])}>
              <Image
                source={{ uri: bannerUrl }}
                style={[
                  styles.heroBackgroundImage,
                  Platform.OS === 'web' && { objectPosition: 'center center' } as any,
                  isMobile && { width: '140%', left: -15 }
                ]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </Link>

          {/* Featured Dishes section - Auto-scroll + Swipeable Carousel */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Featured this week</Text>
            <ScrollView 
              ref={featuredScrollRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{
                flexDirection: 'row', 
                gap: GAP,
                paddingHorizontal: GAP / 2,
                paddingBottom: theme.spacing.md,
              }}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onTouchStart={() => {
                isUserScrollingRef.current = true;
                if (autoScrollTimer.current) {
                  clearInterval(autoScrollTimer.current);
                  autoScrollTimer.current = null;
                }
                if (resumeTimeoutRef.current) {
                  clearTimeout(resumeTimeoutRef.current);
                }
              }}
              onScroll={(e) => {
                // Always track scroll position
                autoScrollPosition.current = e.nativeEvent.contentOffset.x;
              }}
              onScrollBeginDrag={() => {
                isUserScrollingRef.current = true;
                if (autoScrollTimer.current) {
                  clearInterval(autoScrollTimer.current);
                  autoScrollTimer.current = null;
                }
                if (resumeTimeoutRef.current) {
                  clearTimeout(resumeTimeoutRef.current);
                }
              }}
              onScrollEndDrag={(e) => {
                autoScrollPosition.current = e.nativeEvent.contentOffset.x;
              }}
              onMomentumScrollEnd={(e) => {
                autoScrollPosition.current = e.nativeEvent.contentOffset.x;
                // Resume auto-scroll after momentum ends
                resumeTimeoutRef.current = setTimeout(() => {
                  isUserScrollingRef.current = false;
                  startAutoScroll();
                }, 2000);
              }}
              onTouchEnd={() => {
                // Resume auto-scroll 2 seconds after touch ends (if no momentum)
                resumeTimeoutRef.current = setTimeout(() => {
                  isUserScrollingRef.current = false;
                  startAutoScroll();
                }, 2000);
              }}
            >
              {displayDishes.map((dish, index) => (
                <View key={`${dish.id}-${index}`} style={{ width: CARD_WIDTH }}>
                  <CircularDishCard dish={dish} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Featured Chefs section - matches HTML design */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Popular near you</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {chefs.map((chef, i) => (
                <ChefCardWithDistance 
                  key={`${normalizeId(chef.id)}-${i}`} 
                  chef={chef} 
                  distance={chefDistances.get(normalizeId(chef.id)) || null}
                  isMobile={isMobile}
                />
              ))}
            </ScrollView>
          </View>

          {/* How It Works section */}
          <View style={[styles.section, styles.howItWorksSection]}>
            <Text style={[styles.sectionTitle, styles.howItWorksTitle, isMobile && styles.sectionTitleMobile]}>How it works?</Text>
            <View style={[styles.howItWorksGrid, isMobile && styles.howItWorksGridMobile]}>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Image 
                    source={require('../assets/search.png')} 
                    style={{ width: 24, height: 24, tintColor: '#FFFFFF' }} 
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.howItWorksContent}>
                  <Text style={styles.howItWorksCardTitle}>Discover</Text>
                  <Text style={styles.howItWorksText}>
                    Browse homemade food from local chefs near you today
                  </Text>
                </View>
              </View>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Image 
                    source={require('../assets/shopping-cart.png')} 
                    style={{ width: 24, height: 24, tintColor: '#FFFFFF' }} 
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.howItWorksContent}>
                  <Text style={styles.howItWorksCardTitle}>Order</Text>
                  <Text style={styles.howItWorksText}>
                    Choose a dish, select a pickup time, and pay securely online
                  </Text>
                </View>
              </View>
              <View style={styles.howItWorksCard}>
                <View style={styles.howItWorksIconContainer}>
                  <Image 
                    source={require('../assets/add.png')} 
                    style={{ width: 24, height: 24, tintColor: '#FFFFFF' }} 
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.howItWorksContent}>
                  <Text style={styles.howItWorksCardTitle}>Pickup</Text>
                  <Text style={styles.howItWorksText}>
                    Collect your order on time & handle food safely after pickup
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sell on YourHomeChef CTA - only show for regular users and non-logged in users */}
          {!isChef && !isAdmin && (
            <View style={styles.sellCtaContainer}>
              <Link href="/auth/chef" asChild>
                <TouchableOpacity style={styles.becomeChefButton}>
                  <Text style={styles.becomeChefButtonText}>Become a Chef</Text>
                </TouchableOpacity>
              </Link>
              <Text style={styles.sellCtaText}>
                Love cooking? Sell on YourHomeChef.
              </Text>
              <View style={styles.bulletPointsContainer}>
                <Text style={styles.bulletPointText}>No sign-up fees</Text>
                <Text style={styles.bulletPointText}>Create your own menu</Text>
                <Text style={styles.bulletPointText}>Manage & process orders</Text>
              </View>
            </View>
          )}
        </View>
      </Screen>

      {/* Floating Search Bar - fixed at bottom of viewport */}
      <View style={styles.floatingSearchContainer}>
        <View style={styles.floatingSearchBar}>
            <TouchableOpacity 
              style={styles.searchIconContainer}
              onPress={handleSearch}
            >
              <Image 
                source={require('../assets/search.png')} 
                style={styles.searchIconImage} 
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {!searchQuery && (
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
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity 
              style={styles.micIconContainer}
              onPress={startDictation}
            >
              <Image 
                source={require('../assets/microphone.png')} 
                style={styles.micIconImage} 
                resizeMode="contain"
              />
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
    paddingBottom: 0,
    backgroundColor: '#F2F0EF',
  },
  // Hero section
  hero: {
    ...Platform.select({
      web: {
        width: '100%',
        aspectRatio: 3,
      },
      default: {
        width: '100%',
        aspectRatio: 1.5,
      },
    }),
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    marginBottom: theme.spacing.xl,
    position: "relative",
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
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.body,
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
  },
  floatingSearchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
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
    tintColor: '#FE734C',
  },
  micIconImage: {
    width: 24,
    height: 24,
    tintColor: '#FE734C',
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  // Sections
  section: {
    marginBottom: theme.spacing.xl,
  },
  howItWorksSection: {
    paddingBottom: 0,
  },
  howItWorksTitle: {
    paddingBottom: 0,
  },
  sellCtaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
    gap: theme.spacing.sm,
  },
  becomeChefButton: {
    backgroundColor: '#FE734C',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing['2xl'],
    borderRadius: theme.radius.lg,
    minWidth: 180,
    alignItems: 'center',
  },
  becomeChefButtonText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  sellCtaText: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.base,
    color: '#333333',
    textAlign: 'center',
  },
  bulletPointsContainer: {
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.xs,
  },
  bulletPointText: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    color: '#555555',
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#333333',
    fontSize: Platform.select({
      web: 30,
      default: 22,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: -0.015,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
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
    fontFamily: theme.typography.fontFamily.body,
    color: '#333333',
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.body,
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.body,
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  // How It Works
  howItWorksGrid: {
    flexDirection: "column",
    gap: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  howItWorksCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
  },
  howItWorksCardTitle: {
    fontFamily: theme.typography.fontFamily.display,
    color: '#333333',
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.bold as any,
    textAlign: 'left',
  },
  howItWorksIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FE734C', // Orange background
    justifyContent: "center",
    alignItems: "center",
  },
  howItWorksContent: {
    flex: 1,
    gap: 4,
  },
  howItWorksTitle: {
    fontFamily: theme.typography.fontFamily.display,
    color: '#333333',
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'left',
  },
  howItWorksText: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#555555',
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.4,
    textAlign: 'left',
  },
  // Featured Chefs
  featuredChefCardWrapper: {
    width: 240,
    flexShrink: 0,
  },
  featuredChefCardWrapperMobile: {
    width: 200,
  },
  featuredChefCardMobile: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  featuredChefAvatarMobile: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  featuredChefCard: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing['2xl'],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    textAlign: "center",
  },
  featuredChefAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  featuredChefName: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#333333',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  featuredChefCuisine: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  featuredChefLocationRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  featuredChefIcon: {
    width: 18,
    height: 18,
    tintColor: '#FE734C',
  },
  featuredChefLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredChefLocation: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#777777',
    fontSize: theme.typography.fontSize.xs,
  },
  featuredChefRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs / 2,
  },
  featuredChefRatingText: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#777777',
    fontSize: theme.typography.fontSize.xs,
  },
  featuredChefDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredChefDistance: {
    fontFamily: theme.typography.fontFamily.body,
    color: '#777777',
    fontSize: theme.typography.fontSize.xs,
  },
  // Mobile Styles
  containerMobile: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  heroMobile: {
    minHeight: 200,
    padding: theme.spacing.sm,
  },
  heroTitleMobile: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 24,
    lineHeight: 30,
  },
  heroSubtitleMobile: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  sectionTitleMobile: {
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 24,
    paddingHorizontal: 0,
    fontWeight: theme.typography.fontWeight.bold,
  },
  howItWorksGridMobile: {
    flexDirection: "column",
    gap: theme.spacing.lg,
  },
  // Circular Dish Card
  circularDishCard: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
  },
  circularDishImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  circularDishImageContainerMobile: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  circularDishChefName: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
  circularDishSubtitle: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
