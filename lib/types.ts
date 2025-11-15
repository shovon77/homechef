/**
 * TypeScript types matching schema.sql exactly
 * 
 * Note: PostgreSQL BIGINT can exceed JavaScript's Number.MAX_SAFE_INTEGER (2^53 - 1).
 * For IDs in the UI, we use `number` as most IDs will be within safe range.
 * For production systems with very large IDs, consider using string or BigInt.
 */

// ============================================================================
// Profiles
// ============================================================================
export type Profile = {
  id: string; // uuid
  email: string | null;
  name: string | null;
  role: string; // default 'user'
  is_chef: boolean; // default false
  created_at: string | null; // timestamptz
  is_admin: boolean; // default false
  photo_url?: string | null; // Avatar URL (stored in Supabase Storage)
  location?: string | null; // User location from Google Places
};

// ============================================================================
// Chefs
// ============================================================================
export type Chef = {
  id: number; // BIGINT (may exceed JS safe int in production)
  name: string; // UNIQUE, NOT NULL
  location: string | null;
  bio: string | null;
  photo: string | null;
  email: string | null;
  phone: string | null;
  status: string; // default 'pending'
  rating: number | null; // numeric
  rating_count: number | null; // integer
  created_at: string | null; // timestamptz
};

// ============================================================================
// Dishes
// ============================================================================
export type Dish = {
  id: number; // BIGINT (may exceed JS safe int in production)
  name: string; // NOT NULL
  chef: string; // NOT NULL (chef name)
  chef_id: number | null; // BIGINT FK -> chefs.id
  price: number; // numeric, default 0
  category: string | null;
  image: string | null; // default URL
  description: string | null;
  thumbnail: string | null;
  featured: boolean; // default false
  created_at: string | null; // timestamptz
};

// ============================================================================
// Dish Ratings
// ============================================================================
export type DishRating = {
  id: number; // BIGINT
  dish_id: number; // BIGINT FK -> dishes.id
  rating: number; // integer, 1-5
  stars: number; // integer, 1-5
  created_at: string | null; // timestamptz
};

export type DishRatingStats = {
  average: number;
  count: number;
};

// ============================================================================
// Chef Ratings & Reviews
// ============================================================================
export type ChefRating = {
  id: number; // BIGINT
  chef_id: number; // BIGINT FK -> chefs.id
  stars: number; // integer, 1-5
  created_at: string | null; // timestamptz
};

export type ChefReview = {
  id: number; // BIGINT
  chef_id: number; // BIGINT FK -> chefs.id
  rating: number; // integer, 1-5
  comment: string | null;
  created_at: string | null; // timestamptz
};

// ============================================================================
// Orders
// ============================================================================
export type OrderStatus = 'requested' | 'pending' | 'ready' | 'paid' | 'completed' | 'cancelled' | 'rejected';

export type Order = {
  id: number; // BIGINT
  user_id: string; // uuid FK -> auth.users.id
  chef_id: number | null; // BIGINT FK -> chefs.id
  status: OrderStatus; // default 'requested'
  total_cents: number; // integer, default 0
  pickup_at: string | null; // timestamptz
  created_at: string; // timestamptz, NOT NULL
};

// ============================================================================
// Order Items
// ============================================================================
export type OrderItem = {
  id: number; // BIGINT
  order_id: number; // BIGINT FK -> orders.id
  dish_id: number | null; // integer FK -> dishes.id
  quantity: number; // integer, default 1
  unit_price_cents: number; // integer, default 0
};

// Order with joined order_items and user email
export type OrderWithItems = Order & {
  user_email?: string | null;
  order_items?: (OrderItem & { dish_name?: string | null })[];
};

// ============================================================================
// Query Options
// ============================================================================
export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

export type ChefSearchOptions = PaginationOptions & {
  search?: string;
};

export type OrderQueryOptions = PaginationOptions & {
  status?: OrderStatus;
};

// ============================================================================
// Create Order Input
// ============================================================================
export type CreateOrderItem = {
  dish_id: number;
  quantity: number;
  unit_price_cents: number;
};

export type CreateOrderInput = {
  userId: string;
  chefId: number;
  pickupAt: string;
  status?: OrderStatus;
  items: CreateOrderItem[];
};

