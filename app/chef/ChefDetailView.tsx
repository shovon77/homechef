'use client';
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Platform, TextInput, Alert, StyleSheet, useWindowDimensions, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, usePathname, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { getChefByIdOrSlug, getChefById } from '../../lib/db';
import { submitChefReview, getChefReviews as getChefReviewsHelper } from '../../lib/reviews';
import { useAuth } from '../../context/AuthContext';
import type { Chef, Dish, ChefReview } from '../../lib/types';
import Screen from '../../components/Screen';
import DishCard from '../components/DishCard';
import { theme, elev } from '../../lib/theme';

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F2F0EF';
const TEXT_DARK = '#18181b'; // zinc-900
const TEXT_MUTED = '#71717a'; // zinc-500
const TEXT_MUTED_DARK = '#52525b'; // zinc-600
const BORDER_LIGHT = '#e4e4e7'; // zinc-200
const BORDER_DARK = '#3f3f46'; // zinc-700
const STAR_COLOR = '#FE734C'; // Updated to match brand color
const BRAND_BLACK = '#33393A';

// Match explore ChefCard: city and state only (e.g. "Toronto, ON")
function formatLocationCityState(location: string | null | undefined): string {
  if (!location?.trim()) return '';
  const parts = location.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length >= 3 && parts[parts.length - 1].length > 2) return parts.slice(-3, -1).join(', ');
  return parts.slice(-2).join(', ');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatCuisine(cuisine: unknown): string {
  if (!cuisine) return 'Chef';
  if (typeof cuisine === 'string') {
    if (cuisine.trim().startsWith('[') || cuisine.trim().startsWith('"')) {
      try {
        const parsed = JSON.parse(cuisine);
        if (Array.isArray(parsed)) return parsed.join(', ');
        return String(parsed);
      } catch { return cuisine; }
    }
    return cuisine;
  }
  if (Array.isArray(cuisine)) return cuisine.join(', ');
  return 'Chef';
}

const DISH_LIST_SELECT = 'id, name, image, thumbnail, price, rating, chef_id, description, ingredients, is_active, created_at';

/** Fetch best-seller dish IDs for a chef (2 queries instead of 3: join order_items via orders). */
async function fetchBestSellerDishIds(cid: number): Promise<number[]> {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('order_items')
      .select('dish_id, orders!inner(chef_id, status, created_at)')
      .not('dish_id', 'is', null)
      .eq('orders.chef_id', cid)
      .in('orders.status', ['completed', 'ready'])
      .gte('orders.created_at', since);
    if (!data?.length) return [];
    return [...new Set(data.map((r: any) => r.dish_id).filter(Boolean))] as number[];
  } catch (e) {
    console.error('Error fetching best-seller dish IDs', e);
    return [];
  }
}

