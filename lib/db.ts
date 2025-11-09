/**
 * Typed database helper functions aligned to schema.sql
 * 
 * All queries use the single Supabase client from lib/supabase.ts
 * and return types from lib/types.ts
 */

import { supabase } from './supabase';
import type {
  Profile,
  Chef,
  Dish,
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

// ============================================================================
// Dishes
// ============================================================================

/**
 * Get dishes by chef ID
 * Uses dishes.chef_id if available, otherwise falls back to dishes.chef = chefs.name
 */
export async function getDishesByChefId(chefId: number): Promise<Dish[]> {
  // First try by chef_id FK
  const { data: byFk, error: fkError } = await supabase
    .from('dishes')
    .select('*')
    .eq('chef_id', chefId)
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

// ============================================================================
// Dish Ratings
// ============================================================================

/**
 * Get dish ratings and calculate average
 * Uses dish_ratings.rating or dish_ratings.stars (prefer rating, fallback to stars)
 */
export async function getDishRatings(dishId: number): Promise<DishRatingStats> {
  const { data, error } = await supabase
    .from('dish_ratings')
    .select('rating, stars')
    .eq('dish_id', dishId);

  if (error || !data || data.length === 0) {
    return { average: 0, count: 0 };
  }

  // Use rating if available, otherwise use stars
  const ratings = data.map((r: any) => r.rating ?? r.stars ?? 0).filter((r: number) => r > 0);

  if (ratings.length === 0) {
    return { average: 0, count: 0 };
  }

  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const average = sum / ratings.length;

  return {
    average: Math.round(average * 10) / 10, // Round to 1 decimal
    count: ratings.length,
  };
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

