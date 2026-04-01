import React, { useEffect, useState, useMemo, startTransition } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, StyleSheet, TextInput, Platform, useWindowDimensions, Animated, Easing, type ImageSourcePropType } from "react-native";
import { Link, useRouter } from "expo-router";

import { supabase } from "../lib/supabase";
import { theme, elev } from "../lib/theme";
import Screen from "../components/Screen";
import ChefCard from "./components/ChefCard";
import DishCard from "./components/DishCard";
import { toFiniteNumberOrNull } from "../lib/number";
import { useRole } from "../hooks/useRole";

type Chef = Record<string, any>;
type Dish = { id: number; name: string; image?: string | null; price?: number | null; chef_id?: number | null; chef?: string | null };

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
const FEATURED_CHEFS_LIMIT = 30;

// Coordinate cache with persistent storage
const coordinateCache = new Map<string, { lat: number; lon: number } | null>();
// In-memory cache for chef coords from profiles (faster than geocoding)
const chefProfileCoordCache = new Map<string, { lat: number; lon: number } | null>();

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

// Normalize a location string for "same place" checks.
function normalizeLocationKey(loc: any): string {
  return String(loc || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,+/g, ',');
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

/** Resize googleusercontent banner URLs to match viewport (2x for retina, capped at 3000). */
function sizeBannerUrl(url: string, viewportWidth: number): string {
  if (!url.includes('googleusercontent.com')) return url;
  const px = Math.min(Math.ceil(viewportWidth * 2), 3000);
  if (url.match(/=s\d+$/)) return url.replace(/=s\d+$/, `=s${px}`);
  if (!url.includes('=')) return `${url}=s${px}`;
  return url;
}

const CONTENT_MAX_WIDTH = 1280;

type HowItWorksStep = { title: string; text: string; icon: ImageSourcePropType };

const HOW_IT_WORKS_USERS: HowItWorksStep[] = [
  {
    title: "Discover",
    text: "Browse homemade food from local chefs near you",
    icon: require("../assets/search.png"),
  },
  {
    title: "Order",
    text: "Choose a dish, select pickup time and pay securely online",
    icon: require("../assets/shopping-cart.png"),
  },
  {
    title: "Pickup",
    text: "Collect your order on time, handle food safely after pickup",
    icon: require("../assets/dinner.png"),
  },
];

const HOW_IT_WORKS_CHEFS: HowItWorksStep[] = [
  {
    title: "Join",
    text: "Sign up as a home chef and showcase dishes for pickup",
    icon: require("../assets/chef.png"),
  },
  {
    title: "Manage",
    text: "Upload menu, set pricing, portions & pickup time slots for customers",
    icon: require("../assets/list (1).png"),
  },
  {
    title: "Earn",
    text: "Receive orders, prepare meals & get paid securely after pickups",
    icon: require("../assets/money-bag.png"),
  },
];

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const { isChef, isAdmin, profile } = useRole();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [chefDistances, setChefDistances] = useState<Map<string, number>>(new Map());
  const [bannerUrlRaw, setBannerUrlRaw] = useState("https://lh3.googleusercontent.com/aida-public/AB6AXuCvaMIyS8SnO_Cv8rsakKzzeevi_5ZMvJ-s-7_Ex52zv-wcN7sP-9pra9fhdBPSOgbcpv6OhmyP5atDXUERJXJ41g-zpV8yzvkLGWU6HC3CKyhdMfsrrPDYZjPW03dbcH6-h7mYXuOZId16eciMoAyZ6dJGG-S1amRb23hQCz7zUeEXiDxiZoGWheTe6UPP-VdMm1tAIZJxTvtqXmVBu8l6hp3-W6REKdmdaZl16sSMuOw7Vw7k82QwbHVZalpFexATBa4dyvn3UXhT=s3000");
  const bannerUrl = useMemo(() => sizeBannerUrl(bannerUrlRaw, width), [bannerUrlRaw, width]);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [heroLayout, setHeroLayout] = useState<{ width: number; height: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [howItWorksAudience, setHowItWorksAudience] = useState<"users" | "chefs">("chefs");
  const [howItWorksPanelAudience, setHowItWorksPanelAudience] = useState<"users" | "chefs">("chefs");
  const howItWorksAudienceRef = React.useRef(howItWorksAudience);
  howItWorksAudienceRef.current = howItWorksAudience;
  const howItWorksFade = React.useRef(new Animated.Value(1)).current;
  const howItWorksSlide = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (howItWorksPanelAudience === howItWorksAudience) {
      return;
    }

    howItWorksFade.stopAnimation();
    howItWorksSlide.stopAnimation();

    const fadeOut = Animated.parallel([
      Animated.timing(howItWorksFade, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(howItWorksSlide, {
        toValue: 10,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    fadeOut.start(({ finished }) => {
      if (!finished) return;
      const next = howItWorksAudienceRef.current;
      setHowItWorksPanelAudience(next);
      howItWorksFade.setValue(0);
      howItWorksSlide.setValue(-14);
      Animated.parallel([
        Animated.timing(howItWorksFade, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(howItWorksSlide, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      fadeOut.stop();
    };
  }, [howItWorksAudience, howItWorksPanelAudience]);

  const scrollX = React.useRef(new Animated.Value(0)).current;
  const featuredScrollRef = React.useRef<ScrollView>(null);
  const featuredSectionRef = React.useRef<View>(null);
  const isCarouselVisibleRef = React.useRef(true);
  const isUserScrollingRef = React.useRef(false);
  const autoScrollPosition = React.useRef(0);
  const autoScrollRafRef = React.useRef<number | null>(null);
  const lastAutoScrollTsRef = React.useRef<number>(0);
  const resumeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last location used for distance calc to skip redundant work
  const lastDistanceLocationRef = React.useRef<string | null>(null);
  
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

  // Load image dimensions for native fill-height-fit-width behavior
  useEffect(() => {
    if (Platform.OS === 'web' || !bannerUrl) return;
    Image.getSize(
      bannerUrl,
      (w, h) => setImageSize({ width: w, height: h }),
      () => setImageSize(null)
    );
  }, [bannerUrl]);

  const CARD_WIDTH = isMobile ? 200 : 240;
  const GAP = 24;
  const TOTAL_ITEM_WIDTH = CARD_WIDTH + GAP;

  // Use original dishes array (no infinite duplication)
  const displayDishes = useMemo(() => {
    return dishes;
  }, [dishes]);

  // Pause auto-scroll when carousel scrolls off-screen (saves CPU/battery on mobile)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;
    const node = (featuredSectionRef.current as any);
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isCarouselVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [dishes.length]);

  // Track if we're in the process of resetting to start
  const isResettingRef = React.useRef(false);
  
  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    lastAutoScrollTsRef.current = 0;
  }, []);

  // Function to start auto-scroll from current position
  const startAutoScroll = React.useCallback(() => {
    if (dishes.length === 0) return;
    stopAutoScroll();
    
    const maxScroll = Math.max(0, displayDishes.length * TOTAL_ITEM_WIDTH - width);
    const AUTO_SCROLL_PX_PER_SEC = 40; // slightly faster than before, but smoother (time-based)
    
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

    const tick = (ts: number) => {
      if (isUserScrollingRef.current || isResettingRef.current) {
        stopAutoScroll();
        return;
      }
      // Skip frame when carousel is scrolled off-screen (saves CPU)
      if (!isCarouselVisibleRef.current) {
        autoScrollRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const prev = lastAutoScrollTsRef.current || ts;
      // Cap dt to avoid big jumps after backgrounding / GC pauses.
      const dtMs = Math.min(40, Math.max(0, ts - prev));
      lastAutoScrollTsRef.current = ts;

      autoScrollPosition.current += (AUTO_SCROLL_PX_PER_SEC * dtMs) / 1000;

      // When reaching the end, smoothly reset to start
      if (autoScrollPosition.current >= maxScroll) {
        stopAutoScroll();
        isResettingRef.current = true;

        // Wait a moment at the end, then smoothly scroll back
        setTimeout(() => {
          autoScrollPosition.current = 0;
          featuredScrollRef.current?.scrollTo({ x: 0, animated: true });

          // Wait for reset animation, then resume auto-scroll
          setTimeout(() => {
            isResettingRef.current = false;
            startAutoScroll();
          }, 500);
        }, 800);
        return;
      }

      featuredScrollRef.current?.scrollTo({
        x: autoScrollPosition.current,
        animated: false,
      });

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, [dishes.length, displayDishes.length, TOTAL_ITEM_WIDTH, width, stopAutoScroll]);

  // Auto-scroll effect for featured dishes - start on mount
  useEffect(() => {
    startAutoScroll();
    
    return () => {
      stopAutoScroll();
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [startAutoScroll, stopAutoScroll]);
  

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      // Single query for all app_settings (banner + placeholders) — saves one round-trip
      supabase.from('app_settings').select('key, value').in('key', ['banner_url', 'search_placeholders'])
        .then(({ data }) => {
          if (!mounted || !data) return;
          for (const row of data) {
            if (row.key === 'banner_url' && row.value) {
              setBannerUrlRaw(row.value);
            } else if (row.key === 'search_placeholders' && row.value) {
              try {
                const parsed = JSON.parse(row.value);
                if (Array.isArray(parsed) && parsed.length === 5 && parsed.every((p: any) => typeof p === 'string' && p.trim())) {
                  setPLACEHOLDERS(parsed);
                }
              } catch {}
            }
          }
        })
        .catch(() => {});

      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from("chefs").select("id, name, slug, photo, bio, location, rating, cuisine, latitude, longitude, user_id").eq("featured", true).eq("status", "active").eq("stripe_connect_completed", true).order("rating", { ascending: false }).limit(FEATURED_CHEFS_LIMIT),
        supabase.from("dishes")
          .select("id,name,image,price,chef_id,chef,rating, chefs!inner(featured, status, stripe_connect_completed, name)")
          .eq("chefs.featured", true)
          .eq("chefs.status", "active")
          .eq("chefs.stripe_connect_completed", true)
          .or("is_active.eq.true,is_active.is.null")
          .order("price", { ascending: true })
          .limit(15),
      ]);
      if (!mounted) return;
      setChefs((c || []) as Chef[]);
      setDishes((d || []) as Dish[]);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    const profileLat = toFiniteNumberOrNull((profile as any)?.latitude);
    const profileLon = toFiniteNumberOrNull((profile as any)?.longitude);
    const hasProfileCoords = profileLat !== null && profileLon !== null;

    // Skip recalc if distances are already populated and location hasn't changed
    const locKey = normalizeLocationKey((profile as any)?.location) || `${profileLat},${profileLon}`;
    if (chefDistances.size > 0 && lastDistanceLocationRef.current === locKey) return;
    lastDistanceLocationRef.current = locKey;

    // If we can't compute user coords quickly, fall back to cached geocoding once.
    (async () => {
      let userCoords: { lat: number; lon: number } | null = null;
      const userLocationKey = normalizeLocationKey((profile as any)?.location);

      if (hasProfileCoords) {
        userCoords = { lat: profileLat!, lon: profileLon! };
      } else if ((profile as any)?.location) {
        userCoords = await geocodeAddress(String((profile as any).location));
      }

      if (!mounted || !userCoords || chefs.length === 0) {
        if (mounted) setChefDistances(new Map());
        return;
      }

      // Prefetch chef coordinates from profiles when chef table has no lat/lon.
      // This avoids geocoding and makes distance display faster.
      try {
        const chefUserIds = Array.from(
          new Set(
            chefs
              .map((c) => String((c as any)?.user_id || ''))
              .filter(Boolean)
          )
        );

        const missingUserIds = chefUserIds.filter((uid) => !chefProfileCoordCache.has(uid));

        if (missingUserIds.length > 0) {
          const { data: rows, error } = await supabase
            .from('profiles')
            .select('id, latitude, longitude')
            .in('id', missingUserIds);

          if (!error && Array.isArray(rows)) {
            // Mark all requested IDs as null by default; fill when valid coords present.
            missingUserIds.forEach((uid) => chefProfileCoordCache.set(uid, null));
            rows.forEach((r: any) => {
              const lat = toFiniteNumberOrNull(r?.latitude);
              const lon = toFiniteNumberOrNull(r?.longitude);
              if (lat !== null && lon !== null) {
                chefProfileCoordCache.set(String(r.id), { lat, lon });
              }
            });
          }
        }
      } catch {
        // If profile lookups are blocked (RLS) or fail, we just fall back to geocoding.
      }

      const next = new Map<string, number>();

      // Compute distances (coords-first, geocode fallback)
      await Promise.all(
        chefs.map(async (chef) => {
          try {
            const chefId = normalizeId((chef as any)?.id);
            const chefLat = toFiniteNumberOrNull((chef as any)?.latitude);
            const chefLon = toFiniteNumberOrNull((chef as any)?.longitude);

            // If the user and chef location strings match, treat distance as 0 (avoid bad geocode mismatches).
            const chefLocationKey = normalizeLocationKey((chef as any)?.location);
            if (userLocationKey && chefLocationKey && userLocationKey === chefLocationKey) {
              next.set(chefId, 0);
              return;
            }

            if (chefLat !== null && chefLon !== null) {
              const d = calculateDistanceFromCoords(userCoords, { lat: chefLat, lon: chefLon });
              if (Number.isFinite(d)) next.set(chefId, d);
              return;
            }

            // Second preference: chef's profile stored coordinates (if available)
            const chefUserId = String((chef as any)?.user_id || '');
            if (chefUserId) {
              const profCoords = chefProfileCoordCache.get(chefUserId);
              if (profCoords) {
                const d = calculateDistanceFromCoords(userCoords, profCoords);
                if (Number.isFinite(d)) next.set(chefId, d);
                return;
              }
            }

            // Fallback: geocode chef location (cached) if coords not stored
            const chefLoc = (chef as any)?.location;
            if (chefLoc) {
              const coords = await geocodeAddress(String(chefLoc));
              if (coords) {
                const d = calculateDistanceFromCoords(userCoords, coords);
                if (Number.isFinite(d)) next.set(chefId, d);
              }
            }
          } catch {
            // ignore per-chef distance failures
          }
        })
      );

      if (mounted) setChefDistances(next);
    })();

    return () => {
      mounted = false;
    };
  }, [profile, chefs]);

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
      <Screen style={{ backgroundColor: '#F2F0EF' }} contentPadding={0}>
        <View style={[styles.container, isMobile && styles.containerMobile, !isMobile && styles.containerDesktop]}>
          {/* Skeleton hero — same aspect ratio as the real hero to prevent CLS */}
          <View style={[styles.hero, isMobile && styles.heroMobile, !isMobile && styles.heroDesktop]} />
          {/* Skeleton section: featured dishes */}
          <View style={styles.section}>
            <View style={{ width: '40%', height: 22, borderRadius: 8, backgroundColor: '#E6E4E1', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: GAP, paddingHorizontal: GAP / 2 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ width: isMobile ? 200 : 240, aspectRatio: 0.85, borderRadius: theme.radius.xl, backgroundColor: '#E6E4E1' }} />
              ))}
            </View>
          </View>
          {/* Skeleton section: popular chefs */}
          <View style={styles.section}>
            <View style={{ width: '35%', height: 22, borderRadius: 8, backgroundColor: '#E6E4E1', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ width: isMobile ? 220 : 260, height: 140, borderRadius: theme.radius.xl, backgroundColor: '#E6E4E1' }} />
              ))}
            </View>
          </View>
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
        <View style={[styles.container, isMobile && styles.containerMobile, !isMobile && styles.containerDesktop]}>
          {/* Hero section - matches HTML design */}
          <Link href="/browse?tab=chefs" asChild>
            <TouchableOpacity
              activeOpacity={0.95}
              style={StyleSheet.flatten([styles.hero, isMobile && styles.heroMobile, !isMobile && styles.heroDesktop])}
              onLayout={(e) => Platform.OS !== 'web' && setHeroLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
            >
              {Platform.OS === 'web' ? (
                <>
                  <View
                    style={[
                      styles.heroBackgroundImage,
                      {
                        backgroundImage: `url(${bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: isMobile ? 'left center' : 'center',
                        backgroundRepeat: 'no-repeat',
                      } as any,
                    ]}
                  />
                  {/* Hidden img for LCP: fetchpriority=high + eager loading so browser starts early */}
                  <Image
                    source={{ uri: bannerUrl }}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 } as any}
                    {...{ fetchpriority: 'high', loading: 'eager', decoding: 'async' } as any}
                  />
                </>
              ) : imageSize && heroLayout ? (
                <View style={[styles.heroBackgroundImage, styles.heroImageFillHeightWrapper, isMobile && styles.heroImageFillHeightWrapperLeft]}>
                  <Image
                    source={{ uri: bannerUrl }}
                    style={{
                      height: heroLayout.height,
                      width: heroLayout.height * (imageSize.width / imageSize.height),
                    }}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <Image
                  source={{ uri: bannerUrl }}
                  style={styles.heroBackgroundImage}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>
          </Link>

          {/* Featured Dishes section - Auto-scroll + Swipeable Carousel */}
          <View ref={featuredSectionRef} style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                styles.homeSectionTitleSmaller,
                isMobile && styles.sectionTitleMobile,
                isMobile && styles.homeSectionTitleSmallerMobile,
              ]}
            >
              Featured this week
            </Text>
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
                stopAutoScroll();
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
                stopAutoScroll();
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
                  <DishCard dish={dish} variant="homepage" style={{ width: '100%' }} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Featured Chefs section - matches HTML design */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                styles.homeSectionTitleSmaller,
                isMobile && styles.sectionTitleMobile,
                isMobile && styles.homeSectionTitleSmallerMobile,
              ]}
            >
              Popular near you
            </Text>
            {isMobile ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {chefs.map((chef, i) => (
                  <View
                    key={`${normalizeId(chef.id)}-${i}`}
                    style={[
                      styles.homepageChefCardWrapper,
                      isMobile && styles.homepageChefCardWrapperMobile,
                    ]}
                  >
                    <ChefCard
                      chef={{
                        ...chef,
                        id: normalizeId(chef.id),
                        rating: typeof chef.rating === "number" ? chef.rating : null,
                      }}
                      style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "transparent" }}
                      ratingColor="#FE734C"
                      distanceKm={chefDistances.get(normalizeId(chef.id)) ?? null}
                      hideBio
                      metaVariant="homepage"
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.chefsGridDesktop}>
                {chefs.map((chef, i) => (
                  <View
                    key={`${normalizeId(chef.id)}-${i}`}
                    style={styles.homepageChefCardWrapperDesktop}
                  >
                    <ChefCard
                      chef={{
                        ...chef,
                        id: normalizeId(chef.id),
                        rating: typeof chef.rating === "number" ? chef.rating : null,
                      }}
                      style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "transparent" }}
                      ratingColor="#FE734C"
                      distanceKm={chefDistances.get(normalizeId(chef.id)) ?? null}
                      hideBio
                      metaVariant="homepage"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* How It Works section */}
          <View style={[styles.section, styles.howItWorksSection]}>
            <View style={[styles.howItWorksHeaderRow, isMobile && styles.howItWorksHeaderRowMobile]}>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.howItWorksHeadingInline,
                  styles.homeSectionTitleSmaller,
                  isMobile && styles.sectionTitleMobile,
                  isMobile && styles.homeSectionTitleSmallerMobile,
                ]}
                numberOfLines={2}
              >
                How it works?
              </Text>
              <View
                style={[styles.howItWorksToggleTrack, isMobile && styles.howItWorksToggleTrackMinMobile]}
                accessibilityRole="tablist"
              >
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: howItWorksAudience === "chefs" }}
                  onPress={() => setHowItWorksAudience("chefs")}
                  style={[
                    styles.howItWorksToggleSegment,
                    isMobile && styles.howItWorksToggleSegmentMobile,
                    howItWorksAudience === "chefs"
                      ? styles.howItWorksToggleSegmentActive
                      : styles.howItWorksToggleSegmentInactive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.howItWorksToggleLabel,
                      isMobile && styles.howItWorksToggleLabelMobile,
                      howItWorksAudience === "chefs" ? styles.howItWorksToggleLabelActive : styles.howItWorksToggleLabelInactive,
                    ]}
                  >
                    For chefs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: howItWorksAudience === "users" }}
                  onPress={() => setHowItWorksAudience("users")}
                  style={[
                    styles.howItWorksToggleSegment,
                    isMobile && styles.howItWorksToggleSegmentMobile,
                    howItWorksAudience === "users"
                      ? styles.howItWorksToggleSegmentActive
                      : styles.howItWorksToggleSegmentInactive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.howItWorksToggleLabel,
                      isMobile && styles.howItWorksToggleLabelMobile,
                      howItWorksAudience === "users" ? styles.howItWorksToggleLabelActive : styles.howItWorksToggleLabelInactive,
                    ]}
                  >
                    For users
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Animated.View
              style={{
                opacity: howItWorksFade,
                transform: [{ translateY: howItWorksSlide }],
              }}
            >
              <View style={[styles.howItWorksGrid, isMobile && styles.howItWorksGridMobile, !isMobile && styles.howItWorksGridDesktop]}>
                {(howItWorksPanelAudience === "users" ? HOW_IT_WORKS_USERS : HOW_IT_WORKS_CHEFS).map((step, idx) => (
                  <View key={`${howItWorksPanelAudience}-${step.title}-${idx}`} style={styles.howItWorksCard}>
                    <View style={styles.howItWorksIconContainer}>
                      <Image
                        source={step.icon}
                        style={styles.howItWorksIconImage}
                        tintColor="#FFFFFF"
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.howItWorksContent}>
                      <Text style={styles.howItWorksCardTitle}>{step.title}</Text>
                      <Text style={styles.howItWorksText}>{step.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
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
                tintColor="#FE734C"
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
                tintColor="#FE734C"
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
  containerDesktop: {
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
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
    backgroundColor: '#E6E4E1',
  },
  heroDesktop: {
    maxHeight: 420,
  },
  heroBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    borderRadius: theme.radius.xl,
  },
  heroImageFillHeightWrapper: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  heroImageFillHeightWrapperLeft: {
    alignItems: "flex-start",
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
  },
  micIconImage: {
    width: 24,
    height: 24,
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
    // Keep spacing consistent between homepage sections
    marginBottom: theme.spacing.lg,
  },
  howItWorksSection: {
    paddingBottom: 0,
  },
  howItWorksHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  howItWorksHeaderRowMobile: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  howItWorksHeadingInline: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  /** Slightly smaller than `sectionTitle` for homepage section headings only */
  homeSectionTitleSmaller: {
    fontSize: Platform.select({
      web: 24,
      default: 20,
    }),
    lineHeight: Platform.select({
      web: 30,
      default: 26,
    }),
  },
  homeSectionTitleSmallerMobile: {
    fontSize: 22,
    lineHeight: 28,
  },
  howItWorksToggleTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    flexShrink: 0,
    backgroundColor: "#EBEBEB",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 999,
    overflow: "hidden",
    minHeight: 42,
    minWidth: 136,
  },
  howItWorksToggleTrackMinMobile: {
    minWidth: 152,
    minHeight: 40,
  },
  howItWorksToggleSegment: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  howItWorksToggleSegmentMobile: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  howItWorksToggleSegmentInactive: {
    backgroundColor: "transparent",
  },
  howItWorksToggleSegmentActive: {
    backgroundColor: "#FE734C",
    // Full capsule so the inner edge is a semicircle, not a hard vertical split.
    borderRadius: 999,
    overflow: "hidden",
  },
  howItWorksToggleLabel: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.normal,
    ...Platform.select({
      web: { whiteSpace: "nowrap" as const },
      default: {},
    }),
  },
  howItWorksToggleLabelMobile: {
    fontSize: 12,
    lineHeight: 15,
  },
  howItWorksToggleLabelActive: {
    color: "#FFFFFF",
  },
  howItWorksToggleLabelInactive: {
    color: "#33393A",
  },
  sellCtaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: -theme.spacing.xl,
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
    fontWeight: '300' as any,
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
  howItWorksGridDesktop: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
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
  howItWorksIconImage: {
    width: 20,
    height: 20,
  },
  howItWorksContent: {
    flex: 1,
    gap: 4,
  },
  howItWorksTitle: {
    fontFamily: theme.typography.fontFamily.display,
    color: '#333333',
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'left',
    // No fontSize here so sectionTitle's size (30 web / 22 default) applies on all breakpoints
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
  homepageChefCardWrapper: {
    width: 420,
    flexShrink: 0,
  },
  homepageChefCardWrapperMobile: {
    width: 360,
  },
  chefsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  homepageChefCardWrapperDesktop: {
    flex: 1,
    minWidth: 320,
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
    fontSize: 26,
    paddingHorizontal: 0,
    fontWeight: theme.typography.fontWeight.bold,
  },
  howItWorksGridMobile: {
    flexDirection: "column",
    gap: theme.spacing.lg,
  },
});
