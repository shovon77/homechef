/**
 * Reviews and ratings helper functions
 * Handles dish ratings and chef reviews with proper upsert logic
 */

import { supabase } from './supabase';
import type { DishRating, ChefReview } from './types';
import { toStarRatingOrNull } from './number';

export type DishRatingSummary = {
  avg: number;
  count: number;
};

export type ChefRatingSummary = {
  avg: number;
  count: number;
};

/**
 * Submit or update a dish rating
 * Uses upsert to handle unique-per-user constraint
 */
export async function submitDishRating({
  dishId,
  stars,
  comment,
  userId,
}: {
  dishId: number;
  stars: number;
  comment?: string;
  /** Pass from caller to skip an extra `auth.getUser()` round-trip */
  userId?: string;
}): Promise<DishRatingSummary> {
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated to submit ratings');
    uid = user.id;
  }

  // Upsert rating (both rating and stars for schema compatibility)
  // Note: If user_id column doesn't exist, this will fail - migration needed
  const ratingData: any = {
    dish_id: dishId,
    rating: stars,
    stars: stars, // Also set stars for compatibility
  };
  
  ratingData.user_id = uid;
  
  if (comment?.trim()) {
    ratingData.comment = comment.trim();
  }

  const { error } = await supabase
    .from('dish_ratings')
    .upsert(ratingData, {
      onConflict: 'dish_id,user_id', // Handle unique constraint if exists
    });

  if (error) {
    // If unique constraint doesn't exist, try without it
    if (error.code === '42704' || error.message.includes('user_id')) {
      // Column doesn't exist - insert without user_id
      const { error: insertError } = await supabase
        .from('dish_ratings')
        .insert({
          dish_id: dishId,
          rating: stars,
          stars: stars,
          comment: comment?.trim() || null,
        });
      
      if (insertError) {
        throw new Error(`Failed to submit rating: ${insertError.message}`);
      }
    } else {
      throw new Error(`Failed to submit rating: ${error.message}`);
    }
  }

  await recalculateDishRating(dishId);
  return getDishRatingSummary(dishId);
}

/**
 * Get dish rating summary (average and count)
 * Uses COALESCE(stars, rating) to handle both columns
 */
export async function getDishRatingSummary(dishId: number): Promise<DishRatingSummary> {
  const { data, error } = await supabase
    .from('dish_ratings')
    .select('rating, stars')
    .eq('dish_id', dishId);

  if (error) {
    console.error('Error fetching dish ratings:', error);
    return { avg: 0, count: 0 };
  }

  const ratings = (data || [])
    .map((r) => toStarRatingOrNull(r.rating ?? r.stars))
    .filter((n): n is number => n !== null);

  const count = ratings.length;
  const avg = count > 0 ? ratings.reduce((sum, r) => sum + r, 0) / count : 0;

  return { avg, count };
}

/**
 * Submit or update a chef review
 * Uses upsert to handle unique-per-user constraint
 */
export async function submitChefReview({
  chefId,
  rating,
  comment,
}: {
  chefId: number;
  rating: number;
  comment?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be authenticated to submit reviews');
  }

  // Upsert review
  // Note: If user_id column doesn't exist, this will fail - migration needed
  const reviewData: any = {
    chef_id: chefId,
    rating,
  };
  
  // Add user_id if column exists (will be added via migration)
  try {
    reviewData.user_id = user.id;
  } catch (e) {
    // Column might not exist yet
  }
  
  if (comment?.trim()) {
    reviewData.comment = comment.trim();
  }

  const { error } = await supabase
    .from('chef_reviews')
    .upsert(reviewData, {
      onConflict: 'chef_id,user_id', // Handle unique constraint if exists
    });

  if (error) {
    // If unique constraint doesn't exist, try without it
    if (error.code === '42704' || error.message.includes('user_id')) {
      // Column doesn't exist - insert without user_id
      const { error: insertError } = await supabase
        .from('chef_reviews')
        .insert({
          chef_id: chefId,
          rating,
          comment: comment?.trim() || null,
        });
      
      if (insertError) {
        throw new Error(`Failed to submit review: ${insertError.message}`);
      }
    } else if (error.code === '23505') {
      // Unique violation - try update instead
      const updateData: any = { rating };
      if (comment?.trim()) {
        updateData.comment = comment.trim();
      }
      
      const { error: updateError } = await supabase
        .from('chef_reviews')
        .update(updateData)
        .eq('chef_id', chefId);
      
      // Try with user_id if column exists
      try {
        if (updateError) {
          const { error: updateError2 } = await supabase
            .from('chef_reviews')
            .update(updateData)
            .eq('chef_id', chefId)
            .eq('user_id', user.id);
          
          if (updateError2) {
            throw new Error(`Failed to update review: ${updateError2.message}`);
          }
        }
      } catch (e) {
        if (updateError) {
          throw new Error(`Failed to update review: ${updateError.message}`);
        }
      }
    } else {
      throw new Error(`Failed to submit review: ${error.message}`);
    }
  }

  // Recalculate chef rating after submitting review
  await recalculateChefRating(chefId);
}

