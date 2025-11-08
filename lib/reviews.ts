/**
 * Reviews and ratings helper functions
 * Handles dish ratings and chef reviews with proper upsert logic
 */

import { supabase } from './supabase';
import type { DishRating, ChefReview } from './types';

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
}: {
  dishId: number;
  stars: number;
  comment?: string;
}): Promise<DishRatingSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be authenticated to submit ratings');
  }

  // Upsert rating (both rating and stars for schema compatibility)
  // Note: If user_id column doesn't exist, this will fail - migration needed
  const ratingData: any = {
    dish_id: dishId,
    rating: stars,
    stars: stars, // Also set stars for compatibility
  };
  
  // Add user_id if column exists (will be added via migration)
  try {
    ratingData.user_id = user.id;
  } catch (e) {
    // Column might not exist yet
  }
  
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

  // Return updated summary
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
    .map(r => r.rating ?? r.stars ?? 0)
    .filter(n => typeof n === 'number' && n >= 1 && n <= 5);

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
}

/**
 * Get chef reviews with pagination
 */
export async function getChefReviews(
  chefId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<ChefReview[]> {
  const { limit = 50, offset = 0 } = options;

  let query = supabase
    .from('chef_reviews')
    .select('id, chef_id, rating, comment, created_at')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching chef reviews:', error);
    return [];
  }

  return (data || []) as ChefReview[];
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
    .map(r => r.rating)
    .filter(n => typeof n === 'number' && n >= 1 && n <= 5);

  const count = ratings.length;
  const avg = count > 0 ? ratings.reduce((sum, r) => sum + r, 0) / count : 0;

  return { avg, count };
}

