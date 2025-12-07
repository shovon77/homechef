import React, { useEffect, useState, useMemo } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { theme, elev } from "../../lib/theme";
import { getDishById, getDishRatings, getChefById, getDishWithChef } from "../../lib/db";
import { submitDishRating, getDishRatingSummary } from "../../lib/reviews";
import type { Dish, DishWithChef } from "../../lib/types";
import { useCart } from "../../context/CartContext";
import { useRole } from "../../hooks/useRole";
import { Screen } from "../../components/Screen";
import { formatCad } from "../../lib/money";

// Colors from HTML design
const PRIMARY_COLOR = '#88B361';
const BACKGROUND_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b14';
const TEXT_MUTED = '#71717a';
const TEXT_GRAY = '#6b7280';
const BORDER_LIGHT = '#e5e7eb';

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);

export default function DishDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
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
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDishOwner, setIsDishOwner] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'reviews'>('description');
  const { addToCart } = useCart();
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

  const handleAddToCart = () => {
    if (!dish) return;
    const result = addToCart({ 
      id: dish.id, 
      name: dish.name || '', 
      price: Number(dish.price || 0), 
      quantity: quantity, 
      image: dish.image || undefined,
      chef_id: dish.chef_id || null,
    });
    if (result.success) {
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
      });

      setRatingCount(summary.count);
      setAvgRating(summary.avg);
      
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
    const full = Math.floor(value);
    const hasHalf = value - full >= 0.5;
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: full }).map((_, i) => (
          <Text key={`f${i}`} style={styles.star}>★</Text>
        ))}
        {hasHalf && <Text style={styles.star}>☆</Text>}
        {Array.from({ length: 5 - full - (hasHalf ? 1 : 0) }).map((_, i) => (
          <Text key={`e${i}`} style={[styles.star, styles.starEmpty]}>★</Text>
        ))}
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

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={{ paddingBottom: 32 }}>
        <View style={styles.container}>
        {/* Breadcrumbs */}
        <View style={styles.breadcrumbs}>
          <Link href="/" asChild>
            <TouchableOpacity>
              <Text style={styles.breadcrumbLink}>Home</Text>
            </TouchableOpacity>
          </Link>
          <Text style={styles.breadcrumbSeparator}>/</Text>
          <Text style={styles.breadcrumbLink}>{dish.category || 'Dishes'}</Text>
          <Text style={styles.breadcrumbSeparator}>/</Text>
          <Text style={styles.breadcrumbCurrent}>{dish.name}</Text>
        </View>

        {/* Main Content Grid */}
        <View style={[styles.grid, isMobile && styles.gridMobile]}>
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
          <View style={styles.infoColumn}>
            <Text style={styles.dishTitle}>{dish.name}</Text>
            
            {chefId ? (
              <Link href={{ pathname: "/chef/[id]", params: { id: String(chefId) } }} asChild>
                <TouchableOpacity style={styles.chefLink}>
                  <Text style={styles.chefIcon}>🏪</Text>
                  <Text style={styles.chefLinkText}>By {chefName}</Text>
                </TouchableOpacity>
              </Link>
            ) : (
              <View style={styles.chefLink}>
                <Text style={styles.chefIcon}>🏪</Text>
                <Text style={styles.chefLinkText}>By {chefName}</Text>
              </View>
            )}

            {/* Rating */}
            <View style={styles.ratingContainer}>
              {renderStars(avgRating)}
              <Text style={styles.reviewCount}>
                ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
              </Text>
            </View>

            {/* Description */}
            {dish.description ? (
              <Text style={styles.description}>{dish.description}</Text>
            ) : null}

            {/* Price */}
            <Text style={styles.price}>{formatCad(dish.price)}</Text>

            {/* Quantity & Add to Cart */}
            <View style={styles.actionRow}>
              <View style={styles.quantitySelector}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.addToCartButton}
                onPress={handleAddToCart}
              >
                <Text style={styles.addToCartButtonText}>Add to cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tabs Section */}
        <View style={styles.tabsSection}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'description' && styles.tabActive]}
              onPress={() => setActiveTab('description')}
            >
              <Text style={[styles.tabText, activeTab === 'description' && styles.tabTextActive]}>
                Description
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
              onPress={() => setActiveTab('ingredients')}
            >
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                Ingredients & Allergens
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
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'description' && (
              <View style={styles.descriptionContent}>
                {dish.description ? (
                  <Text style={styles.descriptionText}>{dish.description}</Text>
                ) : (
                  <Text style={styles.emptyText}>No description available.</Text>
                )}
              </View>
            )}

            {activeTab === 'ingredients' && (
              <View style={styles.ingredientsContent}>
                {dish.ingredients ? (
                  <Text style={styles.descriptionText}>{dish.ingredients}</Text>
                ) : (
                  <Text style={styles.emptyText}>Ingredients and allergen information coming soon.</Text>
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
                            <Text style={[
                              styles.starInput,
                              { color: star <= userRating ? PRIMARY_COLOR : TEXT_MUTED }
                            ]}>
                              ★
                            </Text>
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

                {!user && (
                  <Text style={styles.signInPrompt}>
                    Please sign in to leave a review.
                  </Text>
                )}
              </View>
            )}
          </View>
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
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    gap: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing['2xl'],
    }),
    marginBottom: theme.spacing['4xl'],
  },
  imageColumn: {
    flex: 1,
    gap: theme.spacing.md,
  },
  mainImageContainer: {
    width: '100%',
    maxWidth: 480, // Limit width to be smaller
    aspectRatio: 1,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start', // Or center
    ...elev('lg'),
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  infoColumn: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  dishTitle: {
    color: TEXT_DARK,
    fontSize: Platform.select({
      web: 48,
      default: 36,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: Platform.select({
      web: 48 * 1.2,
      default: 36 * 1.2,
    }),
    letterSpacing: -0.033,
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
  chefLinkText: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.medium,
    textDecorationLine: 'underline',
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
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing['2xl'],
  },
  actionRow: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
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
    marginTop: theme.spacing['4xl'],
    paddingTop: theme.spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  tabsContainer: {
    flexDirection: 'row',
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
    borderBottomColor: PRIMARY_COLOR,
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
  descriptionContent: {
    gap: theme.spacing.md,
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
    color: TEXT_DARK,
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
    gap: theme.spacing.lg,
  },
});
