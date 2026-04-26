/**
 * Typed database helper functions aligned to schema.sql
 * 
 * All queries use the single Supabase client from lib/supabase.ts
 * and return types from lib/types.ts
 */

import { supabase } from './supabase';
import { slugify, uniqueSlug } from './slug';
import type {
  Profile,
  Chef,
  Dish,
  DishWithChef,
  DishRating,
  DishRatingStats,
  ChefReview,
  Order,
  OrderItem,
  OrderWithItems,
  OrderStatus,
  ChefSearchOptions,
  OrderQueryOptions,
  CreateOrderInput,
} from './types';

// ============================================================================
// Profiles
// ============================================================================

/**
 * Get profile by user ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as Profile | null;
}

/**
 * Check if user is admin (from profiles.is_admin)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return profile?.is_admin === true;
}

/**
 * Check if user is a chef
 * Returns true if profiles.is_chef OR user exists in chefs table
 */
export async function isChef(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (profile?.is_chef === true) {
    return true;
  }

  // Check if user exists in chefs table (by email match)
  if (profile?.email) {
    const { data } = await supabase
      .from('chefs')
      .select('id')
      .eq('email', profile.email)
      .maybeSingle();

    return !!data;
  }

  return false;
}

// ============================================================================
// Chefs
// ============================================================================

/**
 * Get chefs with pagination and optional search
 */
export async function getChefsPaginated(options: ChefSearchOptions = {}): Promise<Chef[]> {
  const { search, limit = 100, offset = 0 } = options;

  let query = supabase
    .from('chefs')
    .select('*')
    .order('id', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + (limit || 100) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching chefs:', error);
    return [];
  }

  return (data || []) as Chef[];
}

/**
 * Get chef by ID
 */
export async function getChefById(id: number): Promise<Chef | null> {
  const { data, error } = await supabase
    .from('chefs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching chef:', error);
    return null;
  }

  return data as Chef | null;
}

/**
 * Get chef by slug (pretty URL identifier)
 */
export async function getChefBySlug(slug: string): Promise<Chef | null> {
  if (!slug || typeof slug !== 'string') return null;
  const { data, error } = await supabase
    .from('chefs')
    .select('*')
    .eq('slug', slug.trim())
    .maybeSingle();

  if (error) {
    console.error('Error fetching chef by slug:', error);
    return null;
  }

  return data as Chef | null;
}

/**
 * Get chef by numeric id or slug. Prefer slug for canonical URL.
 */
export async function getChefByIdOrSlug(idOrSlug: string): Promise<Chef | null> {
  const s = String(idOrSlug || '').trim();
  if (!s) return null;
  const numericId = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (Number.isFinite(numericId)) {
    return getChefById(numericId);
  }
  return getChefBySlug(s);
}

/**
 * Ensure a chef has a slug; set from name if missing. Call after creating a new chef.
 */
export async function ensureChefSlug(chefId: number, name: string): Promise<string | null> {
  const base = slugify(name || 'chef') || 'chef';
  const { data: existing } = await supabase.from('chefs').select('slug').not('slug', 'is', null);
  const used = new Set((existing || []).map((r: { slug: string }) => r.slug).filter(Boolean));
  const slug = uniqueSlug(base, chefId, used);
  const { error } = await supabase.from('chefs').update({ slug }).eq('id', chefId);
  if (error) {
    console.error('ensureChefSlug update error:', error);
    return null;
  }
  return slug;
}

// ============================================================================
// Dishes
// ============================================================================

/**
 * Get dishes by chef ID
 * Uses dishes.chef_id if available, otherwise falls back to dishes.chef = chefs.name
 */
export async function getDishesByChefId(chefId: number): Promise<Dish[]> {
  // First try by chef_id FK (only active dishes for public display)
  const { data: byFk, error: fkError } = await supabase
    .from('dishes')
    .select('*')
    .eq('chef_id', chefId)
    .or('is_active.eq.true,is_active.is.null')
    .order('id', { ascending: true });

  if (!fkError && byFk && byFk.length > 0) {
    return byFk as Dish[];
  }

  // Fallback: get chef name and match by dishes.chef
  const chef = await getChefById(chefId);
  if (!chef?.name) {
    return [];
  }

  const { data: byName, error: nameError } = await supabase
    .from('dishes')
    .select('*')
    .eq('chef', chef.name)
    .or('is_active.eq.true,is_active.is.null')
    .order('id', { ascending: true });

  if (nameError) {
    console.error('Error fetching dishes by chef name:', nameError);
    return [];
  }

  return (byName || []) as Dish[];
}

/**
 * Get dish by ID
 */
export async function getDishById(id: number): Promise<Dish | null> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dish:', error);
    return null;
  }

  return data as Dish | null;
}

/** Columns needed for dish detail + chef link; smaller payload than select * */
const DISH_DETAIL_SELECT =
  'id, name, chef, chef_id, price, category, image, description, portion, ingredients, thumbnail, featured, created_at, is_active, rating, rating_count, chefs ( id, name, slug, photo, email, user_id )';

