import { supabase } from './supabase';
import type { OrderStatus } from './types';
import { callFn } from './fn';
import { toCanadianPhoneE164 } from './formatPhone';

export async function updateOrderStatus(id: number, status: OrderStatus) {
  return await supabase.from('orders').update({ status }).eq('id', id);
}

type CheckoutItem = { dish_id: number; quantity: number; notes?: string };

type SubmitCheckoutBase = {
  items: CheckoutItem[];
  chef_id: number;
  successUrl: string;
  cancelUrl: string;
};

type SubmitCheckoutPickup = SubmitCheckoutBase & {
  fulfillmentMethod: 'pickup';
  pickupAt: Date;
};

type SubmitCheckoutDelivery = SubmitCheckoutBase & {
  fulfillmentMethod: 'delivery';
  deliveryAt: Date;
  deliveryAddress: string;
  deliveryPhone: string;
};

export type SubmitCheckoutParams = SubmitCheckoutPickup | SubmitCheckoutDelivery;

export async function submitCheckout(params: SubmitCheckoutParams) {
  const payload: Record<string, unknown> = {
    items: params.items,
    chef_id: params.chef_id,
    fulfillment_method: params.fulfillmentMethod,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  if (params.fulfillmentMethod === 'pickup') {
    const pickupDate = params.pickupAt instanceof Date ? params.pickupAt : new Date(params.pickupAt);
    payload.pickup_at = pickupDate.toISOString();
  } else {
    const deliveryDate = params.deliveryAt instanceof Date ? params.deliveryAt : new Date(params.deliveryAt);
    payload.delivery_at = deliveryDate.toISOString();
    payload.delivery_address = params.deliveryAddress.trim();
    payload.delivery_phone = toCanadianPhoneE164(params.deliveryPhone) || params.deliveryPhone.trim();
  }

  console.log('Submitting checkout with payload:', {
    ...payload,
    items_count: params.items.length,
  });

  const { url } = await callFn<{ url: string }>('create-checkout', payload);
  if (!url) {
    throw new Error('Function did not return a checkout URL');
  }
  return url;
}
