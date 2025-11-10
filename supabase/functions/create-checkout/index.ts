import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const DEFAULT_ORIGIN = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:8081';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(status: number, message: string, detail?: unknown) {
  console.error(`[create-checkout] ${message}`, detail);
  return json(status, { error: message });
}

interface CartItemInput {
  dishId: number;
  quantity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Unauthorized');
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);
    if (userError || !user) {
      return errorResponse(401, 'Unauthorized');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.pickupAtISO !== 'string') {
      return errorResponse(400, 'pickupAtISO is required');
    }

    const pickupAt = new Date(body.pickupAtISO);
    if (Number.isNaN(pickupAt.getTime())) {
      return errorResponse(400, 'Invalid pickupAtISO');
    }

    const now = new Date();
    const max = new Date();
    max.setDate(max.getDate() + 7);
    const hour = pickupAt.getHours();
    if (pickupAt < now || pickupAt > max || hour < 8 || hour >= 20) {
      return errorResponse(400, 'Pickup time must be within the next 7 days between 08:00 and 20:00');
    }

    const items: CartItemInput[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return errorResponse(400, 'Cart is empty');
    }

    if (!items.every((item) => Number.isInteger(item.dishId) && Number.isInteger(item.quantity) && item.quantity > 0)) {
      return errorResponse(400, 'Invalid cart items');
    }

    const dishIds = [...new Set(items.map((item) => item.dishId))];
    const { data: dishes, error: dishesError } = await adminClient
      .from('dishes')
      .select('id, name, price, chef_id')
      .in('id', dishIds);
    if (dishesError || !dishes?.length) {
      return errorResponse(500, 'Unable to load dishes');
    }

    const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
    const firstDish = dishMap.get(items[0].dishId);
    if (!firstDish?.chef_id) {
      return errorResponse(400, 'Invalid chef for order');
    }

    const chefId = firstDish.chef_id;
    for (const item of items) {
      const dish = dishMap.get(item.dishId);
      if (!dish) {
        return errorResponse(400, `Dish ${item.dishId} not found`);
      }
      if (dish.chef_id !== chefId) {
        return errorResponse(400, 'Only one chef per order is allowed');
      }
    }

    const orderItemsPayload = items.map((item) => {
      const dish = dishMap.get(item.dishId)!;
      const unitPriceCents = Math.round(Number(dish.price ?? 0) * 100);
      return {
        dish_id: dish.id,
        quantity: item.quantity,
        unit_price_cents: unitPriceCents,
      };
    });

    const subtotal = orderItemsPayload.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return errorResponse(400, 'Order total must be greater than zero');
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .insert({
        user_id: user.id,
        chef_id: chefId,
        status: 'requested',
        total_cents: subtotal,
        pickup_at: pickupAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_status: 'requires_payment_method',
      })
      .select('id')
      .single();

    if (orderError || !orderRow) {
      return errorResponse(500, 'Failed to create order', orderError);
    }

    const orderId: number = orderRow.id;
    const transferGroup = `order_${orderId}`;

    const { error: orderItemsError } = await adminClient
      .from('order_items')
      .insert(orderItemsPayload.map((item) => ({ ...item, order_id: orderId })));
    if (orderItemsError) {
      await adminClient.from('orders').delete().eq('id', orderId);
      return errorResponse(500, 'Failed to create order items', orderItemsError);
    }

    const origin = req.headers.get('origin') ?? DEFAULT_ORIGIN;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      payment_intent_data: {
        capture_method: 'manual',
        transfer_group: transferGroup,
        metadata: {
          order_id: String(orderId),
          user_id: user.id,
        },
      },
      customer_creation: 'if_required',
      client_reference_id: String(orderId),
      line_items: orderItemsPayload.map((item) => {
        const dish = dishMap.get(item.dish_id)!;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: dish.name || 'Dish',
            },
            unit_amount: item.unit_price_cents,
          },
          quantity: item.quantity,
        };
      }),
      success_url: `${origin}/order/success?orderId=${orderId}`,
      cancel_url: `${origin}/order/cancel?orderId=${orderId}`,
      metadata: {
        order_id: String(orderId),
      },
    });

    await adminClient
      .from('orders')
      .update({
        checkout_session_id: session.id,
        transfer_group: transferGroup,
      })
      .eq('id', orderId);

    return json(200, { url: session.url });
  } catch (err) {
    return errorResponse(500, 'Internal Server Error', err);
  }
});