/**
 * Get chef reviews with pagination
 * Uses RPC get_chef_reviews_with_names to include user names for both logged-in and anonymous users
 */
export async function getChefReviews(
  chefId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<ChefReview[]> {
  const { limit = 50, offset = 0 } = options;

  const { data: reviews, error } = await supabase.rpc('get_chef_reviews_with_names', {
    p_chef_id: chefId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    // Fallback to direct query if RPC not yet deployed (e.g. migration not run)
    return getChefReviewsFallback(chefId, options);
  }

  return (reviews || []) as ChefReview[];
}

/**
 * Fallback when RPC is not available - fetches reviews and profiles separately.
 * Profiles may be empty for anonymous users due to RLS.
 */
async function getChefReviewsFallback(
  chefId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<ChefReview[]> {
  const { limit = 50, offset = 0 } = options;

  let query = supabase
    .from('chef_reviews')
    .select('id, chef_id, rating, comment, created_at, user_id')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: reviews, error } = await query;

  if (error) {
    console.error('Error fetching chef reviews:', error);
    return [];
  }

  if (reviews && reviews.length > 0) {
    const userIds = [...new Set(reviews.map((r: any) => r.user_id).filter(Boolean))];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profiles && profiles.length > 0) {
        const profileMap = new Map(profiles.map((p: any) => [p.id, p.name || p.email || 'Anonymous']));

        return reviews.map((r: any) => ({
          ...r,
          user_name: r.user_id ? profileMap.get(r.user_id) || 'Anonymous' : 'Anonymous',
        })) as ChefReview[];
      }
    }
  }

  return (reviews || []).map((r: any) => ({ ...r, user_name: 'Anonymous' })) as ChefReview[];
}

/**
 * Get chef rating summary (average and count)
 */
export async function getChefRatingSummary(chefId: number): Promise<ChefRatingSummary> {
  const { data, error } = await supabase
    .from('chef_reviews')
    .select('rating')
    .eq('chef_id', chefId);

  if (error) {
    console.error('Error fetching chef rating summary:', error);
    return { avg: 0, count: 0 };
  }

  const ratings = (data || [])
    .map((r) => toStarRatingOrNull(r.rating))
    .filter((n): n is number => n !== null);

  const count = ratings.length;
  const avg = count > 0 ? ratings.reduce((sum, r) => sum + r, 0) / count : 0;

  return { avg, count };
}

function roundRating(avg: number): number {
  return Math.round(avg * 10) / 10;
}

/**
 * Recalculate and update dish rating from all dish_ratings rows.
 * Prefer the DB trigger (migrations/add_dish_rating_recalc_trigger.sql); this is a client fallback.
 */
export async function recalculateDishRating(dishId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const summary = await getDishRatingSummary(dishId);

    const { error } = await supabase
      .from('dishes')
      .update({
        rating: summary.count > 0 ? roundRating(summary.avg) : 0,
        rating_count: summary.count,
      })
      .eq('id', dishId);

    if (error) {
      console.error('Error updating dish rating:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('Error recalculating dish rating:', e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Recalculate and update chef rating from all reviews.
 * Prefer the DB trigger (migrations/add_chef_rating_recalc_trigger.sql); this is a client fallback.
 */
export async function recalculateChefRating(chefId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const summary = await getChefRatingSummary(chefId);

    const { error } = await supabase
      .from('chefs')
      .update({
        rating: summary.count > 0 ? roundRating(summary.avg) : null,
        rating_count: summary.count,
      })
      .eq('id', chefId);

    if (error) {
      console.error('Error updating chef rating:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('Error recalculating chef rating:', e);
    return { ok: false, error: e?.message || String(e) };
  }
}

