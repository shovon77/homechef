import React, { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { View, Text, Image, TouchableOpacity, Pressable, ActivityIndicator, ScrollView, Alert, TextInput, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { theme, elev } from "../../lib/theme";
import { getDishRatings, getDishWithChef, getDishReviews } from "../../lib/db";
import { submitDishRating } from "../../lib/reviews";
import type { Dish, DishWithChef, DishRating } from "../../lib/types";
import { useCart } from "../../context/CartContext";
import { useRole } from "../../hooks/useRole";
import Screen from "../../components/Screen";
import OptimizedImage from "../../components/OptimizedImage";
import { formatCad } from "../../lib/money";
import { optimizeDishDetailHeroUrl } from "../../lib/dishImageUrl";
import { Ionicons } from "@expo/vector-icons";

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F2F0EF';
const BRAND_BLACK = '#33393A';
const TEXT_DARK = BRAND_BLACK;
// Keep the hierarchy via opacity in styles (but same base brand black)
const TEXT_MUTED = BRAND_BLACK;
const TEXT_GRAY = BRAND_BLACK;
// Use white for all separator lines on this page
const BORDER_LIGHT = '#FFFFFF';

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);
const REVIEWS_SECTION_ID = 'dish-tabs-section';
const REVIEWS_PAGE_SIZE = 20;

// TS helper: Screen/View styles in this file are a mix of RNW + native.
// We keep the runtime behavior and relax typings locally to avoid red lints.
const ScreenCmp: any = Screen;
const ViewCmp: any = View;
const ImageCmp: any = Image;

/**
 * Prefer `portion` from DB; if empty, treat a short trailing description line
 * (e.g. "1lb 12 dollar") as portion so legacy menu text still shows as "Portion size:".
 */
function splitDescriptionAndPortion(
  description: string | null | undefined,
  portionFromDb: string | null | undefined
): { descriptionToShow: string; portionToShow: string | null } {
  const fromDb = portionFromDb?.trim();
  if (fromDb) {
    return { descriptionToShow: (description ?? '').trim(), portionToShow: fromDb };
  }
  const raw = (description ?? '').trim();
  if (!raw) return { descriptionToShow: '', portionToShow: null };
  const lines = raw.split(/\r?\n/);
  let end = lines.length;
  while (end > 0 && !(lines[end - 1] ?? '').trim()) end--;
  if (end === 0) return { descriptionToShow: raw, portionToShow: null };
  const lastLine = (lines[end - 1] ?? '').trim();
  const hasMeasureWord =
    /\b(lb|lbs|oz|g|kg|ml|L|piece|pice|pc|pieces|servings?|serving)\b/i.test(lastLine) ||
    /\d+(?:\.\d+)?(lb|lbs|oz|g|kg|ml)\b/i.test(lastLine);
  const looksLikePortionTail =
    lastLine.length > 0 &&
    lastLine.length <= 160 &&
    /\d/.test(lastLine) &&
    (hasMeasureWord || (/\bdollars?\b/i.test(lastLine) && lastLine.length <= 96));
  if (!looksLikePortionTail) return { descriptionToShow: raw, portionToShow: null };
  const body = lines.slice(0, end - 1).join('\n').trim();
  return { descriptionToShow: body, portionToShow: lastLine };
}

export default function DishDetail() {
  const router = useRouter();
  const { id, quantity: quantityParam } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  // On web, `window.innerWidth` can change when the vertical scrollbar appears/disappears.
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

  // Parse quantity from URL params
  const initialQuantity = useMemo(() => {
    if (quantityParam) {
      const qty = Number(Array.isArray(quantityParam) ? quantityParam[0] : quantityParam);
      return isNaN(qty) || qty < 1 ? 1 : qty;
    }
    return 1;
  }, [quantityParam]);

  const [dish, setDish] = useState<DishWithChef | null>(null);
  const [chef, setChef] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [reviews, setReviews] = useState<DishRating[]>([]);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDishOwner, setIsDishOwner] = useState(false);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'reviews'>('ingredients');
  const [chefNotes, setChefNotes] = useState("");
  const { items: cartItems, addToCart, setQuantity: setCartQuantity, setNotes: setCartNotes, getQty } = useCart();
  const { isAdmin, user } = useRole();

  // 1. Fetch public data (dish, chef, ratings, first page of reviews) — batch before first paint
  //    to avoid CLS from stars/review count/chef/reviews populating after the hero (Speed Insights).
  useEffect(() => {
    if (!Number.isFinite(dishId)) {
      setLoading(false);
      setDish(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setChef(null);
    setRatingCount(0);
    setAvgRating(0);
    setReviews([]);
    setReviewsHasMore(false);
    setDish((prev) =>
      prev != null && Number(prev.id) === dishId ? prev : null
    );

    (async () => {
      try {
        const [dishData, reviewsData, ratingStats] = await Promise.all([
          getDishWithChef(dishId),
          getDishReviews(dishId, REVIEWS_PAGE_SIZE, 0),
          getDishRatings(dishId),
        ]);

        if (!mounted) return;

        if (!dishData) {
          console.log("Dish not found");
          setDish(null);
          setLoading(false);
          return;
        }

        let chefData: any = dishData.chefs ?? null;
        if (!chefData && dishData.chef_id) {
          const { data: fallbackChef } = await supabase
            .from('chefs')
            .select('id, name, slug, photo, email, user_id')
            .eq('id', Number(dishData.chef_id))
            .maybeSingle();
          chefData = fallbackChef;
        }

        if (!mounted) return;

        setDish(dishData);
        if (chefData) setChef(chefData);

        // Aggregate for everyone (anon included): RPC is SECURITY DEFINER + granted to anon.
        // Fallback to denormalized dish columns if RPC/client path returns zeros (e.g. migration lag).
        let avg = ratingStats.average;
        let count = ratingStats.count;
        const inlineRating = Number((dishData as any).rating);
        const inlineCount = Number((dishData as any).rating_count);
        if ((avg <= 0 || count <= 0) && Number.isFinite(inlineRating) && inlineRating > 0) {
          avg = inlineRating;
        }
        if (count <= 0 && Number.isFinite(inlineCount) && inlineCount > 0) {
          count = Math.trunc(inlineCount);
        }
        setAvgRating(avg);
        setRatingCount(count);

        setReviews(reviewsData);
        setReviewsHasMore(reviewsData.length >= REVIEWS_PAGE_SIZE);
        setLoading(false);
      } catch (e) {
        console.error("Error loading dish details:", e);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
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

    // Stars + comment always start blank (do not prefill from dish_ratings).
    setUserRating(0);
    setComment("");
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

  // Sync quantity with URL param when it changes
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  const handleAddToCart = () => {
    if (!dish) return;
    const result = addToCart({ 
      id: dish.id, 
      name: dish.name || '', 
      price: Number(dish.price || 0), 
      quantity: quantity, 
      image: dish.image || undefined,
      chef_id: dish.chef_id || null,
      notes: chefNotes.trim() || undefined,
    });
    if (result.success) {
      setChefNotes(""); // Clear notes after adding
      Alert.alert("Success", "Added to cart!");
    }
  };

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
        userId: user.id,
      });

      setRatingCount(summary.count);
      setAvgRating(summary.avg);
      
      const updatedReviews = await getDishReviews(dishId, REVIEWS_PAGE_SIZE, 0);
      setReviews(updatedReviews);
      setReviewsHasMore(updatedReviews.length >= REVIEWS_PAGE_SIZE);

      // Reset form so it stays blank (same as initial load — no echo of submitted review in inputs).
      setUserRating(0);
      setComment("");

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
            <ImageCmp
              key={`s${i}`}
              source={require('../../assets/star.png')}
              style={[styles.starIconImage as any, { opacity }]}
              tintColor={PRIMARY_COLOR}
              resizeMode="contain"
            />
          );
        })}
      </View>
    );
  };

  // Keep the input prefilled from cart notes when available (without overwriting user edits).
  // This MUST be above any early returns to keep hook order stable.
  const cartDishId = dish?.id ?? (Number.isFinite(dishId) ? dishId : null);
  const cartQty = cartDishId != null ? getQty(cartDishId) : 0;
  const existingNotes =
    cartDishId != null ? (cartItems.find((i) => String(i.id) === String(cartDishId))?.notes ?? "") : "";

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
          const refEl: any = tabsSectionRef.current as any;
          if (refEl?.scrollIntoView) {
            refEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          const el =
            (document.getElementById(REVIEWS_SECTION_ID) as HTMLElement | null) ??
            (document.querySelector(`[data-testid="${REVIEWS_SECTION_ID}"]`) as HTMLElement | null);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        } catch {}
      }

      pageScrollRef.current?.scrollTo?.({ y: baseY > 0 ? Math.max(0, baseY) : 9999, animated: true });
    };

    requestAnimationFrame(tryScroll);
    setTimeout(tryScroll, 100);
    setTimeout(tryScroll, 300);
    setTimeout(tryScroll, 800);
  };

  const imageMaxW = isMobile ? Math.min(viewportWidth * 2, 960) : 1400;

  const loadMoreReviews = async () => {
    if (!Number.isFinite(dishId) || reviewsLoadingMore || !reviewsHasMore) return;
    setReviewsLoadingMore(true);
    try {
      const next = await getDishReviews(dishId, REVIEWS_PAGE_SIZE, reviews.length);
      setReviews((prev) => [...prev, ...next]);
      setReviewsHasMore(next.length >= REVIEWS_PAGE_SIZE);
    } catch (e) {
      console.error("loadMoreReviews", e);
    } finally {
      setReviewsLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <ScreenCmp style={{ backgroundColor: BACKGROUND_LIGHT }}>
        <View style={styles.container}>
          {isMobile ? (
            <View style={styles.mobileStack}>
              <View style={[styles.skeletonBlock, styles.skeletonHeroMobile]} />
              <View style={styles.skeletonLineLg} />
              <View style={styles.skeletonLineMd} />
              <View style={styles.skeletonLineSm} />
              <ActivityIndicator size="small" color={PRIMARY_COLOR} style={{ marginTop: 24 }} />
            </View>
          ) : (
            <View style={styles.grid}>
              <View style={styles.imageColumn}>
                <View style={[styles.skeletonBlock, styles.skeletonHeroDesktop]} />
              </View>
              <View style={[styles.infoColumn, { gap: 12 }]}>
                <View style={styles.skeletonLineLg} />
                <View style={styles.skeletonLineMd} />
                <View style={styles.skeletonLineSm} />
                <View style={styles.skeletonLineSm} />
                <ActivityIndicator size="small" color={PRIMARY_COLOR} style={{ marginTop: 16 }} />
              </View>
            </View>
          )}
        </View>
      </ScreenCmp>
    );
  }
  if (!dish) {
    return (
      <ScreenCmp>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: TEXT_MUTED }}>Dish not found.</Text>
        </View>
      </ScreenCmp>
    );
  }

  const chefId = dish.chef_id != null ? Number(dish.chef_id) : null;
  const chefName = chef?.name || dish.chef || 'Chef';
  const mainImage = optimizeDishDetailHeroUrl(dish.image ?? null, imageMaxW);
  const chefAvatarUri = chef?.photo || chef?.avatar || null;
  const { descriptionToShow, portionToShow } = splitDescriptionAndPortion(dish.description, dish.portion);

  return (
    <ScreenCmp style={{ backgroundColor: BACKGROUND_LIGHT }} scrollRef={pageScrollRef}>
      <View style={{ paddingBottom: 120 }}>
        <View style={styles.container}>
        {/* Breadcrumbs - REMOVED */}
        {/* Main Content: separate mobile stack so image is always above text with no overlap */}
        {isMobile ? (
          <View style={styles.mobileStack}>
            <View style={styles.mobileImageWrap}>
              <View style={[styles.mainImageContainer, styles.mainImageContainerMobile]}>
                <OptimizedImage
                  uri={mainImage}
                  style={styles.mainImage as any}
                  resizeMode="cover"
                  lazy={false}
                  fetchPriority="high"
                />
              </View>
            </View>
            <View style={styles.mobileInfoWrap}>
            <Text
              style={[styles.dishTitle, styles.dishTitleMobile]}
            >
              {dish.name}
            </Text>
            
            {chefId ? (
              <Link href={`/chef/${chef?.slug ?? chefId}`} asChild>
                <TouchableOpacity style={styles.chefLink}>
                  {chefAvatarUri ? (
                    <Image 
                      source={{ uri: chefAvatarUri }} 
                      style={styles.chefAvatar as any} 
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

            <TouchableOpacity style={styles.ratingContainer} activeOpacity={0.7} onPress={scrollToReviews}>
              {renderStars(avgRating)}
              <Text style={styles.reviewCount} onPress={scrollToReviews}>
                ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
              </Text>
            </TouchableOpacity>

            {descriptionToShow ? (
              <Text style={styles.description}>{descriptionToShow}</Text>
            ) : null}
            {portionToShow ? (
              <View style={[styles.portionRow, descriptionToShow ? styles.portionAfterDescription : styles.portionStandalone]}>
                <Text style={styles.portionLabel}>Portion size:</Text>
                <Text style={styles.portionValue}>{` ${portionToShow}`}</Text>
              </View>
            ) : null}

            <View style={styles.priceAndCartRow}>
              <Text style={[styles.price, styles.priceRight, styles.priceMobile]}>{formatCad(dish.price)}</Text>
              <View style={styles.actionRow}>
                <View style={styles.cartQtyRow}>
                {cartQty > 0 ? (
                  <TouchableOpacity
                    style={styles.cartQtyBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (dish && cartQty > 0) {
                        setCartQuantity(dish.id, cartQty - 1);
                      }
                    }}
                  >
                    <Image
                      source={require('../../assets/minus.png')}
                      style={styles.cartQtyIconImage as any}
                      tintColor={PRIMARY_COLOR}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.cartQtyBtn} pointerEvents="none" />
                )}

                <Text
                  style={[styles.cartQtyValue, cartQty <= 0 && styles.cartQtyValueHidden]}
                >
                  {cartQty}
                </Text>

                <TouchableOpacity
                  style={styles.cartQtyBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!dish) return;
                    if (cartQty <= 0) {
                      addToCart({
                        id: dish.id,
                        name: dish.name || '',
                        price: Number(dish.price || 0),
                        quantity: 1,
                        image: dish.image || undefined,
                        chef_id: dish.chef_id || null,
                        notes: chefNotes.trim() || undefined,
                      });
                      return;
                    }
                    setCartQuantity(dish.id, cartQty + 1);
                  }}
                >
                  <Image
                    source={require('../../assets/add (1).png')}
                    style={styles.cartQtyIconImage as any}
                    tintColor={PRIMARY_COLOR}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
            </View>

            <View style={[styles.notesContainer, isMobile && styles.notesContainerMobile]}>
              <Text style={styles.notesButtonText}>Chef notes</Text>
              <TextInput
                style={styles.notesInput}
                value={chefNotes}
                onChangeText={(t) => {
                  setChefNotes(t);
                  if (dish && cartQty > 0) {
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
        ) : (
        <View style={styles.grid}>
          <View style={styles.imageColumn}>
            <View style={styles.mainImageContainer}>
              <OptimizedImage
                uri={mainImage}
                style={styles.mainImage as any}
                resizeMode="cover"
                lazy={false}
                fetchPriority="high"
              />
            </View>
          </View>

          <View style={styles.infoColumn}>
            <Text
              style={[styles.dishTitle, isMobile && styles.dishTitleMobile]}
            >
              {dish.name}
            </Text>
            
            {chefId ? (
              <Link href={`/chef/${chef?.slug ?? chefId}`} asChild>
                <TouchableOpacity style={styles.chefLink}>
                  {chefAvatarUri ? (
                    <Image 
                      source={{ uri: chefAvatarUri }} 
                      style={styles.chefAvatar as any} 
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
            {descriptionToShow ? (
              <Text style={styles.description}>{descriptionToShow}</Text>
            ) : null}
            {portionToShow ? (
              <View style={[styles.portionRow, descriptionToShow ? styles.portionAfterDescription : styles.portionStandalone]}>
                <Text style={styles.portionLabel}>Portion size:</Text>
                <Text style={styles.portionValue}>{` ${portionToShow}`}</Text>
              </View>
            ) : null}

            {/* Price (right-aligned above plus) and Cart quantity (minus / qty / plus) */}
            <View style={styles.priceAndCartRow}>
              <Text style={[styles.price, styles.priceRight, isMobile && styles.priceMobile]}>{formatCad(dish.price)}</Text>
              <View style={styles.actionRow}>
                <View style={styles.cartQtyRow}>
                {cartQty > 0 ? (
                  <TouchableOpacity
                    style={styles.cartQtyBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (dish && cartQty > 0) {
                        setCartQuantity(dish.id, cartQty - 1);
                      }
                    }}
                  >
                    <Image
                      source={require('../../assets/minus.png')}
                      style={styles.cartQtyIconImage as any}
                      tintColor={PRIMARY_COLOR}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ) : (
                  // Keep spacing consistent, but hide minus icon when qty is 0
                  <View style={styles.cartQtyBtn} pointerEvents="none" />
                )}

                <Text
                  style={[styles.cartQtyValue, cartQty <= 0 && styles.cartQtyValueHidden]}
                >
                  {cartQty}
                </Text>

                <TouchableOpacity
                  style={styles.cartQtyBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!dish) return;
                    if (cartQty <= 0) {
                      addToCart({
                        id: dish.id,
                        name: dish.name || '',
                        price: Number(dish.price || 0),
                        quantity: 1,
                        image: dish.image || undefined,
                        chef_id: dish.chef_id || null,
                        notes: chefNotes.trim() || undefined,
                      });
                      return;
                    }
                    setCartQuantity(dish.id, cartQty + 1);
                  }}
                >
                  <Image
                    source={require('../../assets/add (1).png')}
                    style={styles.cartQtyIconImage as any}
                    tintColor={PRIMARY_COLOR}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
            </View>

            {/* Chef Notes Input (always visible) */}
            <View style={styles.notesContainer}>
              <Text style={styles.notesButtonText}>Chef notes</Text>
              <TextInput
                style={styles.notesInput}
                value={chefNotes}
                onChangeText={(t) => {
                  setChefNotes(t);
                  if (dish && cartQty > 0) {
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
        )}

        {/* Tabs Section */}
        <View
          style={[styles.tabsSection, isMobile && styles.tabsSectionMobile]}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={{
              flexGrow: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
              onPress={() => startTransition(() => setActiveTab('ingredients'))}
            >
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                Allergens & Ingredients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
              onPress={() => startTransition(() => setActiveTab('reviews'))}
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
                    <Text style={styles.reviewFormTitle}>Share a review</Text>
                    
                    <View style={styles.ratingInputContainer}>
                      <View style={styles.ratingLabelRow}>
                        <Text style={styles.ratingLabel}>Rating</Text>
                        <Text style={styles.ratingRequiredMark} accessibilityLabel="required">
                          *
                        </Text>
                      </View>
                      <View style={styles.starsInputRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Pressable
                            key={star}
                            accessibilityRole="button"
                            accessibilityLabel={`Rate ${star} out of 5`}
                            onPress={() => setUserRating(star)}
                            style={({ pressed }) => [
                              styles.starInputHitTarget,
                              pressed && styles.starInputHitTargetPressed,
                            ]}
                          >
                            <Ionicons
                              pointerEvents="none"
                              name={star <= userRating ? "star" : "star-outline"}
                              size={28}
                              color={star <= userRating ? PRIMARY_COLOR : "#D4D4D8"}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.commentInputContainer}>
                      <Text style={styles.commentLabel}>Comment</Text>
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
                        {submitting ? "Submitting..." : "Submit"}
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
                    <ViewCmp key={review.id} style={styles.reviewItem}>
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
                    </ViewCmp>
                  ))}
                </View>

                {reviewsHasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreReviewsBtn}
                    onPress={loadMoreReviews}
                    disabled={reviewsLoadingMore}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.loadMoreReviewsText}>
                      {reviewsLoadingMore ? 'Loading…' : 'Load more reviews'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

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
    </ScreenCmp>
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
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  breadcrumbSeparator: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  breadcrumbCurrent: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  grid: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    gap: Platform.select({
      web: theme.spacing['2xl'],
      default: 0,
    }),
    marginBottom: theme.spacing['4xl'],
  },
  imageColumn: {
    flex: 1,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'stretch',
      },
      default: {
        flex: 0,
        alignSelf: 'stretch',
      },
    }),
  },
  mainImageContainer: {
    width: '100%',
    maxWidth: 480,
    aspectRatio: 1,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: 'none' as any,
        alignSelf: 'flex-start',
        marginBottom: 0,
      },
      default: {
        elevation: 0,
        shadowOpacity: 0,
        alignSelf: 'flex-start',
        marginBottom: theme.spacing.sm,
      } as any,
    }),
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  infoColumn: {
    flex: 1,
    paddingTop: 0,
    ...Platform.select({
      web: {},
      default: {
        flex: 0,
      },
    }),
  },
  dishTitle: {
    color: TEXT_DARK,
    fontSize: Platform.select({
      web: 48,
      default: 30,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black as any,
    lineHeight: Platform.select({
      web: 48 * 1.2,
      default: 30 * 1.2,
    }),
    letterSpacing: -0.033,
    // Spacing is controlled by the next rows' top margins for consistency.
    marginBottom: 0,
    marginTop: theme.spacing.xs,
  },
  dishTitleMobile: {
    fontSize: 22,
    lineHeight: 22 * 1.2,
    marginTop: 0,
  },
  chefLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium as any,
    textDecorationLine: 'none',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    // Reserve one line so late font/layout tweaks don’t shift rows (web CLS)
    minHeight: 22,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIconImage: {
    width: 18,
    height: 18,
  },
  star: {
    fontSize: 20,
    color: PRIMARY_COLOR,
  },
  starEmpty: {
    opacity: 0.3,
  },
  reviewCount: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  description: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.5,
    marginTop: theme.spacing.md,
  },
  portionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  portionLabel: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.5,
    fontWeight: '400',
    flexShrink: 0,
  },
  portionValue: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.5,
    flex: 1,
    minWidth: 0,
  },
  portionAfterDescription: {
    marginTop: theme.spacing.sm,
  },
  portionStandalone: {
    marginTop: theme.spacing.md,
  },
  price: {
    color: TEXT_DARK,
    fontSize: Platform.select({
      web: 36,
      default: 24,
    }),
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '300',
    // Match header section spacing (title/chef/rating)
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing['2xl'],
  },
  priceMobile: {
    // Much smaller on mobile
    fontSize: 18,
    lineHeight: 18 * 1.2,
  },
  priceRight: {
    alignSelf: 'flex-end',
    marginTop: 0,
    marginBottom: theme.spacing.sm,
  },
  priceAndCartRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cartQtyBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartQtyBtnDisabled: {
    opacity: 0.3,
  },
  cartQtyIconImage: {
    width: 20,
    height: 20,
  },
  cartQtyValue: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '300',
  },
  cartQtyValueHidden: {
    opacity: 0,
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
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  quantityValue: {
    width: 48,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
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
    fontWeight: theme.typography.fontWeight.bold as any,
    letterSpacing: 0.015,
  },
  tabsSection: {
    marginTop: theme.spacing['4xl'],
    // Top divider is handled by tabsContainer so tabs can be vertically centered
    paddingTop: 0,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  /** Tighter gap below Chef notes on narrow viewports */
  tabsSectionMobile: {
    marginTop: theme.spacing.sm,
  },
  tabsContainer: {
    // Two white separator lines with centered tabs
    height: 56,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  tab: {
    paddingHorizontal: theme.spacing.md,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // No underline on tabs; keep layout stable
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: 'transparent',
  },
  tabText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
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
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  ratingInputContainer: {
    gap: theme.spacing.sm,
  },
  ratingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  ratingRequiredMark: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold as any,
    lineHeight: theme.typography.fontSize.sm * 1.2,
  },
  starsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...Platform.select({
      web: {
        touchAction: 'manipulation' as any,
        userSelect: 'none' as any,
      },
    }),
  },
  starInputHitTarget: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        touchAction: 'manipulation' as any,
      },
    }),
  },
  starInputHitTargetPressed: {
    opacity: 0.85,
  },
  starInputImage: {
    width: 28,
    height: 28,
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
    backgroundColor: BACKGROUND_LIGHT,
    // Keep focus border pure white on web (remove default outline ring)
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none' as any,
      },
    }),
  },
  submitButton: {
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: '55%',
    maxWidth: 220,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    letterSpacing: theme.typography.letterSpacing.wide,
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
    fontWeight: theme.typography.fontWeight.medium as any,
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
  // Mobile-only layout: single column, image then info, no Platform dependency
  mobileStack: {
    width: '100%',
    flexDirection: 'column',
    marginBottom: theme.spacing['4xl'],
  },
  mobileImageWrap: {
    width: '100%',
    marginBottom: theme.spacing.sm,
  },
  mainImageContainerMobile: {
    width: '100%',
    maxWidth: 480,
    aspectRatio: 1,
    minHeight: 200,
    marginBottom: 0,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
  },
  mobileInfoWrap: {
    width: '100%',
    paddingTop: 0,
  },
  skeletonBlock: {
    width: '100%',
    borderRadius: theme.radius.xl,
    backgroundColor: '#E6E4E1',
  },
  skeletonHeroMobile: {
    aspectRatio: 1,
    maxWidth: 480,
    alignSelf: 'center',
  },
  skeletonHeroDesktop: {
    aspectRatio: 4 / 3,
    maxWidth: 480,
  },
  skeletonLineLg: {
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E6E4E1',
    width: '88%',
    marginTop: theme.spacing.md,
  },
  skeletonLineMd: {
    height: 20,
    borderRadius: 8,
    backgroundColor: '#E6E4E1',
    width: '55%',
    marginTop: 12,
  },
  skeletonLineSm: {
    height: 16,
    borderRadius: 6,
    backgroundColor: '#EDECEA',
    width: '72%',
    marginTop: 10,
  },
  loadMoreReviewsBtn: {
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
  },
  loadMoreReviewsText: {
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '600' as any,
    fontSize: theme.typography.fontSize.sm,
  },
  // Legacy mobile overrides (used only in desktop branch when isMobile was true)
  gridMobile: {
    flexDirection: 'column',
    gap: 0,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  imageColumnMobile: {
    flex: 0,
    flexShrink: 0,
    width: '100%',
  },
  infoColumnMobile: {
    flex: 0,
    flexShrink: 0,
    width: '100%',
    paddingTop: theme.spacing.sm,
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
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold as any,
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
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'left', // Changed from center to left
    maxWidth: 600,
    lineHeight: 24,
  },
  notesContainer: {
    marginTop: theme.spacing.sm,
    marginBottom: Platform.select({
      web: theme.spacing.lg,
      default: theme.spacing['2xl'], // Increased spacing on mobile to prevent overflow
    }),
    gap: theme.spacing.xs,
    width: '100%',
    paddingHorizontal: theme.spacing.md,
  },
  notesContainerMobile: {
    marginBottom: theme.spacing.sm,
  },
  notesButton: {
    alignSelf: 'flex-start',
    paddingTop: theme.spacing.sm,
    paddingBottom: 0,
    paddingHorizontal: 0,
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
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold as any,
    width: 20,
    textAlign: 'center',
  },
  notesButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold as any,
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
        outlineStyle: 'none' as any,
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