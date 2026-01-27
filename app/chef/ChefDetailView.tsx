'use client';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Platform, TextInput, Alert, StyleSheet, useWindowDimensions, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { getChefById } from '../../lib/db';
import { submitChefReview, getChefReviews as getChefReviewsHelper } from '../../lib/reviews';
import { useRole } from '../../hooks/useRole';
import type { Chef, Dish, ChefReview } from '../../lib/types';
import Screen from '../../components/Screen';
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

export default function ChefDetailView() {
  const router = useRouter();
  const { id, name, photo, location: locParam, rating: ratingParam, rating_count: rcParam, cuisine } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  
  const chefId = useMemo(() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g, '');
    return tail ? Number(tail) : NaN;
  }, [raw]);

  // Optimistically initialize chef from params to speed up initial render
  const initialChef = useMemo(() => {
    if (!chefId) return null;
    if (name) {
      return {
        id: chefId,
        name: String(name),
        photo: String(photo || ''),
        avatar: String(photo || ''),
        location: String(locParam || ''),
        rating: Number(ratingParam) || 0,
        rating_count: Number(rcParam) || 0,
        cuisine: String(cuisine || ''),
        bio: '', // Will be fetched
        status: 'active', // Assumed
        created_at: '',
        email: '',
        phone: ''
      } as Chef;
    }
    return null;
  }, [chefId, name, photo, locParam, ratingParam, rcParam, cuisine]);

  const [chef, setChef] = useState<Chef | null>(initialChef);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<ChefReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialChef); // Only load if we don't have initial data

  // Loading States for individual sections
  const [isFetchingDishes, setIsFetchingDishes] = useState(true);
  const [isFetchingReviews, setIsFetchingReviews] = useState(true);

  // Missing State Variables
  const [activeTab, setActiveTab] = useState<'dishes' | 'reviews'>('dishes');
  const [dishesPage, setDishesPage] = useState(1);
  const [dishesTotal, setDishesTotal] = useState(0);
  const [dishesLoading, setDishesLoading] = useState(false);
  
  // Review Form State
  const { user } = useRole();
  const { addToCart } = useCart();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Consolidated data fetching
  useEffect(() => {
    if (!chefId) {
      if (raw) setLoading(false);
      return;
    }

    let mounted = true;
    
    const fetchChef = async () => {
      try {
        if (!initialChef) setLoading(true);
        setError(null);

        const chefData = await getChefById(chefId);

        if (!mounted) return;

        if (!chefData) {
          if (!initialChef) setError('Chef not found');
          setLoading(false);
          return;
        }

          setChef(chefData);
      } catch (e: any) {
        if (mounted && !chef && !initialChef) setError(e.message || String(e));
      } finally {
        if (mounted && !initialChef) setLoading(false);
      }
    };

    const fetchDishes = async () => {
      if(mounted) setIsFetchingDishes(true);
      try {
        const { data, count } = await supabase
          .from('dishes')
          .select('*', { count: 'exact' })
          .eq('chef_id', chefId)
          .order('id', { ascending: true })
          .range(0, (isMobile ? 3 : 16) - 1);
          
        if (mounted && data) {
          setDishes(data);
          setDishesTotal(count || 0);
        }
      } catch(e) {
        console.error("Error fetching dishes", e);
      } finally {
        if(mounted) setIsFetchingDishes(false);
      }
    };

    const fetchReviews = async () => {
      if(mounted) setIsFetchingReviews(true);
      try {
        const reviewsData = await getChefReviewsHelper(chefId);
        if (mounted) setReviews(reviewsData);
      } catch(e) {
        console.error("Error fetching reviews", e);
      } finally {
        if(mounted) setIsFetchingReviews(false);
      }
    };

    // Trigger all fetches in parallel, independently
    fetchChef();
    fetchDishes();
    fetchReviews();

    return () => { mounted = false; };
  }, [chefId, isMobile]); // Re-fetch if chefId changes

  // Pagination for dishes (subsequent pages)
  useEffect(() => {
    if (!chefId || dishesPage === 1) return; // Skip first page as it's handled above

    let cancelled = false;
    (async () => {
      setDishesLoading(true);
      try {
        const perPage = isMobile ? 3 : 16;
        const from = (dishesPage - 1) * perPage;
        const to = from + perPage - 1;

        const { data, error } = await supabase
          .from('dishes')
          .select('*')
          .eq('chef_id', chefId)
          .order('id', { ascending: true })
          .range(from, to);

        if (cancelled) return;
        if (error) throw error;

        // Note: This logic replaces dishes. If you want "Load More" style, append instead.
        setDishes(data || []);
      } catch (e: any) {
        if (!cancelled) console.error('Error loading page:', e);
      } finally {
        if (!cancelled) setDishesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chefId, dishesPage, isMobile]);

  const avatar = chef?.photo || chef?.avatar || '';
  const title = chef?.name || (chefId ? `Chef #${chefId}` : 'Chef');
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

      // Refresh chef data to get updated rating
      const chefData = await getChefById(chefId);
      if (chefData) {
        setChef(chefData);
      }

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
  if (loading || (!chef && !error)) {
    return (
      <Screen>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text style={{ color:TEXT_MUTED }}>Loading chef...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={styles.container}>
          <View style={[styles.layout, isMobile && styles.layoutMobile]}>
            {/* Left Sidebar - Sticky */}
            <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
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
                    <Image 
                      source={require('../../assets/star.png')} 
                      style={styles.starIconImage} 
                      resizeMode="contain" 
                    />
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
    </View>
          </View>

          {/* Main Content Area */}
          <View style={[styles.mainContent, isMobile && styles.mainContentMobile]}>
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
                <>
                  {isFetchingDishes ? (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                      <Text style={styles.loadingText}>Loading dishes...</Text>
                    </View>
                  ) : dishes.length === 0 ? (
                    <Text style={styles.emptyText}>No dishes yet.</Text>
                  ) : (
                    <>
                      <View style={[styles.dishesGrid, isMobile && styles.dishesGridMobile]}>
                        {dishes.map(d => {
                          const img = d.image || d.thumbnail || '';
                          return (
                            <View key={d.id} style={[styles.dishCard, isMobile && styles.dishCardMobile]}>
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
                                <Text style={styles.dishName} adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}>
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
                        })}
                      </View>
                      {(() => {
                        const perPage = isMobile ? 3 : 16;
                        const totalPages = Math.ceil(dishesTotal / perPage);
                        return totalPages > 1 && (
                          <View style={styles.pagination}>
                            <Pressable
                              style={[styles.pageButton, dishesPage === 1 && styles.pageButtonDisabled]}
                              onPress={() => setDishesPage(p => Math.max(1, p - 1))}
                              disabled={dishesPage === 1}
                            >
                              <Text style={[styles.pageButtonText, dishesPage === 1 && styles.pageButtonTextDisabled]}>Previous</Text>
                            </Pressable>
                            <Text style={styles.pageInfo}>
                              Page {dishesPage} of {totalPages}
                            </Text>
                            <Pressable
                              style={[styles.pageButton, dishesPage >= totalPages && styles.pageButtonDisabled]}
                              onPress={() => setDishesPage(p => Math.min(totalPages, p + 1))}
                              disabled={dishesPage >= totalPages}
                            >
                              <Text style={[styles.pageButtonText, dishesPage >= totalPages && styles.pageButtonTextDisabled]}>Next</Text>
                            </Pressable>
                          </View>
                        );
                      })()}
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
                                style={[
                                  styles.starButtonImage,
                                  { tintColor: star <= reviewRating ? STAR_COLOR : TEXT_MUTED }
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
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xs / 2,
  },
  profileName: {
    color: TEXT_DARK,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 20 * 1.2,
  },
  profileLocation: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
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
    tintColor: STAR_COLOR,
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  bioSection: {
    gap: theme.spacing.sm,
  },
  bioTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  bioText: {
    color: TEXT_MUTED_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.6,
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
    fontFamily: theme.typography.fontFamily.display,
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
    justifyContent: Platform.select({
      web: 'flex-end',
      default: 'flex-start',
    }),
  },
  filterLabel: {
    color: TEXT_DARK,
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
    color: TEXT_MUTED_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  contentScroll: {
    flex: 1,
    paddingBottom: theme.spacing['4xl'],
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
    color: TEXT_MUTED,
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
    color: TEXT_DARK,
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
    color: TEXT_DARK,
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
    color: TEXT_MUTED_DARK,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  ratingSelector: {
    gap: theme.spacing.sm,
  },
  ratingLabel: {
    color: TEXT_MUTED,
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
    tintColor: STAR_COLOR,
  },
  reviewRatingValue: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reviewAuthor: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  reviewDate: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.body,
    marginLeft: 'auto',
  },
  reviewComment: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  emptyText: {
    color: TEXT_MUTED,
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
    color: TEXT_MUTED,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
  },
  pageButtonTextDisabled: {
    color: TEXT_MUTED,
  },
  pageInfo: {
    color: TEXT_MUTED,
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
});