const DISH_WITH_CHEF_CACHE_MS = 20_000;
const dishWithChefCache = new Map<number, { t: number; v: DishWithChef | null }>();

/**
 * Get dish by ID with joined Chef data (narrow columns + short-lived cache for faster repeat visits / prefetch).
 */
export async function getDishWithChef(id: number): Promise<DishWithChef | null> {
  if (!Number.isFinite(id)) return null;
  const now = Date.now();
  const hit = dishWithChefCache.get(id);
  if (hit && now - hit.t < DISH_WITH_CHEF_CACHE_MS) return hit.v;

  const { data, error } = await supabase
    .from('dishes')
    .select(DISH_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dish with chef:', error);
    return null;
  }

  const v = data as DishWithChef | null;
  dishWithChefCache.set(id, { t: now, v });
  return v;
}

/** Warm cache when user hovers / press-in on a dish card */
export function prefetchDishWithChef(id: number): void {
  if (Number.isFinite(id)) void getDishWithChef(id);
}

// ============================================================================
// Dish Ratings
// ============================================================================

const DISH_RATING_CACHE_MS = 30_000;
const dishRatingCache = new Map<number, { t: number; v: DishRatingStats }>();

/**
 * Get dish ratings aggregate (prefers RPC; falls back to capped client compute if RPC missing).
 * Results cached for 30 s to avoid repeat RPCs on back-navigation.
 */
export async function getDishRatings(dishId: number): Promise<DishRatingStats> {
  const now = Date.now();
  const hit = dishRatingCache.get(dishId);
  if (hit && now - hit.t < DISH_RATING_CACHE_MS) return hit.v;
  const { data: rows, error: rpcErr } = await supabase.rpc('get_dish_rating_stats', {
    p_dish_id: dishId,
  });

  if (!rpcErr && rows && rows.length > 0) {
    const r = rows[0] as { avg_rating: number | null; rating_count: number | null };
    const v: DishRatingStats = { average: Number(r.avg_rating) || 0, count: Number(r.rating_count) || 0 };
    dishRatingCache.set(dishId, { t: Date.now(), v });
    return v;
  }

  const { data, error } = await supabase
    .from('dish_ratings')
    .select('rating, stars')
    .eq('dish_id', dishId)
    .limit(2000);

  if (error || !data || data.length === 0) {
    return { average: 0, count: 0 };
  }

  const ratings = data.map((row: any) => row.rating ?? row.stars ?? 0).filter((n: number) => n > 0);
  if (ratings.length === 0) return { average: 0, count: 0 };

  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const average = sum / ratings.length;
  const v: DishRatingStats = { average: Math.round(average * 10) / 10, count: ratings.length };
  dishRatingCache.set(dishId, { t: Date.now(), v });
  return v;
}

/**
 * Get dish reviews with user names (paginated RPC; fallback matches).
 * @param limit max 100 per RPC contract
 * @param offset for "load more"
 */
export async function getDishReviews(
  dishId: number,
  limit = 20,
  offset = 0
): Promise<DishRating[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  const { data: ratings, error } = await supabase.rpc('get_dish_reviews_with_names', {
    p_dish_id: dishId,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });

  if (error) {
    return getDishReviewsFallback(dishId, safeLimit, safeOffset);
  }

  return (ratings || []) as DishRating[];
}

/**
 * Fallback when RPC is not available - fetches ratings and profiles separately.
 * Profiles may be empty for anonymous users due to RLS.
 */
async function getDishReviewsFallback(
  dishId: number,
  limit = 20,
  offset = 0
): Promise<DishRating[]> {
  const to = offset + limit - 1;
  const { data: ratings, error } = await supabase
    .from('dish_ratings')
    .select('*')
    .eq('dish_id', dishId)
    .order('created_at', { ascending: false })
    .range(offset, to);

  if (error || !ratings) {
    console.error('Error fetching dish reviews:', error);
    return [];
  }

  const userIds = [...new Set(ratings.map((r: any) => r.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name || p.email || 'Anonymous']));

  return ratings.map((r: any) => ({
    ...r,
    user_name: r.user_id ? (profileMap.get(r.user_id) || 'Anonymous') : 'Anonymous',
  })) as DishRating[];
}

// ============================================================================
// Chef Reviews
// ============================================================================

/**
 * Get chef reviews
 */
export async function getChefReviews(chefId: number, limit = 100): Promise<ChefReview[]> {
  const { data, error } = await supabase
    .from('chef_reviews')
    .select('*')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching chef reviews:', error);
    return [];
  }

  return (data || []) as ChefReview[];
}

// ============================================================================
// Orders
// ============================================================================

/**
 * Get orders for a specific user
 * Includes order_items and dish information
 */
