// supabase/functions/create-checkout/index.ts
import { CreateCheckoutBody, TCreateCheckoutBody } from '../_shared/schemas.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const PLATFORM_FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? Deno.env.get('PLATFORM_FEE_PCT') ?? '0.10');
const PLATFORM_FEE_MIN = Number.isFinite(Number(Deno.env.get('PLATFORM_FEE_MIN'))) ? Number(Deno.env.get('PLATFORM_FEE_MIN')) : 50;
const PLATFORM_FEE_MAX = Number.isFinite(Number(Deno.env.get('PLATFORM_FEE_MAX'))) ? Number(Deno.env.get('PLATFORM_FEE_MAX')) : 1500;

// CORS headers - must match what the client sends
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Max-Age': '86400', // 24 hours
};

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

export const handler = async (req: Request) => {
  // Handle CORS preflight - must return early with headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return j(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return j(401, { error: 'Unauthorized' });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const { data: userResult, error: userError } = await adminClient.auth.getUser(accessToken);
    const user = userResult?.user ?? null;
    if (userError || !user) {
      console.error('[create-checkout] auth error', userError);
      return j(401, { error: 'Unauthorized' });
    }

    const raw = await req.json().catch((e) => {
      console.error('[create-checkout] JSON parse error:', e);
      return null;
    });
    if (!raw) return j(400, { error: 'Invalid JSON body' });

    const parsed = CreateCheckoutBody.safeParse(raw);
    if (!parsed.success) {
      console.error('[create-checkout] validation error:', parsed.error.flatten());
      return j(400, { error: 'Validation failed', details: parsed.error.flatten() });
    }
    const body: TCreateCheckoutBody = parsed.data;

    // Env guardrails (fail fast with readable messages)
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
    if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[create-checkout] Missing env', {
        hasStripe: !!STRIPE_SECRET_KEY,
        hasUrl: !!SUPABASE_URL,
        hasService: !!SERVICE_ROLE_KEY,
      });
      return j(500, { error: 'Missing required server environment variables' });
    }

    // 1) Ensure all items are from the same chef as body.chef_id
    // Query dishes once to validate ownership and get price data
    const dishIds = body.items.map((i) => i.dish_id);
    const { data: dishes, error: dishErr } = await adminClient
      .from('dishes')
      .select('id, chef_id, price, name')
      .in('id', dishIds);

    if (dishErr) {
      console.error('[create-checkout] Dish query failed:', dishErr);
      return j(500, { error: 'Failed to fetch dishes' });
    }
    if (!dishes || dishes.length !== dishIds.length) {
      return j(400, { error: 'One or more dishes not found' });
    }

    const uniqueChefs = new Set(dishes.map((d) => d.chef_id));
    if (uniqueChefs.size !== 1 || !uniqueChefs.has(body.chef_id)) {
      return j(400, { error: 'All items must belong to the selected chef' });
    }

    // 2) Validate pickup window: within next 7 days, between 08:00 and 20:00 (local)
    const pickupDate = new Date(body.pickup_at);
    const now = new Date();
    const max = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (pickupDate < now || pickupDate > max) {
      return j(400, { error: 'Pickup must be within the next 7 days' });
    }
    const hour = pickupDate.getHours();
    if (hour < 8 || hour >= 20) {
      return j(400, { error: 'Pickup time must be between 08:00 and 20:00' });
    }

    // 3) Compute totals (assume `price` is numeric in DB)
    const lineItems = body.items.map((i) => {
      const d = dishes.find((x) => x.id === i.dish_id)!;
      const priceNumber = Number(d.price ?? 0);
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        throw new Error(`Dish ${d.id} has invalid price`);
      }
      const unit_cents = Math.round(priceNumber * 100);
      return {
        dish_id: d.id,
        name: d.name,
        quantity: i.quantity,
        unit_cents,
        subtotal_cents: unit_cents * i.quantity,
      };
    });
    const total_cents = lineItems.reduce((s, li) => s + li.subtotal_cents, 0);

    if (!Number.isFinite(total_cents) || total_cents <= 0) {
      return j(400, { error: 'Order total must be greater than zero' });
    }

    const platformFeeCents = (() => {
      const pctConfig = Number.isFinite(PLATFORM_FEE_PERCENT) ? PLATFORM_FEE_PERCENT : 0;
      const normalizedPct = pctConfig > 1 ? pctConfig / 100 : pctConfig;
      const raw = Math.round(total_cents * normalizedPct);
      const clampedMin = Number.isFinite(PLATFORM_FEE_MIN) ? PLATFORM_FEE_MIN : 0;
      const clampedMax = Number.isFinite(PLATFORM_FEE_MAX) ? PLATFORM_FEE_MAX : raw;
      const fee = Math.min(clampedMax, Math.max(clampedMin, raw));
      return Math.max(0, Math.min(fee, total_cents));
    })();

    const { data: chefRow, error: chefError } = await adminClient
      .from('chefs')
      .select('id, email')
      .eq('id', body.chef_id)
      .maybeSingle();

    if (chefError || !chefRow) {
      console.error('[create-checkout] chef lookup failed', { chefId: body.chef_id, error: chefError });
      return j(404, { error: 'Chef not found' });
    }

    // Get stripe_account_id from profiles table using chef's email
    let stripeAccountId: string | null = null;
    if (chefRow.email) {
      const { data: profileRow } = await adminClient
        .from('profiles')
        .select('stripe_account_id, charges_enabled')
        .eq('email', chefRow.email)
        .maybeSingle();
      stripeAccountId = profileRow?.stripe_account_id ?? null;
    }

    if (!stripeAccountId) {
      console.warn('[create-checkout] chef missing stripe account', { chefId: body.chef_id, email: chefRow.email });
      return j(409, { error: 'Chef payouts are not configured yet', code: 'CHEF_NOT_ONBOARDED' });
    }

    // 4) Create (or upsert) an order row in 'orders' with status 'requested'
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .insert({
        user_id: user.id,
        chef_id: body.chef_id,
        status: 'requested',
        total_cents: total_cents,
        platform_fee_cents: platformFeeCents,
        pickup_at: pickupDate.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_status: 'requires_payment_method',
      })
      .select('id')
      .single();

    if (orderError || !orderRow) {
      console.error('[create-checkout] order insert failed', orderError);
      return j(500, { error: 'Failed to create order' });
    }

    const orderId = Number(orderRow.id);
    const transferGroup = `order_${orderId}`;

    const orderItemsPayload = lineItems.map((item) => ({
      order_id: orderId,
      dish_id: item.dish_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_cents,
    }));

    const { error: orderItemsError } = await adminClient.from('order_items').insert(orderItemsPayload);

    if (orderItemsError) {
      console.error('[create-checkout] order_items insert failed', orderItemsError);
      await adminClient.from('orders').delete().eq('id', orderId);
      return j(500, { error: 'Failed to create order items' });
    }

    // 5) Create Stripe Checkout session
    const resolveUrl = (template: string) => template.replace(/\{ORDER_ID\}/g, String(orderId));

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        payment_intent_data: {
          capture_method: 'manual',
          application_fee_amount: platformFeeCents,
          transfer_data: {
            destination: stripeAccountId,
          },
          transfer_group: transferGroup,
          metadata: {
            order_id: String(orderId),
            user_id: user.id,
            chef_id: String(body.chef_id),
            pickup_at: pickupDate.toISOString(),
          },
        },
        customer_creation: 'if_required',
        client_reference_id: String(orderId),
        line_items: lineItems.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name || 'Dish',
            },
            unit_amount: item.unit_cents,
          },
          quantity: item.quantity,
        })),
        success_url: resolveUrl(body.success_url),
        cancel_url: resolveUrl(body.cancel_url),
        metadata: {
          order_id: String(orderId),
          chef_id: String(body.chef_id),
          user_id: user.id,
        },
      },
      { idempotencyKey: `order-session-${orderId}` },
    );

    // Store checkout session ID and payment intent ID if available
    const updateData: Record<string, unknown> = {
      checkout_session_id: session.id,
      transfer_group: transferGroup,
    };
    
    // Store payment intent ID if available (it might be a string or an object)
    if (session.payment_intent) {
      const paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : (session.payment_intent as any)?.id || null;
      if (paymentIntentId) {
        updateData.stripe_payment_intent_id = paymentIntentId;
      }
    }

    await adminClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    console.log('[create-checkout] session created', {
      orderId,
      sessionId: session.id,
      paymentIntent: session.payment_intent,
      paymentIntentId: updateData.stripe_payment_intent_id || 'not available yet',
      applicationFeeCents: platformFeeCents,
      transferDestination: stripeAccountId,
      captureMethod: 'manual',
    });

    return j(200, { url: session.url });
  } catch (e) {
    console.error('[create-checkout] unhandled error:', e);
    return j(500, { error: 'Unexpected error', message: String((e as any)?.message || e) });
  }
};

Deno.serve(handler);
