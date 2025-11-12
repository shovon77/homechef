import { supabase } from './supabase';
import type { OrderStatus } from './types';
import { callFn } from './fn';

export async function updateOrderStatus(id: number, status: OrderStatus) {
  return await supabase.from('orders').update({ status }).eq('id', id);
}

export async function submitCheckout({
  items,
  chef_id,
  pickupAt,
  successUrl,
  cancelUrl,
}: {
  items: { dish_id: number; quantity: number }[];
  chef_id: number;
  pickupAt: Date;
  successUrl: string;
  cancelUrl: string;
}) {
  const payload = {
    items,
    chef_id,
    pickup_at: pickupAt.toISOString(),
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  const { url } = await callFn<{ url: string }>('create-checkout', payload);
  if (!url) {
    throw new Error('Function did not return a checkout URL');
  }
  return url;
}
