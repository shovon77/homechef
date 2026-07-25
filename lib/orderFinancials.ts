/** Customer service fee (platform revenue). Currently disabled (0). */
export const DEFAULT_PLATFORM_FEE_CENTS = 0;

/** Platform commission on food subtotal only. */
export const PLATFORM_COMMISSION_RATE = 0.10;

export type OrderAmountFields = {
  subtotal_cents?: number | null;
  total_cents?: number | null;
  platform_fee_cents?: number | null;
  platform_commission_cents?: number | null;
  delivery_fee_cents?: number | null;
};

export function getOrderDeliveryFeeCents(order: OrderAmountFields): number {
  const stored = order.delivery_fee_cents;
  if (typeof stored === 'number' && stored >= 0) return stored;
  return 0;
}

export function getOrderSubtotalCents(order: OrderAmountFields): number {
  if (typeof order.subtotal_cents === 'number' && order.subtotal_cents >= 0) {
    return order.subtotal_cents;
  }
  const total = order.total_cents ?? 0;
  const platformFee = order.platform_fee_cents ?? 0;
  const deliveryFee = getOrderDeliveryFeeCents(order);
  return Math.max(0, total - platformFee - deliveryFee);
}

/** Food subtotal plus delivery fees charged to the customer (excludes platform service fee). */
export function getChefGrossSalesCents(order: OrderAmountFields): number {
  return getOrderSubtotalCents(order) + getOrderDeliveryFeeCents(order);
}

/** 10% of food subtotal; prefers stored platform_commission_cents from checkout. */
export function getChefPlatformCommissionCents(order: OrderAmountFields): number {
  const stored = order.platform_commission_cents;
  if (typeof stored === 'number' && stored >= 0) return stored;
  const subtotal = getOrderSubtotalCents(order);
  return Math.round(subtotal * PLATFORM_COMMISSION_RATE);
}

/**
 * Stripe transfer to chef: food subtotal − 10% commission + full delivery fee.
 * Delivery fee is not subject to platform commission.
 */
export function getChefPayoutCents(order: OrderAmountFields): number {
  return (
    getOrderSubtotalCents(order) -
    getChefPlatformCommissionCents(order) +
    getOrderDeliveryFeeCents(order)
  );
}

/** Chef take-home after platform commission on food; includes delivery fees. */
export function getChefNetSalesCents(order: OrderAmountFields): number {
  return getChefPayoutCents(order);
}

/** Platform revenue from an order: flat service fee + 10% food commission. */
export function getPlatformRevenueCents(order: OrderAmountFields): number {
  return (order.platform_fee_cents ?? 0) + getChefPlatformCommissionCents(order);
}
