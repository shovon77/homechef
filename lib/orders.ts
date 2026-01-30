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
  items: { dish_id: number; quantity: number; notes?: string }[];
  chef_id: number;
  pickupAt: Date;
  successUrl: string;
  cancelUrl: string;
}) {
  // Ensure pickupAt is a Date object
  const pickupDate = pickupAt instanceof Date ? pickupAt : new Date(pickupAt);
  
  const payload = {
    items,
    chef_id,
    pickup_at: pickupDate.toISOString(),
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  console.log('Submitting checkout with payload:', {
    ...payload,
    pickup_at: pickupDate.toISOString(),
    items_count: items.length,
  });

  const { url } = await callFn<{ url: string }>('create-checkout', payload);
  if (!url) {
    throw new Error('Function did not return a checkout URL');
  }
  return url;
}
