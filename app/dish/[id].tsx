import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { theme, elev } from "../../lib/theme";
import { getDishById, getDishRatings, getChefById } from "../../lib/db";
import { submitDishRating, getDishRatingSummary } from "../../lib/reviews";
import type { Dish } from "../../lib/types";
import { useCart } from "../../context/CartContext";
import { useRole } from "../../hooks/useRole";
import { Screen } from "../../components/Screen";
import { formatCad } from "../../lib/money";

// Colors from HTML design
const PRIMARY_COLOR = '#19e680';
const BACKGROUND_LIGHT = '#f6f8f7';
const TEXT_DARK = '#0e1b14';
const TEXT_MUTED = '#71717a';
const TEXT_GRAY = '#6b7280';
const BORDER_LIGHT = '#e5e7eb';

const normalizeId = (id: any) => String(typeof id === "string" ? id.replace(/^s_/, "") : id);

export default function DishDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const raw = String(Array.isArray(id) ? id[0] : id || '');
  const dishId = (() => {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
    const tail = raw.replace(/[^0-9]+/g,'');
    return tail ? Number(tail) : NaN;
  })();

  const [dish, setDish] = useState<Dish | null>(null);
  const [chef, setChef] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  // Load dish and ratings
  useEffect(() => {
    if (!Number.isFinite(dishId)) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      
      const dishData = await getDishById(dishId);
      if (!mounted) return;
      if (!dishData) {
        console.log("Dish not found");
        setLoading(false);
        return;
      }
      setDish(dishData);
      
      // Load chef info
      if (dishData.chef_id) {
        const chefData = await getChefById(Number(dishData.chef_id));
        if (chefData) {
          setChef(chefData);
          
          // Check ownership
          if (user) {
            let ownsDish = false;
            if ((chefData as any).user_id) {
              ownsDish = (chefData as any).user_id === user.id;
            } else if (chefData.email && user.email) {
              ownsDish = chefData.email.toLowerCase() === user.email.toLowerCase();
            }
            setIsDishOwner(ownsDish);
          }
        }
      }
      
      const ratingStats = await getDishRatings(dishId);
      setRatingCount(ratingStats.count);
      setAvgRating(ratingStats.average);
      
      if (user) {
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
      }
      
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [raw, user]);

  const onUploadPhoto = async () => {
    try {
      if (!dish) return;
      setUploading(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") { 
        Alert.alert("Permission needed", "Please allow photo access to upload."); 
        setUploading(false); 
        return; 
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        quality: 0.9 
      });
      if (picked.canceled) { setUploading(false); return; }
      const asset = picked.assets[0];
      const uri = asset.uri;
      const baseName = uri.split("/").pop() || `dish-${Date.now()}.jpg`;
      const extGuess = (baseName.split(".").pop() || "jpg").toLowerCase();
      const contentType = asset.mimeType || (extGuess === "png" ? "image/png" : extGuess === "webp" ? "image/webp" : "image/jpeg");
      const res = await fetch(uri);
      const blob = await res.blob();
      const path = `dishes/${dish.id}/${Date.now()}-${baseName}`;
      const { error: upErr } = await supabase.storage.from("dish-images").upload(path, blob, { upsert: true, contentType, cacheControl: "3600" });
      if (upErr) { 
        console.log("[upload] storage error:", upErr); 
        Alert.alert("Upload failed", upErr.message); 
        setUploading(false); 
        return; 
      }
      const { data: pub } = await supabase.storage.from("dish-images").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) { 
        Alert.alert("Upload failed", "Could not obtain public URL"); 
        setUploading(false); 
        return; 
      }
      const { error: rowErr } = await supabase.from("dishes").update({ image: publicUrl }).eq("id", dish.id);
      if (rowErr) { 
        console.log("[upload] row update error:", rowErr); 
        Alert.alert("Save failed", rowErr.message); 
        setUploading(false); 
        return; 
      }
      setDish(prev => prev ? { ...prev, image: publicUrl } : prev);
      Alert.alert("Done", "Photo updated!");
    } catch (e: any) {
      console.log("[upload] exception:", e);
      Alert.alert("Upload failed", e?.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

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
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={true}
      >
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
        <View style={styles.grid}>
          {/* Left Column: Image Gallery */}
          <View style={styles.imageColumn}>
            <View style={styles.mainImageContainer}>
              <Image
                source={{ uri: mainImage }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.thumbnailGrid}>
              {thumbnailImages.map((img, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={[styles.thumbnail, i === 0 && styles.thumbnailActive]}
                  onPress={() => setDish({ ...dish, image: img })}
                >
        <Image
                    source={{ uri: img }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
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
                <Text style={styles.cartIcon}>🛒</Text>
                <Text style={styles.addToCartButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>

            {/* Upload photo button: only show for admin or dish owner */}
            {(isAdmin || isDishOwner) && (
              <TouchableOpacity
                onPress={onUploadPhoto}
                disabled={uploading}
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? "Uploading…" : "Upload photo"}
                </Text>
              </TouchableOpacity>
            )}
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
                <Text style={styles.emptyText}>Ingredients and allergen information coming soon.</Text>
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
      </ScrollView>
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
    fontWeight: theme.typography.fontWeight.medium,
  },
  breadcrumbSeparator: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  breadcrumbCurrent: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
    aspectRatio: 1,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...elev('lg'),
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  thumbnail: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.7,
  },
  thumbnailActive: {
    borderColor: PRIMARY_COLOR,
    opacity: 1,
  },
  thumbnailImage: {
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
    fontWeight: theme.typography.fontWeight.medium,
  },
  description: {
    color: TEXT_GRAY,
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.5,
    marginTop: theme.spacing.md,
  },
  price: {
    color: TEXT_DARK,
    fontSize: 36,
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
    fontWeight: theme.typography.fontWeight.bold,
  },
  quantityValue: {
    width: 48,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
  },
  uploadButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
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
    fontWeight: theme.typography.fontWeight.medium,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
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
    fontWeight: theme.typography.fontWeight.bold,
  },
  ratingInputContainer: {
    gap: theme.spacing.sm,
  },
  ratingLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
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
  },
  commentInput: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
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
    fontWeight: theme.typography.fontWeight.medium,
  },
  signInPrompt: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
  },
});