export async function getUserOrders(userId: string, options: { status?: OrderStatus; limit?: number } = {}): Promise<OrderWithItems[]> {
  const { status, limit = 100 } = options;

  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError || !orders) {
    console.error('Error fetching user orders:', ordersError);
    return [];
  }

  // Load order_items for all orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: orderItems, error: itemsError } = orderIds.length > 0
    ? await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
    : { data: [], error: null };

  if (itemsError) {
    console.warn('Error fetching order_items:', itemsError);
  }

  // Load dishes for order_items (including image and chef info)
  const dishIds = [...new Set((orderItems || []).map((item: any) => item.dish_id).filter(Boolean))];
  const { data: dishes, error: dishesError } = dishIds.length > 0
    ? await supabase
        .from('dishes')
        .select('id, name, image, chef, chef_id')
        .in('id', dishIds)
    : { data: [], error: null };

  if (dishesError) {
    console.warn('Error fetching dishes:', dishesError);
  }

  // Load chefs for chef names
  const chefIds = [...new Set((dishes || []).map((d: any) => d.chef_id).filter(Boolean))];
  const { data: chefs, error: chefsError } = chefIds.length > 0
    ? await supabase
        .from('chefs')
        .select('id, name')
        .in('id', chefIds)
    : { data: [], error: null };

  if (chefsError) {
    console.warn('Error fetching chefs:', chefsError);
  }

  // Create lookup maps
  const dishMap = new Map((dishes || []).map((d: any) => [d.id, d]));
  const chefMap = new Map((chefs || []).map((c: any) => [c.id, c.name]));
  const itemsByOrderId = new Map<number, (OrderItem & { dish_name?: string | null; dish_image?: string | null; chef_name?: string | null })[]>();

  (orderItems || []).forEach((item: any) => {
    if (!itemsByOrderId.has(item.order_id)) {
      itemsByOrderId.set(item.order_id, []);
    }
    const dish = dishMap.get(item.dish_id);
    const chefName = dish?.chef_id ? chefMap.get(dish.chef_id) : dish?.chef || null;
    itemsByOrderId.get(item.order_id)!.push({
      ...item,
      dish_name: dish?.name || null,
      dish_image: dish?.image || null,
      chef_name: chefName,
    });
  });

  // Combine orders with items
  return orders.map((order: any) => ({
    ...order,
    order_items: itemsByOrderId.get(order.id) || [],
  })) as OrderWithItems[];
}

/**
 * Get orders with optional status filter and pagination
 * Includes order_items and user email from profiles
 */
export async function getOrders(options: OrderQueryOptions = {}): Promise<OrderWithItems[]> {
  const { status, limit = 100, offset = 0 } = options;

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError || !orders) {
    console.error('Error fetching orders:', ordersError);
    return [];
  }

  // Load order_items for all orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: orderItems, error: itemsError } = orderIds.length > 0
    ? await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
    : { data: [], error: null };

  if (itemsError) {
    console.warn('Error fetching order_items:', itemsError);
  }

  // Load dishes for order_items
  const dishIds = [...new Set((orderItems || []).map((item: any) => item.dish_id).filter(Boolean))];
  const { data: dishes, error: dishesError } = dishIds.length > 0
    ? await supabase
        .from('dishes')
        .select('id, name')
        .in('id', dishIds)
    : { data: [], error: null };

  if (dishesError) {
    console.warn('Error fetching dishes:', dishesError);
  }

  // Load profiles for user emails
  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
    : { data: [], error: null };

  if (profilesError) {
    console.warn('Error fetching profiles:', profilesError);
  }

  // Create lookup maps
  const dishMap = new Map((dishes || []).map((d: any) => [d.id, d.name]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));
  const itemsByOrderId = new Map<number, (OrderItem & { dish_name?: string | null })[]>();

  (orderItems || []).forEach((item: any) => {
    if (!itemsByOrderId.has(item.order_id)) {
      itemsByOrderId.set(item.order_id, []);
    }
    itemsByOrderId.get(item.order_id)!.push({
      ...item,
      dish_name: dishMap.get(item.dish_id) || null,
    });
  });

  // Combine orders with items and user email
  return orders.map((order: any) => ({
    ...order,
    user_email: profileMap.get(order.user_id) || null,
    order_items: itemsByOrderId.get(order.id) || [],
  })) as OrderWithItems[];
}

/**
 * Create a new order with order_items
 * Writes to orders and order_items tables, calculates total_cents
 */
export async function createOrder(input: CreateOrderInput): Promise<Order | null> {
  const { userId, items } = input;

  if (!items || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  // Calculate total
  const totalCents = items.reduce((sum, item) => {
    return sum + item.unit_price_cents * item.quantity;
  }, 0);

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status: 'pending',
      total_cents: totalCents,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error('Error creating order:', orderError);
    return null;
  }

  // Create order_items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    dish_id: item.dish_id,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    notes: item.notes,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('Error creating order_items:', itemsError);
    // Order was created but items failed - this is a partial failure
    // In production, you might want to rollback the order
    return null;
  }

  return order as Order;
}

