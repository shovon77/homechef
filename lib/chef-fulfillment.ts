export const DEFAULT_CHEF_FULFILLMENT_MODE = 'pickup_only';

export type ChefFulfillmentMode = 'pickup_only' | 'delivery_only' | 'pickup_and_delivery';

export const CHEF_FULFILLMENT_OPTIONS: readonly { id: ChefFulfillmentMode; label: string }[] = [
  { id: 'pickup_only', label: 'Pickup only' },
  { id: 'delivery_only', label: 'Delivery only' },
  { id: 'pickup_and_delivery', label: 'Pickup + delivery' },
] as const;

const ALLOWED = new Set(CHEF_FULFILLMENT_OPTIONS.map((o) => o.id));

export function isValidChefFulfillmentMode(mode: string | null | undefined): mode is ChefFulfillmentMode {
  const v = (mode ?? '').trim();
  return ALLOWED.has(v as ChefFulfillmentMode);
}

export function resolveChefFulfillmentMode(raw: string | null | undefined): ChefFulfillmentMode {
  const v = (raw ?? '').trim() as ChefFulfillmentMode;
  if (!isValidChefFulfillmentMode(v)) return DEFAULT_CHEF_FULFILLMENT_MODE;
  return v;
}

export function chefFulfillmentLabel(id: string): string {
  const resolved = resolveChefFulfillmentMode(id);
  return CHEF_FULFILLMENT_OPTIONS.find((o) => o.id === resolved)?.label ?? resolved;
}

export function chefFulfillmentIncludesDelivery(mode: string | null | undefined): boolean {
  const resolved = resolveChefFulfillmentMode(mode);
  return resolved === 'delivery_only' || resolved === 'pickup_and_delivery';
}

export function chefFulfillmentIncludesPickup(mode: string | null | undefined): boolean {
  const resolved = resolveChefFulfillmentMode(mode);
  return resolved === 'pickup_only' || resolved === 'pickup_and_delivery';
}

/** Whether an order was placed for delivery (vs pickup). */
export function isDeliveryOrder(order: {
  fulfillment_method?: string | null;
  delivery_address?: string | null;
}): boolean {
  const method = (order.fulfillment_method ?? '').trim();
  if (method === 'delivery') return true;
  if (method === 'pickup') return false;
  return Boolean(order.delivery_address?.trim());
}
