/** Flat customer service fee (platform revenue, not deducted from chef food subtotal). */
export const DEFAULT_PLATFORM_FEE_CENTS = 150;

/** Platform commission on food subtotal only. */
export const PLATFORM_COMMISSION_RATE = 0.10;

export type OrderAmountFields = {
  subtotal_cents?: number | null;
  total_cents?: number | null;
  platform_fee_cents?: number | null;
  platform_commission_cents?: number | null;
};

export function getOrderSubtotalCents(order: OrderAmountFields): number {
  if (typeof order.subtotal_cents === 'number' && order.subtotal_cents >= 0) {
    return order.subtotal_cents;
  }
  const total = order.total_cents ?? 0;
  const platformFee = order.platform_fee_cents ?? 0;
  return Math.max(0, total - platformFee);
}

/** 10% of food subtotal; prefers stored platform_commission_cents from checkout. */
export function getChefPlatformCommissionCents(order: OrderAmountFields): number {
  const stored = order.platform_commission_cents;
  if (typeof stored === 'number' && stored >= 0) return stored;
  const subtotal = getOrderSubtotalCents(order);
  return Math.round(subtotal * PLATFORM_COMMISSION_RATE);
}

export function getChefNetSalesCents(order: OrderAmountFields): number {
  return getOrderSubtotalCents(order) - getChefPlatformCommissionCents(order);
}
