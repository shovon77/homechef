import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput, StyleSheet, Platform, useWindowDimensions, findNodeHandle } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { theme, elev } from "../../lib/theme";
import { getDishById, getDishRatings, getChefById, getDishWithChef, getDishReviews } from "../../lib/db";
import { submitDishRating, getDishRatingSummary } from "../../lib/reviews";
import type { Dish, DishWithChef, DishRating } from "../../lib/types";
import { useCart } from "../../context/CartContext";
import { useRole } from "../../hooks/useRole";
import { Screen } from "../../components/Screen";
import { formatCad } from "../../lib/money";
import { NAVBAR_HEIGHT } from "../../constants/layout";

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F2F0EF';
const BRAND_BLACK = '#33393A';
const TEXT_DARK = BRAND_BLACK;
const TEXT_MUTED = BRAND_BLACK;
const TEXT_GRAY = BRAND_BLACK;
const BORDER_LIGHT = '#e5e7eb';

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
const REVIEWS_SECTION_ID = 'dish-tabs-section';

export default function DishDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  // On web, `window.innerWidth` can change when the vertical scrollbar appears/disappears,
  // which can flip `isMobile` and cause layout jumps (e.g., when toggling Chef notes).
  const viewportWidth =
    Platform.OS === 'web' && typeof document !== 'undefined'
      ? document.documentElement.clientWidth
      : width;
  const isMobile = viewportWidth < 768;
  const pageScrollRef = useRef<any>(null);
  const tabsSectionRef = useRef<View | null>(null);
  const [tabsSectionY, setTabsSectionY] = useState(0);
  const tabsSectionYRef = useRef(0);
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  
  const dishId = useMemo(() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g,'');
    return tail ? Number(tail) : NaN;
  }, [raw]);

  const [dish, setDish] = useState<DishWithChef | null>(null);
  const [chef, setChef] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [reviews, setReviews] = useState<DishRating[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDishOwner, setIsDishOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'reviews'>('ingredients');
  const [chefNotes, setChefNotes] = useState("");
  const { items: cartItems, addToCart, setQuantity: setCartQuantity, setNotes: setCartNotes, getQty } = useCart();
  const { isAdmin, user } = useRole();

  // 1. Fetch public data (dish, ratings) - depends only on dishId
  useEffect(() => {
    if (!Number.isFinite(dishId)) {
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    (async () => {
      // We don't set loading to true here if dish is already loaded (e.g. revalidation)
      // but since this runs on mount or id change, we usually want loading true.
      // However, for speed, we can start fetching immediately.
      if (!dish) setLoading(true);
      
      try {
        // Fetch dish first for faster TTI
        const dishData = await getDishWithChef(dishId);
        
        if (!mounted) return;

        if (!dishData) {
          console.log("Dish not found");
          setLoading(false);
          return;
        }

        // Render dish immediately
        setDish(dishData);
        setLoading(false); // Stop loading spinner as soon as we have the dish

        // Set chef info from joined data
        if (dishData.chefs) {
          setChef(dishData.chefs);
        } else if (dishData.chef_id) {
          const chefData = await getChefById(Number(dishData.chef_id));
          if (mounted && chefData) {
            setChef(chefData);
          }
        }

        // Fetch ratings in background
        getDishRatings(dishId).then(ratingStats => {
          if (mounted) {
            setRatingCount(ratingStats.count);
            setAvgRating(ratingStats.average);
          }
        });

        // Fetch reviews in background
        getDishReviews(dishId).then(reviewsData => {
          if (mounted) {
            setReviews(reviewsData);
          }
        });

      } catch (e) {
        console.error("Error loading dish details:", e);
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [dishId]);

  // 2. Fetch user-specific data - depends on dishId and user.id
  useEffect(() => {
    if (!Number.isFinite(dishId) || !user) {
      // Reset user-specific state if user logs out
      if (!user) {
        setIsDishOwner(false);
        setUserRating(0);
        setComment("");
      }
      return;
    }

    let mounted = true;

    (async () => {
      try {
        // Check ownership if chef is loaded (or check against chef_id directly if possible)
        // We rely on 'chef' state which might be populated by the first effect.
        // Alternatively, we can re-check ownership here if we have dish data.
        
        // Fetch user's existing rating
        const { data: userRatingData } = await supabase
          .from("dish_ratings")
          .select("rating, stars, comment")
          .eq("dish_id", dishId)
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (mounted && userRatingData) {
          const rating = userRatingData.rating ?? userRatingData.stars ?? 0;
          setUserRating(Number(rating));
          setComment(userRatingData.comment || "");
        }
      } catch (e) {
        console.error("Error loading user rating:", e);
      }
    })();

    return () => { mounted = false; };
  }, [dishId, user]);

  // Update ownership when chef or user changes
  useEffect(() => {
    if (chef && user) {
      let ownsDish = false;
      if (chef.user_id) {
        ownsDish = chef.user_id === user.id;
      } else if (chef.email && user.email) {
        ownsDish = chef.email.toLowerCase() === user.email.toLowerCase();
      }
      setIsDishOwner(ownsDish);
    } else {
      setIsDishOwner(false);
    }
  }, [chef, user]);

  const handleSubmitRating = async () => {
    if (!userRating || userRating < 1 || userRating > 5) {
      Alert.alert("Rating required", "Please select 1–5 stars.");
      return;
    }

    if (!user) {
      Alert.alert("Authentication required", "Please sign in to rate dishes.");
      return;
    }

    try {
      setSubmitting(true);
      
      const summary = await submitDishRating({
        dishId,
        stars: userRating,
        comment: comment.trim() || undefined,
      });

      setRatingCount(summary.count);
      setAvgRating(summary.avg);
      
      // Refresh reviews
      const updatedReviews = await getDishReviews(dishId);
      setReviews(updatedReviews);

      const { data: userRatingData } = await supabase
        .from("dish_ratings")
        .select("rating, stars, comment")
        .eq("dish_id", dishId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (userRatingData) {
        const rating = userRatingData.rating ?? userRatingData.stars ?? 0;
        setUserRating(Number(rating));
        setComment(userRatingData.comment || "");
      }

      Alert.alert("Success", "Rating submitted successfully!");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
    const full = Math.floor(safe);
    const hasHalf = safe - full >= 0.5;
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const opacity = idx <= full ? 1 : (hasHalf && idx === full + 1 ? 0.6 : 0.25);
          return (
            <Image
              key={`s${i}`}
              source={require('../../assets/star.png')}
              style={[styles.starIconImage, { opacity }]}
              resizeMode="contain"
            />
          );
        })}
      </View>
    );
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
  if (!dish) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: TEXT_MUTED }}>Dish not found.</Text>
        </View>
      </Screen>
    );
  }

  const chefId = dish.chef_id != null ? Number(dish.chef_id) : null;
  const chefName = chef?.name || dish.chef || 'Chef';
  const mainImage = dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80&auto=format&fit=crop";
  const thumbnailImages = [mainImage, mainImage, mainImage, mainImage]; // Placeholder - could be expanded

  const cartQty = getQty(dish.id);
  const existingNotes = cartItems.find(i => i.id === dish.id)?.notes ?? '';

  // Keep the input prefilled from cart notes when available (without overwriting user edits).
  useEffect(() => {
    if (existingNotes && !chefNotes.trim()) {
      setChefNotes(existingNotes);
    }
  }, [existingNotes]);

  const scrollToReviews = () => {
    setActiveTab('reviews');

    const tryScroll = () => {
      const baseY = tabsSectionYRef.current || tabsSectionY || 0;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          // Prefer the actual rendered node for this screen. After client-side navigation,
          // the DOM can contain hidden screens and `getElementById` may hit the wrong element.
          const refEl: any = tabsSectionRef.current as any;
          if (refEl?.scrollIntoView) {
            refEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }

          const el =
            (document.getElementById(REVIEWS_SECTION_ID) as HTMLElement | null) ??
            (document.querySelector(`[data-testid="${REVIEWS_SECTION_ID}"]`) as HTMLElement | null);
          if (el) {
            // Prefer native browser behavior; it finds the correct scroll container.
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        } catch {}
      }

      if (Platform.OS !== 'web') {
        const scrollRef: any = pageScrollRef.current;
        if (scrollRef?.scrollTo && tabsSectionRef.current) {
          try {
            const inner = scrollRef?.getInnerViewNode?.() ?? scrollRef;
            const handle = findNodeHandle(inner);
            if (handle) {
              tabsSectionRef.current.measureLayout(
                handle as any,
                (_x, y) => scrollRef.scrollTo({ y: Math.max(0, y), animated: true }),
                () => {
                  const fallbackY = baseY > 0 ? Math.max(0, baseY) : 9999;
                  scrollRef.scrollTo({ y: fallbackY, animated: true });
                }
              );
              return;
            }
          } catch {
            // fall through to baseY scroll
          }
        }
      }

      const y = baseY > 0 ? Math.max(0, baseY) : 9999;
      pageScrollRef.current?.scrollTo?.({ y, animated: true });
    };

    requestAnimationFrame(tryScroll);
    setTimeout(tryScroll, 100);
    setTimeout(tryScroll, 300);
    setTimeout(tryScroll, 800);
    setTimeout(() => pageScrollRef.current?.scrollToEnd?.({ animated: true }), 950);
  };

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }} scrollRef={pageScrollRef}>
      <View style={{ paddingBottom: 120 }}>
        <View style={styles.container}>
        {/* Breadcrumbs - REMOVED */}
        {/* Main Content Grid */}
        <View
          style={[
            styles.grid,
            Platform.OS === 'web' && !isMobile && styles.gridWeb,
            isMobile && styles.gridMobile,
          ]}
        >
          {/* Left Column: Image Gallery */}
          <View style={styles.imageColumn}>
            <View style={styles.mainImageContainer}>
              <Image
                source={{ uri: mainImage }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Right Column: Dish Info & Actions */}
          <View style={[styles.infoColumn, isMobile && styles.infoColumnMobile]}>
            <Text style={[styles.dishTitle, isMobile && styles.dishTitleMobile]}>
              {dish.name}
            </Text>
            
            {chefId ? (
              <Link href={{ 
                pathname: "/chef/[id]", 
                params: { 
                  id: String(chefId),
                  name: chefName,
                  photo: chef?.photo || chef?.avatar || "",
                  location: chef?.location || "",
                  rating: chef?.rating?.toString() || "",
                  rating_count: chef?.rating_count?.toString() || "",
                } 
              }} asChild>
                <TouchableOpacity style={styles.chefLink}>
                  {chef?.photo || chef?.avatar ? (
                    <Image 
                      source={{ uri: chef.photo || chef.avatar }} 
                      style={styles.chefAvatar} 
                    />
                  ) : (
                    <Text style={styles.chefIcon}>🏪</Text>
                  )}
                  <Text style={styles.chefLinkText}>{chefName}</Text>
                </TouchableOpacity>
              </Link>
            ) : (
              <View style={styles.chefLink}>
                <Text style={styles.chefIcon}>🏪</Text>
                <Text style={styles.chefLinkText}>{chefName}</Text>
              </View>
            )}

            {/* Rating */}
            <TouchableOpacity style={styles.ratingContainer} activeOpacity={0.7} onPress={scrollToReviews}>
              {renderStars(avgRating)}
              <Text style={styles.reviewCount} onPress={scrollToReviews}>
                ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
              </Text>
            </TouchableOpacity>

            {/* Description */}
            {dish.description ? (
              <Text style={styles.description}>{dish.description}</Text>
            ) : null}

            {/* Price */}
            <Text style={[styles.price, isMobile && styles.priceMobile]}>{formatCad(dish.price)}</Text>

            {/* Cart controls (same layout as explore DishCard) */}
            <View style={styles.actionRow}>
              {cartQty === 0 ? (
                <View style={styles.qtyRowSpread}>
                  <View style={styles.qtyRowLeft} />
                  <View style={styles.qtyRowRight}>
                    <TouchableOpacity
                      style={styles.qtyIconBtn}
                      activeOpacity={0.7}
                      onPress={() => {
                        addToCart({
                          id: dish.id,
                          name: dish.name || '',
                          price: Number(dish.price || 0),
                          quantity: 1,
                          image: dish.image || undefined,
                          chef_id: dish.chef_id || null,
                          notes: chefNotes.trim() || undefined,
                        });
                        setChefNotes('');
                      }}
                    >
                      <Image
                        source={require('../../assets/add (1).png')}
                        style={styles.qtyIconImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.qtyRowSpread}>
                  <View style={styles.qtyRowLeft}>
                    <TouchableOpacity
                      style={styles.qtyIconBtn}
                      activeOpacity={0.7}
                      onPress={() => setCartQuantity(dish.id, cartQty - 1)}
                    >
                      <Image
                        source={require('../../assets/minus.png')}
                        style={styles.qtyIconImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.qtyValue}>{cartQty}</Text>
                  <View style={styles.qtyRowRight}>
                    <TouchableOpacity
                      style={styles.qtyIconBtn}
                      activeOpacity={0.7}
                      onPress={() => {
                        addToCart({
                          id: dish.id,
                          name: dish.name || '',
                          price: Number(dish.price || 0),
                          quantity: 1,
                          image: dish.image || undefined,
                          chef_id: dish.chef_id || null,
                          notes: chefNotes.trim() || undefined,
                        });
                        if (chefNotes.trim()) setChefNotes('');
                      }}
                    >
                      <Image
                        source={require('../../assets/add (1).png')}
                        style={styles.qtyIconImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Chef Notes Input */}
            <View style={styles.notesContainer}>
              <Text style={styles.notesButtonText}>Chef notes</Text>
              <TextInput
                style={styles.notesInput}
                value={chefNotes}
                onChangeText={(t) => {
                  setChefNotes(t);
                  if (cartQty > 0) {
                    setCartNotes(dish.id, t);
                  }
                }}
                placeholder="Add notes for the chef (e.g., no onions)"
                placeholderTextColor={TEXT_MUTED}
                multiline
              />
            </View>
          </View>
        </View>

        {/* Tabs Section */}
        <View
          style={styles.tabsSection}
          nativeID={REVIEWS_SECTION_ID}
          {...(Platform.OS === 'web' ? ({ id: REVIEWS_SECTION_ID } as any) : {})}
          testID={REVIEWS_SECTION_ID}
          ref={tabsSectionRef}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            tabsSectionYRef.current = y;
            setTabsSectionY(y);
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
              onPress={() => setActiveTab('ingredients')}
            >
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                Allergens & Ingredients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
              onPress={() => setActiveTab('reviews')}
            >
              <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
                Customer Reviews
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.tabContent}>
            {activeTab === 'ingredients' && (
              <View style={styles.ingredientsContent}>
                {dish.ingredients ? (
                  <Text style={styles.descriptionText}>{dish.ingredients}</Text>
                ) : (
                  <Text style={styles.emptyText}>Allergens and ingredients information coming soon.</Text>
                )}
              </View>
            )}

            {activeTab === 'reviews' && (
              <View style={styles.reviewsContent}>
                {/* Rating form for signed-in users */}
                {user && (
                  <View style={styles.reviewForm}>
                    <Text style={styles.reviewFormTitle}>
                      {userRating > 0 ? 'Update your rating' : 'Rate this dish'}
                    </Text>
                    
                    <View style={styles.ratingInputContainer}>
                      <Text style={styles.ratingLabel}>Rating (required)</Text>
                      <View style={styles.starsInputRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                            <Image
                              source={require('../../assets/star.png')}
                              style={[
                                styles.starInputIcon,
                                { opacity: star <= userRating ? 1 : 0.25 }
                              ]}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.commentInputContainer}>
                      <Text style={styles.commentLabel}>Comment (optional)</Text>
                      <TextInput
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Share your thoughts..."
                        placeholderTextColor={TEXT_MUTED}
                        multiline
                        numberOfLines={4}
                        style={styles.commentInput}
                      />
                    </View>

                <TouchableOpacity
                      onPress={handleSubmitRating}
                      disabled={submitting || !userRating}
                      style={[styles.submitButton, (submitting || !userRating) && styles.submitButtonDisabled]}
                    >
                      <Text style={styles.submitButtonText}>
                        {submitting ? "Submitting..." : userRating > 0 ? "Update Rating" : "Submit Rating"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Current rating display */}
                {ratingCount > 0 && (
                  <View style={styles.ratingSummary}>
                    <View style={styles.ratingSummaryRow}>
                      {renderStars(avgRating)}
                      <Text style={styles.ratingSummaryText}>
                        {avgRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
                      </Text>
                    </View>
                  </View>
                )}

                {/* Reviews List */}
                <View style={styles.reviewsList}>
                  {reviews.map((review) => (
                    <View key={review.id} style={styles.reviewItem}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewerName}>{review.user_name || 'Anonymous'}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at || Date.now()).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.reviewStars}>
                        {renderStars(review.rating || review.stars || 0)}
                      </View>
                      {review.comment ? (
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>

                {!user && (
                  <Text style={styles.signInPrompt}>
                    Please sign in to leave a review.
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.footerWarning}>
          <Text style={styles.footerWarningText}>
            The food is prepared by an independent home chef. Please handle it safely after pickup.
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
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.md,
    }),
    paddingVertical: theme.spacing['2xl'],
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
    flexWrap: 'wrap',
  },
  breadcrumbLink: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  breadcrumbSeparator: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  breadcrumbCurrent: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  grid: {
    flexDirection: 'column',
    rowGap: 0,
    columnGap: 0,
    marginBottom: theme.spacing['4xl'],
  },
  gridWeb: {
    flexDirection: 'row',
    rowGap: theme.spacing['2xl'],
    columnGap: theme.spacing['2xl'],
  },
  imageColumn: {
    flex: 1,
  },
  mainImageContainer: {
    width: '100%',
    maxWidth: 480, // Limit width to be smaller
    aspectRatio: 1,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start', // Or center
    marginBottom: 0,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  infoColumn: {
    flex: 1,
    paddingTop: 0,
  },
  infoColumnMobile: {
    paddingTop: 0,
  },
  dishTitle: {
    color: TEXT_DARK,
    fontSize: Platform.select({
      web: 36,
      default: 28,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: Platform.select({
      web: 36 * 1.2,
      default: 28 * 1.2,
    }),
    letterSpacing: -0.033,
    marginTop: theme.spacing.md,
    position: 'relative',
    zIndex: 2,
  },
  dishTitleMobile: {
    fontSize: 28,
    lineHeight: 28 * 1.25,
  },
  chefLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 0,
    flexShrink: 1,
  },
  chefIcon: {
    fontSize: theme.typography.fontSize.lg,
  },
  chefAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  chefLinkText: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIconImage: {
    width: 18,
    height: 18,
    tintColor: PRIMARY_COLOR,
  },
  reviewCount: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  description: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.5,
    marginTop: theme.spacing.md,
  },
  price: {
    color: TEXT_DARK,
    fontSize: 28,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
  },
  priceMobile: {
    fontSize: 24,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  actionRow: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  qtyRowSpread: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 40,
  },
  qtyRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  qtyRowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  qtyIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyIconImage: {
    width: 20,
    height: 20,
    tintColor: PRIMARY_COLOR,
  },
  qtyValue: {
    minWidth: 32,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_LIGHT,
    padding: theme.spacing.xs / 2,
    ...Platform.select({
      web: {
        width: 'auto',
      },
      default: {
        width: '100%',
        justifyContent: 'space-between',
      },
    }),
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  quantityButtonText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  quantityValue: {
    width: 48,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
    paddingHorizontal: theme.spacing['2xl'],
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
  },
  cartIcon: {
    fontSize: 20,
  },
  addToCartButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  tabsSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: Platform.select({
      web: 1,
      default: 0, // Remove top border on mobile
    }),
    borderTopColor: Platform.select({
      web: BORDER_LIGHT,
      default: 'transparent',
    }),
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: 'transparent',
  },
  tabText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  tabContent: {
    paddingVertical: theme.spacing['2xl'],
  },
  descriptionText: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
  },
  ingredientsContent: {
    gap: theme.spacing.md,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  ratingInputContainer: {
    gap: theme.spacing.sm,
  },
  ratingLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  starsInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  starInput: {
    fontSize: 28,
  },
  starInputIcon: {
    width: 24,
    height: 24,
    tintColor: PRIMARY_COLOR,
  },
  commentInputContainer: {
    gap: theme.spacing.sm,
  },
  commentLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    minHeight: 100,
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
  ratingSummary: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ratingSummaryText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  signInPrompt: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  // Mobile styles
  gridMobile: {
    flexDirection: 'column',
    rowGap: 0,
    columnGap: 0,
  },
  reviewsList: {
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  reviewItem: {
    padding: theme.spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    gap: theme.spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reviewDate: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.body,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewComment: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  footerWarning: {
    marginTop: theme.spacing['4xl'],
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    alignItems: 'flex-start', // Changed from center to flex-start for left alignment
  },
  footerWarningText: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontFamily: 'OpenSans_400Regular',
    textAlign: 'left', // Changed from center to left
    maxWidth: 600,
    lineHeight: 24,
  },
  notesContainer: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
    width: '100%',
    paddingHorizontal: theme.spacing.md,
  },
  notesButton: {
    alignSelf: 'flex-start',
    paddingTop: theme.spacing.sm,
    paddingBottom: 0,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  notesButtonIcon: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: 'OpenSans_400Regular',
    fontWeight: theme.typography.fontWeight.bold,
    width: 20,
    textAlign: 'center',
  },
  notesButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    fontWeight: theme.typography.fontWeight.bold,
  },
  notesInput: {
    borderWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      ios: {
        borderWidth: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderColor: 'transparent',
      },
      android: {
        borderWidth: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderColor: 'transparent',
        underlineColorAndroid: 'transparent',
      },
      web: {
        borderWidth: 0,
        borderColor: 'transparent',
        // RN Web doesn't accept shorthand `outline`
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
      },
      default: {
        borderWidth: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderColor: 'transparent',
      },
    }),
  },
});