export default function ChefDetailView() {
  const router = useRouter();
  const pathname = usePathname();
  const { slug, id } = useLocalSearchParams<{ slug?: string; id?: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const dishGridColumns = isMobile ? 2 : isTablet ? 3 : 4;
  const raw = String(Array.isArray(slug) ? slug[0] : slug ?? (Array.isArray(id) ? id[0] : id) ?? '');
  const cleanedSlugUrlRef = useRef<string | null>(null);
  const redirectToSlugTriggeredRef = useRef<string | null>(null);

  // Clean redundant ?slug= in URL on web (Expo Router sometimes adds it). Use history.replaceState to avoid triggering router and breaking on refresh.
  useEffect(() => {
    if (Platform.OS !== 'web' || !pathname || typeof window === 'undefined') return;
    if (!pathname.startsWith('/chef/') || pathname === '/chef/' || pathname.startsWith('/chef/profile') || pathname === '/chef/index') return;
    const segment = pathname.replace(/^\/chef\//, '').split('/')[0]?.trim();
    if (!segment) return;
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug');
    if (slugParam !== segment) return;
    const key = `${pathname}?${window.location.search}`;
    if (cleanedSlugUrlRef.current === key) return;
    cleanedSlugUrlRef.current = key;
    params.delete('slug');
    const rest = params.toString();
    const cleanUrl = rest ? `${pathname}?${rest}` : pathname;
    window.history.replaceState(null, '', cleanUrl);
  }, [pathname]);

  const [chef, setChef] = useState<Chef | null>(null);
  const chefId = chef?.id ?? null;
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<ChefReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Loading States for individual sections
  const [isFetchingDishes, setIsFetchingDishes] = useState(true);
  const [isFetchingReviews, setIsFetchingReviews] = useState(true);

  // Missing State Variables
  const [activeTab, setActiveTab] = useState<'dishes' | 'reviews'>('dishes');
  const [dishesPage, setDishesPage] = useState(1);
  const [dishesTotal, setDishesTotal] = useState(0);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [chefImageError, setChefImageError] = useState(false);
  const [newlyAddedDishes, setNewlyAddedDishes] = useState<Dish[]>([]);
  const [bestSellerDishes, setBestSellerDishes] = useState<Dish[]>([]);

  // Review Form State
  const { user, profile } = useAuth();

  // Distance (km) when user has location
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const { addToCart } = useCart();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // By slug or id: load chef, then dishes + reviews + carousels in parallel before first paint (CLS).
  // Depends only on `raw` — not `isMobile` — so crossing the breakpoint does not refetch and shift layout.
  useEffect(() => {
    if (!raw) {
      setLoading(false);
      setChef(null);
      setDishes([]);
      setReviews([]);
      setNewlyAddedDishes([]);
      setBestSellerDishes([]);
      setError(null);
      setIsFetchingDishes(false);
      setIsFetchingReviews(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setChef(null);
    setDishes([]);
    setReviews([]);
    setNewlyAddedDishes([]);
    setBestSellerDishes([]);
    setIsFetchingDishes(true);
    setIsFetchingReviews(true);
    setChefImageError(false);

    (async () => {
      try {
        // Step 1: fetch chef (narrow select — only columns used on this page)
        const chefData = await getChefByIdOrSlug(raw);
        if (!mounted) return;
        if (!chefData) {
          setError('Chef not found');
          setLoading(false);
          setIsFetchingDishes(false);
          setIsFetchingReviews(false);
          return;
        }

        const cid = chefData.id;

        // Step 2: everything else in parallel (no "newly added" query — derived client-side)
        const [dishesRes, reviewsData, bestSellerIds] = await Promise.all([
          supabase
            .from('dishes')
            .select(DISH_LIST_SELECT, { count: 'exact' })
            .eq('chef_id', cid)
            .or('is_active.eq.true,is_active.is.null')
            .order('id', { ascending: true })
            .range(0, 499),
          getChefReviewsHelper(cid).catch((err) => {
            console.error('Error fetching chef reviews', err);
            return [] as ChefReview[];
          }),
          fetchBestSellerDishIds(cid),
        ]);

        if (!mounted) return;

        setChef(chefData);
        setChefImageError(false);

        const { data: dishRows, count } = dishesRes;
        const allDishes = (dishRows || []) as Dish[];
        setDishes(allDishes);
        setDishesTotal(count ?? allDishes.length);

        // Derive newly-added (last 30 days) from the full dish list — no extra query
        const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
        setNewlyAddedDishes(
          allDishes
            .filter((d) => d.created_at && new Date(d.created_at).getTime() >= since30)
            .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        );

        // Derive best-sellers from the full dish list + IDs from order_items
        const bestIdSet = new Set(bestSellerIds);
        setBestSellerDishes(allDishes.filter((d) => bestIdSet.has(d.id)));

        setReviews(reviewsData);
        setIsFetchingDishes(false);
        setIsFetchingReviews(false);
        setLoading(false);
      } catch (e: unknown) {
        console.error('Error loading chef page', e);
        if (mounted) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          setIsFetchingDishes(false);
          setIsFetchingReviews(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [raw]);

  useEffect(() => {
    setBioExpanded(false);
  }, [raw]);

  // Redirect numeric-ID URL to slug URL once we have chef (separate effect to avoid navigation loop). Only when pathname is actually the numeric URL (so refresh on slug URL doesn't redirect).
  useEffect(() => {
    if (!raw || !/^\d+$/.test(raw) || !chef?.slug) return;
    if (pathname !== `/chef/${raw}`) return;
    if (redirectToSlugTriggeredRef.current === raw) return;
    redirectToSlugTriggeredRef.current = raw;
    const slug = chef.slug;
    const id = setTimeout(() => {
      router.replace(`/chef/${slug}`);
    }, 0);
    return () => clearTimeout(id);
  }, [raw, pathname, chef?.slug, router]);

  // Compute distance when profile and chef have coords (with geocode fallback)
  useEffect(() => {
    if (!chef || !profile) {
      setDistanceKm(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      let userLat: number | null = typeof (profile as any)?.latitude === 'number' ? (profile as any).latitude : null;
      let userLon: number | null = typeof (profile as any)?.longitude === 'number' ? (profile as any).longitude : null;
      let chefLat: number | null = typeof (chef as any)?.latitude === 'number' ? (chef as any).latitude : null;
      let chefLon: number | null = typeof (chef as any)?.longitude === 'number' ? (chef as any).longitude : null;

      // Geocode user if we have location but no coords
      if ((userLat == null || userLon == null) && (profile as any)?.location?.trim()) {
        try {
          const { data } = await supabase.functions.invoke('google-geocode-forward', {
            body: { address: (profile as any).location },
          });
          if (!cancelled && data?.lat != null && data?.lng != null) {
            userLat = data.lat;
            userLon = data.lng;
          }
        } catch {
          // ignore
        }
      }

      // Geocode chef if we have location but no coords
      if ((chefLat == null || chefLon == null) && chef?.location?.trim()) {
        try {
          const { data } = await supabase.functions.invoke('google-geocode-forward', {
            body: { address: chef.location },
          });
          if (!cancelled && data?.lat != null && data?.lng != null) {
            chefLat = data.lat;
            chefLon = data.lng;
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled && userLat != null && userLon != null && chefLat != null && chefLon != null) {
        setDistanceKm(haversineKm(userLat, userLon, chefLat, chefLon));
      } else {
        setDistanceKm(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [chef, profile]);

  const avatar = chef?.photo || chef?.avatar || '';
  const title = (chef as any)?.brand_name?.trim() || chef?.name?.trim() || (chefId ? `Chef #${chefId}` : 'Chef');
  const location = chef?.location || '';
  const bio = chef?.bio ?? chef?.description ?? '';

  const avgRating = Number(chef?.rating ?? 0);
  const reviewCount = Number(chef?.rating_count ?? reviews.length);
  const dishCount = dishes.length;


  function handleAddToCart(d: Dish) {
    const img = d.image || d.thumbnail || '';
    const result = addToCart({ 
      id: d.id, 
      name: d.name || '', 
      price: d.price ?? 0, 
      quantity: 1, 
      image: img,
      chef_id: chefId,
    });
    if (result.success) {
      Alert.alert("Success", "Added to cart!");
    }
  }

  async function handleSubmitReview() {
    if (!chefId || !user) {
      Alert.alert("Authentication required", "Please sign in to submit reviews.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      Alert.alert("Rating required", "Please select 1–5 stars.");
      return;
    }

    try {
      setSubmittingReview(true);
      await submitChefReview({
        chefId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });

      const [chefData, updatedReviews] = await Promise.all([
        getChefById(chefId),
        getChefReviewsHelper(chefId),
      ]);
      if (chefData) setChef(chefData);
      setReviews(updatedReviews);

      setReviewRating(5);
      setReviewComment("");
      Alert.alert("Success", "Review submitted successfully!");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (error) {
    return (
      <Screen>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text style={{ color: 'tomato', fontFamily: theme.typography.fontFamily.body }}>Error: {error}</Text>
        </View>
      </Screen>
    );
  }
  if (loading || (!chef && !error)) {
    return (
      <Screen>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text style={{ color: BRAND_BLACK, fontFamily: theme.typography.fontFamily.body }}>Loading chef...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={styles.container}>
          {/* Column layout: chef card on top, then tabs + content, then disclaimer at bottom */}
          <View style={[styles.layout, styles.layoutColumn]}>
            {/* Chef card - full width on top */}
            <View style={[styles.sidebar, styles.sidebarFullWidth]}>
            <View style={styles.sidebarCard}>
              <View style={styles.chefCardRow}>
                {/* Image left-aligned */}
                <View style={styles.chefCardImageWrap}>
                  {avatar && !chefImageError ? (
                    <Image
                      source={{ uri: avatar }}
                      style={styles.chefCardAvatar}
                      resizeMode="cover"
                      onError={() => setChefImageError(true)}
                    />
                  ) : (
                    <View style={[styles.chefCardAvatar, styles.chefCardAvatarPlaceholder]}>
                      <Text style={styles.chefCardInitials}>
                        {title.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Name, cuisine, rating, location, distance - stacked on the right */}
                <View style={styles.chefCardInfo}>
                  <Text style={styles.chefCardName} numberOfLines={1}>{title}</Text>
                  <Text style={[styles.chefCardMetaText, isMobile && styles.chefCardMetaTextMobile, styles.chefCardCuisineLine]} numberOfLines={isMobile ? undefined : 1}>{formatCuisine(chef?.cuisine)}</Text>
                  {/* Rating and location on one line */}
                  <View style={styles.chefCardMetaRow}>
                    {avgRating > 0 ? (
                      <View style={styles.chefCardMetaItem}>
                        <Image source={require('../../assets/star.png')} style={[styles.chefCardMetaIcon, isMobile && styles.chefCardMetaIconMobile]} tintColor={STAR_COLOR} resizeMode="contain" />
                        <Text style={[styles.chefCardMetaText, isMobile && styles.chefCardMetaTextMobile]}>{avgRating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    {location && formatLocationCityState(location) ? (
                      <View style={styles.chefCardMetaItem}>
                        <Image source={require('../../assets/locationnewicon.png')} style={[styles.chefCardMetaIcon, isMobile && styles.chefCardMetaIconMobile]} tintColor={PRIMARY_COLOR} resizeMode="contain" />
                        <Text style={[styles.chefCardMetaText, isMobile && styles.chefCardMetaTextMobile]} numberOfLines={1}>{formatLocationCityState(location)}</Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Reserve one line on mobile so geocoded distance does not push content (CLS) */}
                  <View style={[styles.chefCardDistanceSlot, isMobile && styles.chefCardDistanceSlotMobile]}>
                    {distanceKm != null ? (
                      <View style={[styles.chefCardMetaRow, styles.chefCardDistanceRow]}>
                        <View style={styles.chefCardMetaItem}>
                          <Image source={require('../../assets/map.png')} style={[styles.chefCardMetaIcon, isMobile && styles.chefCardMetaIconMobile]} tintColor={PRIMARY_COLOR} resizeMode="contain" />
                          <Text style={[styles.chefCardMetaText, isMobile && styles.chefCardMetaTextMobile]}>{`${distanceKm.toFixed(1)} km`}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              {bio ? (
                <View style={styles.chefCardBioWrap}>
                  {isMobile && !bioExpanded && bio.length > 96 ? (
                    <View style={styles.chefCardBioStack}>
                      <Text
                        style={[styles.chefCardMetaText, styles.chefCardMetaTextMobile, styles.chefCardBioText]}
                        numberOfLines={2}
                      >
                        {bio}
                      </Text>
                      <TouchableOpacity onPress={() => setBioExpanded(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.chefCardBioSeeMore}>
                        <Text style={[styles.chefCardMetaText, styles.chefCardMetaTextMobile, styles.chefCardBioSeeMoreText]}>See more</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isMobile && bioExpanded ? (
                    <>
                      <Text style={[styles.chefCardMetaText, styles.chefCardMetaTextMobile, styles.chefCardBioText]}>{bio}</Text>
                      <TouchableOpacity onPress={() => setBioExpanded(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.chefCardBioSeeMore}>
                        <Text style={[styles.chefCardMetaText, styles.chefCardMetaTextMobile, styles.chefCardBioSeeMoreText]}>See less</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text
                      style={[styles.chefCardMetaText, isMobile && styles.chefCardMetaTextMobile, styles.chefCardBioText]}
                    >
                      {bio}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </View>

          {/* Tabs + content - full width below chef card */}
          <View style={[styles.mainContent, styles.mainContentFullWidth]}>
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                style={[styles.tab, activeTab === 'dishes' && styles.tabActive]}
                onPress={() => setActiveTab('dishes')}
              >
                <Text style={[styles.tabText, activeTab === 'dishes' && styles.tabTextActive]}>
                  Dishes
                </Text>
                </TouchableOpacity>
                    <TouchableOpacity
                style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
                onPress={() => setActiveTab('reviews')}
              >
                <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
                  Reviews
                </Text>
                    </TouchableOpacity>
            </View>

            {/* Content based on active tab */}
            <View style={[styles.contentScroll, isMobile && activeTab === 'dishes' && styles.contentScrollMobile]}>
              {activeTab === 'dishes' ? (
                <>
                  {isFetchingDishes && !newlyAddedDishes.length && !bestSellerDishes.length ? (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                      <Text style={styles.loadingText}>Loading dishes...</Text>
                    </View>
                  ) : (
                    <>
                      {/* Newly added meals - last 30 days (only when there is data) */}
                      {newlyAddedDishes.length > 0 && (
                        <View style={styles.sectionBlock}>
                          <Text style={styles.sectionTitle}>Newly added meals</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent} style={styles.horizontalScroll}>
                            {newlyAddedDishes.map(d => (
                              <View key={d.id} style={styles.dishCardHorizontal}>
                                <DishCard dish={{ ...d, chef: '', chefs: {} }} variant="explore" inlinePriceRating quantityOnImage />
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* Best-sellers now - sold in last 90 days (only when there is data) */}
                      {bestSellerDishes.length > 0 && (
                        <View style={styles.sectionBlock}>
                          <Text style={styles.sectionTitle}>Best-sellers now</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent} style={styles.horizontalScroll}>
                            {bestSellerDishes.map(d => (
                              <View key={d.id} style={styles.dishCardHorizontal}>
                                <DishCard dish={{ ...d, chef: '', chefs: {} }} variant="explore" inlinePriceRating quantityOnImage />
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* Full menu - vertical grid, 2 cols mobile like explore */}
                      <View style={[styles.sectionBlock, isMobile && styles.sectionBlockLast]}>
                        <Text style={styles.sectionTitle}>Full menu</Text>
                        {dishes.length === 0 ? (
                          <Text style={styles.sectionEmpty}>No dishes yet.</Text>
                        ) : (
                          <View style={styles.dishGridAll}>
                            {dishes.map(d => (
                              <View key={d.id} style={[styles.dishCardGridWrapper, isMobile && styles.dishCardGridWrapperMobile, { width: `${100 / dishGridColumns}%` }]}>
                                <DishCard dish={{ ...d, chef: '', chefs: {} }} variant="explore" inlinePriceRating quantityOnImage />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.reviewsContent}>
                  {/* Review form for signed-in users */}
                  {user && (
                    <View style={styles.reviewForm}>
                      <Text style={styles.reviewFormTitle}>Leave a Review</Text>
                      <View style={styles.ratingSelector}>
                        <Text style={styles.ratingLabel}>Rating</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                              <Image 
                                source={require('../../assets/star.png')} 
                                style={styles.starButtonImage}
                                tintColor={star <= reviewRating ? STAR_COLOR : TEXT_MUTED}
                                resizeMode="contain" 
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={styles.commentInputContainer}>
                        <Text style={styles.commentLabel}>Comment (optional)</Text>
                        <TextInput
                          value={reviewComment}
                          onChangeText={setReviewComment}
                          placeholder="Share your experience..."
                          placeholderTextColor={TEXT_MUTED}
                          multiline
                          numberOfLines={3}
                          style={styles.commentInput}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={handleSubmitReview}
                        disabled={submittingReview}
                        style={[styles.submitButton, submittingReview && styles.submitButtonDisabled]}
                      >
                        <Text style={styles.submitButtonText}>
                          {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Reviews list */}
                  {isFetchingReviews ? (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                      <Text style={styles.loadingText}>Loading reviews...</Text>
                    </View>
                  ) : reviews.length === 0 ? (
                    <Text style={styles.emptyText}>No reviews yet.</Text>
                  ) : (
                    <View style={styles.reviewsList}>
          {reviews.map(r => (
                        <View key={r.id} style={styles.reviewCard}>
                          <View style={styles.reviewHeader}>
                            <View style={styles.reviewRating}>
                              <Image 
                                source={require('../../assets/star.png')} 
                                style={styles.reviewStarImage} 
                                tintColor={STAR_COLOR}
                                resizeMode="contain" 
                              />
                              <Text style={styles.reviewRatingValue}>{r.rating.toFixed(1)}</Text>
                            </View>
                            {r.user_name ? (
                              <Text style={styles.reviewAuthor}>{r.user_name}</Text>
                            ) : null}
                            {r.created_at ? (
                              <Text style={styles.reviewDate}>
                                {new Date(r.created_at).toLocaleDateString()}
                              </Text>
                            ) : null}
              </View>
                          {r.comment ? (
                            <Text style={styles.reviewComment}>{r.comment}</Text>
                          ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
              )}
            </View>
          </View>

          {/* Disclaimer before footer */}
          <View style={[styles.disclaimerBlock, isMobile && styles.disclaimerBlockMobile]}>
            <Text style={styles.disclaimerText}>
              Food is prepared by an independent home chef. Customers are responsible for safe handling after pickup.
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Platform.select({
      web: theme.spacing['3xl'],
      default: theme.spacing.sm,
    }),
    paddingVertical: theme.spacing['2xl'],
    paddingBottom: 80,
  },
  layout: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'stretch',
  },
  layoutColumn: {},
  sidebar: {
    width: '100%',
    maxWidth: '100%',
  },
  sidebarFullWidth: {
    width: '100%',
    maxWidth: '100%',
    position: 'relative',
    top: 0,
  },
  sidebarCard: {
    flex: 1,
    minHeight: 160,
    gap: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...Platform.select({
      default: { flexGrow: 0, flexShrink: 0, flex: 0 },
      web: {},
    }),
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: 'none' },
      android: { elevation: 0 },
      default: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
    }),
  },
  chefCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  chefCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  chefCardDistanceRow: {
    marginTop: 0,
  },
  chefCardDistanceSlot: {},
  chefCardDistanceSlotMobile: {
    minHeight: 26,
  },
  chefCardImageWrap: {
    width: Platform.select({ web: 96, default: 80 }),
    height: Platform.select({ web: 96, default: 80 }),
    flexShrink: 0,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  chefCardAvatar: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Platform.select({ web: 48, default: 40 }),
    backgroundColor: BACKGROUND_LIGHT,
  },
  chefCardAvatarPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Platform.select({ web: 48, default: 40 }),
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefCardInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  chefCardName: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'left',
    ...Platform.select({
      web: {
        fontSize: 20,
        lineHeight: 26,
      },
      default: {},
    }),
  },
  chefCardCuisineLine: {
    textAlign: 'left',
  },
  chefCardCuisine: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.base,
    ...Platform.select({
      web: {
        lineHeight: 22,
      },
      default: { fontSize: 14 },
    }),
  },
  chefCardBioWrap: {
    width: '100%',
    paddingTop: theme.spacing.sm,
    paddingBottom: 0,
    marginBottom: -theme.spacing.xs,
  },
  chefCardBioStack: {
    gap: theme.spacing.xs,
  },
  chefCardBioText: {
    textAlign: 'left',
  },
  chefCardBioSeeMore: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  chefCardBioSeeMoreText: {
    color: PRIMARY_COLOR,
    textAlign: 'center',
  },
  chefCardBio: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.xs,
    lineHeight: 16,
    ...Platform.select({
      web: {
        fontSize: theme.typography.fontSize.sm,
        lineHeight: 22,
      },
      default: {},
    }),
  },
  chefCardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    ...Platform.select({
      web: { marginTop: 8, gap: 6 },
      default: {},
    }),
  },
  chefCardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Platform.select({ web: 16, default: 6 }),
  },
  chefCardMetaItemDistance: {
    gap: 6,
  },
  chefCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  chefCardMetaIcon: {
    width: 20,
    height: 20,
  },
  chefCardMetaIconMobile: {
    width: 18,
    height: 18,
  },
  chefCardMetaText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  chefCardMetaTextMobile: {
    fontSize: 14,
  },
  chefCardLocationIcon: {
    width: 16,
    height: 16,
    ...Platform.select({
      web: { width: 18, height: 18 },
      default: {},
    }),
  },
  chefCardLocation: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    ...Platform.select({
      web: {
        fontSize: theme.typography.fontSize.base,
        lineHeight: 22,
      },
      default: {},
    }),
  },
  chefCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    ...Platform.select({
      web: { marginTop: 8, gap: 6 },
      default: {},
    }),
  },
  chefCardStarIcon: {
    width: 16,
    height: 16,
    ...Platform.select({
      web: { width: 18, height: 18 },
      default: {},
    }),
  },
  chefCardRatingText: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    ...Platform.select({
      web: {
        fontSize: theme.typography.fontSize.base,
        lineHeight: 22,
      },
      default: {},
    }),
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 111,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    alignItems: 'flex-start',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
  },
  statValue: {
    color: BRAND_BLACK,
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 24 * 1.2,
  },
  starIcon: {
    fontSize: 20,
    color: STAR_COLOR,
  },
  starIconImage: {
    width: 20,
    height: 20,
  },
  statLabel: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  bioSection: {
    gap: theme.spacing.sm,
  },
  bioTitle: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  bioText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.6,
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
  mainContentFullWidth: {
    width: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing['2xl'],
    minHeight: 40,
    paddingTop: 4,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  tab: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
  },
  tabActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabText: {
    color: BRAND_BLACK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    letterSpacing: 0.015,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.fontWeight.normal,
  },
  sectionBlock: {
    marginBottom: theme.spacing['2xl'],
    width: '100%',
  },
  sectionBlockLast: {
    marginBottom: 0,
  },
  sectionTitle: {
    width: '100%',
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  sectionEmpty: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontStyle: 'italic',
  },
  horizontalScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  horizontalScrollContent: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dishCardHorizontal: {
    width: 180,
    flexShrink: 0,
  },
  dishGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    width: '100%',
  },
  dishGridAll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  dishCardGridWrapper: {
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  dishCardGridWrapperMobile: {
    marginBottom: 8,
  },
  filterContainer: {
    paddingVertical: theme.spacing['2xl'],
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
    justifyContent: Platform.select({
      web: 'flex-end',
      default: 'flex-start',
    }),
  },
  filterLabel: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  selectPlaceholder: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    minWidth: 150,
  },
  selectText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  selectPlaceholderActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: PRIMARY_COLOR + '14',
  },
  selectTextActive: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.medium,
  },
  contentScroll: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing['4xl'],
  },
  contentScrollMobile: {
    paddingBottom: theme.spacing.sm,
  },
  dishesGrid: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column', // Column layout on mobile for 1 dish per row
    }),
    flexWrap: Platform.select({
      web: 'wrap',
      default: 'nowrap',
    }),
    justifyContent: 'flex-start',
    width: '100%',
    gap: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.md,
    }),
  },
  dishCard: {
    width: Platform.select({
      web: '23%', // 4 columns on desktop with gap
      default: '100%', // 1 column on mobile (1 dish per row)
    }),
    marginBottom: 0, // Gap handles spacing
    overflow: 'hidden',
    borderRadius: Platform.select({
      web: theme.radius.xl,
      default: theme.radius.lg,
    }),
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    ...elev('sm'),
  },
  dishImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: BACKGROUND_LIGHT,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BACKGROUND_LIGHT,
  },
  dishImagePlaceholderText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  dishInfo: {
    padding: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.sm,
    }),
    flex: 1,
    gap: Platform.select({
      web: theme.spacing.md,
      default: theme.spacing.sm,
    }),
  },
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: Platform.select({
      web: 24,
      default: 18,
    }),
    marginBottom: Platform.select({
      web: 0,
      default: theme.spacing.xs / 2,
    }),
  },
  dishName: {
    flex: 1,
    color: BRAND_BLACK,
    fontSize: Platform.select({
      web: 13,
      default: 11,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    flexShrink: 1,
    paddingRight: Platform.select({
      web: 4,
      default: 2,
    }),
    maxWidth: Platform.select({
      web: '70%',
      default: '65%', // More space for price on mobile
    }),
  },
  dishPrice: {
    color: BRAND_BLACK,
    fontSize: Platform.select({
      web: 13,
      default: 11,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    flexShrink: 0,
    marginLeft: 'auto',
    minWidth: Platform.select({
      web: 50,
      default: 45,
    }),
  },
  dishDescription: {
    color: BRAND_BLACK,
    fontSize: Platform.select({
      web: theme.typography.fontSize.sm,
      default: 10,
    }),
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: Platform.select({
      web: theme.typography.fontSize.sm * 1.5,
      default: 14,
    }),
    flex: 1,
    marginBottom: Platform.select({
      web: theme.spacing.sm,
      default: theme.spacing.xs,
    }),
  },
  addToCartButton: {
    width: '100%',
    height: Platform.select({
      web: 40,
      default: 32,
    }),
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Platform.select({
      web: 'auto',
      default: theme.spacing.xs,
    }),
  },
  addToCartButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({
      web: theme.typography.fontSize.sm,
      default: 10,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  reviewsContent: {
    gap: theme.spacing['2xl'],
  },
  reviewForm: {
    padding: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
    gap: theme.spacing.md,
  },
  reviewFormTitle: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  ratingSelector: {
    gap: theme.spacing.sm,
  },
  ratingLabel: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  starsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  starButton: {
    fontSize: 24,
  },
  starButtonImage: {
    width: 24,
    height: 24,
  },
  commentInputContainer: {
    gap: theme.spacing.sm,
  },
  commentLabel: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reviewsList: {
    gap: theme.spacing.md,
  },
  reviewCard: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
    gap: theme.spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
  },
  reviewStar: {
    fontSize: theme.typography.fontSize.sm,
    color: STAR_COLOR,
  },
  reviewStarImage: {
    width: 14,
    height: 14,
  },
  reviewRatingValue: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
  },
  reviewAuthor: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  reviewDate: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.body,
    marginLeft: 'auto',
  },
  reviewComment: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  emptyText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
  loader: {
    paddingVertical: theme.spacing['4xl'],
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    width: '100%',
  },
  pageButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  pageButtonTextDisabled: {
    color: BRAND_BLACK,
  },
  pageInfo: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  // Mobile Styles
  layoutMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  sidebarMobile: {
    width: '100%',
    maxWidth: '100%',
    position: 'relative',
    top: 0,
  },
  mainContentMobile: {
    width: '100%',
  },
  dishesGridMobile: {
    flexDirection: 'column',
  },
  dishCardMobile: {
    width: '100%',
  },
  disclaimerBlock: {
    marginTop: 0,
    marginBottom: 2,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: 0,
    paddingBottom: 2,
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  disclaimerBlockMobile: {
    marginTop: -4,
    paddingTop: 0,
  },
  disclaimerText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    textAlign: 'center',
  },
});