'use client';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Platform, TextInput, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { getChefById, getDishesByChefId } from '../../lib/db';
import { submitChefReview, getChefReviews as getChefReviewsHelper } from '../../lib/reviews';
import { useRole } from '../../hooks/useRole';
import type { Chef, Dish, ChefReview } from '../../lib/types';
import Screen from '../../components/Screen';
import { theme, elev } from '../../lib/theme';

// Colors from HTML design
const PRIMARY_COLOR = '#19e680';
const BACKGROUND_LIGHT = '#f6f8f7';
const TEXT_DARK = '#18181b'; // zinc-900
const TEXT_MUTED = '#71717a'; // zinc-500
const TEXT_MUTED_DARK = '#52525b'; // zinc-600
const BORDER_LIGHT = '#e4e4e7'; // zinc-200
const BORDER_DARK = '#3f3f46'; // zinc-700
const STAR_COLOR = '#ffb700'; // yellow-500

export default function ChefDetailView() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  const numericFromAny = (() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g, '');
    return tail ? Number(tail) : NaN;
  })();

  const [chefId, setChefId] = useState<number | null>(null);
  const [chef, setChef] = useState<Chef | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<ChefReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dishes' | 'reviews'>('dishes');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const { addToCart } = useCart();
  const { user } = useRole();

  useEffect(() => {
    setError(null);
    if (Number.isFinite(numericFromAny) && numericFromAny > 0) {
      setChefId(numericFromAny);
    } else {
      setChefId(1);
    }
  }, [raw]);

  useEffect(() => {
    if (!chefId) return;
    (async () => {
      try {
        const chefData = await getChefById(chefId);
        if (!chefData) {
          setError('Chef not found');
          return;
        }
        setChef(chefData);

        const dishesData = await getDishesByChefId(chefId);
        setDishes(dishesData);

        const reviewsData = await getChefReviewsHelper(chefId);
        setReviews(reviewsData);
      } catch (e:any) {
        setError(e.message || String(e));
      }
    })();
  }, [chefId]);

  const avatar = chef?.photo || chef?.avatar || '';
  const title = chef?.name || (chefId ? `Chef #${chefId}` : 'Chef');
  const location = chef?.location || '';
  const bio = chef?.bio ?? chef?.description ?? '';
  const avgRating = Number(chef?.avg_rating ?? 0);
  const reviewCount = reviews.length;
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

      const updatedReviews = await getChefReviewsHelper(chefId);
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
          <Text style={{ color:'tomato' }}>Error: {error}</Text>
        </View>
      </Screen>
    );
  }
  if (!chefId || !chef) {
    return (
      <Screen>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text style={{ color:TEXT_MUTED }}>Loading chef…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentPadding={0} style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={styles.container}>
          <View style={styles.layout}>
            {/* Left Sidebar - Sticky */}
            <View style={styles.sidebar}>
            <View style={styles.sidebarCard}>
              {/* Profile Card */}
              <View style={styles.profileSection}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarContainer}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitials}>
                          {title.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{title}</Text>
                    {location ? <Text style={styles.profileLocation}>{location}</Text> : null}
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statValue}>{avgRating.toFixed(1)}</Text>
                    <Text style={styles.starIcon}>★</Text>
                  </View>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reviewCount}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
          </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{dishCount}</Text>
                  <Text style={styles.statLabel}>Dishes</Text>
        </View>
      </View>

              {/* Bio Section */}
              {bio ? (
                <View style={styles.bioSection}>
                  <Text style={styles.bioTitle}>About Me</Text>
                  <Text style={styles.bioText}>{bio}</Text>
                </View>
              ) : null}

              {/* CTA Buttons */}
              <View style={styles.ctaContainer}>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Follow Chef</Text>
        </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Message Chef</Text>
        </TouchableOpacity>
      </View>
    </View>
          </View>

          {/* Main Content Area */}
          <View style={styles.mainContent}>
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

            {/* Filter/Sort Controls - only show for dishes tab */}
            {activeTab === 'dishes' && (
              <View style={styles.filterContainer}>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Sort by:</Text>
                  <View style={styles.selectPlaceholder}>
                    <Text style={styles.selectText}>Popularity</Text>
                  </View>
                  <Text style={styles.filterLabel}>Category:</Text>
                  <View style={styles.selectPlaceholder}>
                    <Text style={styles.selectText}>All Categories</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Content based on active tab */}
            <View style={styles.contentScroll}>
              {activeTab === 'dishes' ? (
                <View style={styles.dishesGrid}>
                  {dishes.length === 0 ? (
                    <Text style={styles.emptyText}>No dishes yet.</Text>
                  ) : (
                    dishes.map(d => {
                      const img = d.image || d.thumbnail || '';
                      return (
                        <View key={d.id} style={styles.dishCard}>
                          <Link href={`/dish/${d.id}`} asChild>
                            <TouchableOpacity style={styles.dishImageContainer}>
                              {img ? (
                                <Image source={{ uri: img }} style={styles.dishImage} resizeMode="cover" />
                              ) : (
                                <View style={styles.dishImagePlaceholder}>
                                  <Text style={styles.dishImagePlaceholderText}>No image</Text>
        </View>
      )}
                            </TouchableOpacity>
                          </Link>
                          <View style={styles.dishInfo}>
                            <View style={styles.dishHeader}>
                              <Text style={styles.dishName} numberOfLines={1}>
                                {d.name || `Dish #${d.id}`}
                              </Text>
                              <Text style={styles.dishPrice}>
                                ${d.price != null ? Number(d.price).toFixed(2) : '0.00'}
                              </Text>
                            </View>
                            {d.description ? (
                              <Text style={styles.dishDescription} numberOfLines={2}>
                                {d.description}
                              </Text>
                            ) : null}
                            <TouchableOpacity
                              style={styles.addToCartButton}
                              onPress={() => handleAddToCart(d)}
                            >
                              <Text style={styles.addToCartButtonText}>Add to Cart</Text>
                            </TouchableOpacity>
                          </View>
    </View>
  );
                    })
                  )}
                </View>
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
                              <Text style={[
                                styles.starButton,
                                { color: star <= reviewRating ? STAR_COLOR : TEXT_MUTED }
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
                  {reviews.length === 0 ? (
                    <Text style={styles.emptyText}>No reviews yet.</Text>
                  ) : (
                    <View style={styles.reviewsList}>
          {reviews.map(r => (
                        <View key={r.id} style={styles.reviewCard}>
                          <View style={styles.reviewHeader}>
                            <View style={styles.reviewRating}>
                              <Text style={styles.reviewStar}>★</Text>
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
    paddingBottom: 80,
  },
  layout: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    gap: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  sidebar: {
    width: Platform.select({
      web: '33.333%',
      default: '100%',
    }),
    maxWidth: Platform.select({
      web: 384,
      default: '100%',
    }),
    ...Platform.select({
      web: {
        position: 'sticky',
        top: theme.spacing['2xl'],
        alignSelf: 'flex-start',
      },
    }),
  },
  sidebarCard: {
    flex: 1,
    gap: theme.spacing['2xl'],
    padding: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.xl,
    backgroundColor: '#FFFFFF',
    ...elev('sm'),
  },
  profileSection: {
    gap: theme.spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: BACKGROUND_LIGHT,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xs / 2,
  },
  profileName: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 20 * 1.2,
  },
  profileLocation: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
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
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 24 * 1.2,
  },
  starIcon: {
    fontSize: 20,
    color: STAR_COLOR,
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  bioSection: {
    gap: theme.spacing.sm,
  },
  bioTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  bioText: {
    color: TEXT_MUTED_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.6,
  },
  ctaContainer: {
    gap: theme.spacing.md,
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  secondaryButton: {
    height: 48,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: `${PRIMARY_COLOR}33`, // primary/20
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  mainContent: {
    flex: 1,
    width: Platform.select({
      web: '66.666%',
      default: '100%',
    }),
  },
  tabContainer: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  tab: {
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  tabTextActive: {
    color: TEXT_DARK,
  },
  filterContainer: {
    paddingVertical: theme.spacing['2xl'],
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  filterLabel: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
    color: TEXT_MUTED_DARK,
    fontSize: theme.typography.fontSize.sm,
  },
  contentScroll: {
    flex: 1,
    paddingBottom: theme.spacing['4xl'],
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing['2xl'],
  },
  dishCard: {
    flex: 1,
    minWidth: Platform.select({
      web: 280,
      default: '100%',
    }),
    maxWidth: Platform.select({
      web: 'none',
      default: '100%',
    }),
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
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
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  dishInfo: {
    padding: theme.spacing.md,
    flex: 1,
    gap: theme.spacing.md,
  },
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  dishName: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  dishPrice: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  dishDescription: {
    color: TEXT_MUTED_DARK,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  addToCartButton: {
    width: '100%',
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  addToCartButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
  },
  ratingSelector: {
    gap: theme.spacing.sm,
  },
  ratingLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  starButton: {
    fontSize: 24,
  },
  commentInputContainer: {
    gap: theme.spacing.sm,
  },
  commentLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
  reviewRatingValue: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reviewAuthor: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  reviewDate: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.xs,
    marginLeft: 'auto',
  },
  reviewComment: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
});
