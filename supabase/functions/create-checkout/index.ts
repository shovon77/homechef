// supabase/functions/create-checkout/index.ts
import { CreateCheckoutBody, TCreateCheckoutBody } from '../_shared/schemas.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

// Flat platform service fee: $1.50 (150 cents)
const PLATFORM_FEE_CENTS = 150;
// Platform commission: 10% of subtotal
const PLATFORM_COMMISSION_RATE = 0.10;
// Tax is no longer charged (previously 13% HST)

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
      const flattened = parsed.error.flatten();
      const fieldErrors = parsed.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      console.error('[create-checkout] validation error:', JSON.stringify(flattened, null, 2));
      console.error('[create-checkout] field errors:', JSON.stringify(fieldErrors, null, 2));
      console.error('[create-checkout] received data:', JSON.stringify(raw, null, 2));
      return j(400, { 
        error: 'Validation failed', 
        message: 'Invalid request data. Please check your input.',
        details: flattened,
        fieldErrors: fieldErrors,
        received: raw, // Include received data for debugging
      });
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
      .select('id, chef_id, price, name, is_active')
      .in('id', dishIds)
      .or('is_active.eq.true,is_active.is.null');

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

    // Check if chef is suspended
    const { data: chef, error: chefErr } = await adminClient
      .from('chefs')
      .select('id, status')
      .eq('id', body.chef_id)
      .maybeSingle();

    if (chefErr) {
      console.error('[create-checkout] Chef query failed:', chefErr);
      return j(500, { error: 'Failed to verify chef status' });
    }

    if (!chef) {
      return j(400, { error: 'Chef not found' });
    }

    if (chef.status === 'suspended') {
      return j(400, { error: 'This chef is currently suspended and cannot accept orders' });
    }
    if (chef.status === 'paused') {
      return j(400, { error: 'This chef has paused their listings and cannot accept orders right now' });
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
        notes: i.notes,
      };
    });
    const total_cents = lineItems.reduce((s, li) => s + li.subtotal_cents, 0);

    if (!Number.isFinite(total_cents) || total_cents <= 0) {
      return j(400, { error: 'Order total must be greater than zero' });
    }

    // Flat platform service fee: $1.50
    const platformFeeCents = PLATFORM_FEE_CENTS;

    // Calculate 10% platform commission on subtotal
    const platformCommissionCents = Math.round(total_cents * PLATFORM_COMMISSION_RATE);

    // No tax charged on orders
    const taxCents = 0;
    
    // Customer pays: subtotal + platform service fee (commission is NOT paid by customer)
    const grandTotalCents = total_cents + platformFeeCents;
    
    // Amount chef receives: subtotal minus platform commission
    // (Stripe processing fees are deducted separately by Stripe)
    const chefAmountCents = total_cents - platformCommissionCents;

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

    // If chef is not onboarded, we proceed without transfers (platform collects all)
    // This allows testing checkout without full Stripe Connect setup
    if (!stripeAccountId) {
      console.warn('[create-checkout] chef missing stripe account - collecting to platform', { chefId: body.chef_id });
    }

    // 4) Create (or upsert) an order row in 'orders' with status 'requested'
    // We use 'requested' because it is a valid status in the DB constraint.
    // We will hide unpaid orders from the chef dashboard using payment_status.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .insert({
        user_id: user.id,
        chef_id: body.chef_id,
        status: 'requested',
        payment_status: 'awaiting_payment', // Order is created before payment
        total_cents: grandTotalCents, // Total customer pays: subtotal + service fee (commission deducted from chef)
        subtotal_cents: total_cents, // Subtotal (dish prices only)
        platform_commission_cents: platformCommissionCents, // 10% of subtotal
        platform_fee_cents: platformFeeCents, // Flat $1.50 service fee
        tax_cents: 0, // No tax charged
        pickup_at: pickupDate.toISOString(),
        expires_at: expiresAt.toISOString(),
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
      notes: item.notes,
    }));

    const { error: orderItemsError } = await adminClient.from('order_items').insert(orderItemsPayload);

    if (orderItemsError) {
      console.error('[create-checkout] order_items insert failed', orderItemsError);
      await adminClient.from('orders').delete().eq('id', orderId);
      return j(500, { error: 'Failed to create order items' });
    }

    // 5) Create Stripe Checkout session
    const resolveUrl = (template: string) => template.replace(/\{ORDER_ID\}/g, String(orderId));

    const paymentIntentData: any = {
      // Use automatic capture for immediate payment processing
      // Manual capture is typically used for delayed fulfillment scenarios
      capture_method: 'automatic',
      metadata: {
        order_id: String(orderId),
        user_id: user.id,
        chef_id: String(body.chef_id),
        pickup_at: pickupDate.toISOString(),
      },
    };

    // Only add transfer data if we have a destination account
    // Customer pays: subtotal + service fee + tax
    // Chef receives: subtotal - commission (commission is deducted from chef's payout)
    // Platform receives: commission + service fee + tax (automatically calculated as grandTotalCents - chefAmountCents)
    if (stripeAccountId) {
      // Use transfer_data.amount to specify exactly what chef receives
      // Platform automatically gets the difference: grandTotalCents - chefAmountCents
      // Note: Cannot use both application_fee_amount and transfer_data.amount (they are mutually exclusive)
      paymentIntentData.transfer_data = {
        destination: stripeAccountId,
        amount: chefAmountCents, // Chef receives subtotal minus commission
      };
      paymentIntentData.transfer_group = transferGroup;
      console.log('[create-checkout] Stripe transfer setup', {
        chefAmountCents, // What chef receives (subtotal - commission)
        platformCommissionCents, // Commission deducted from chef
        platformFeeCents, // Service fee
        grandTotalCents, // Total customer pays (subtotal + service fee)
        platformTotal: grandTotalCents - chefAmountCents, // Total platform receives (commission + service fee)
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        payment_intent_data: paymentIntentData,
        customer_creation: 'if_required',
        client_reference_id: String(orderId),
        line_items: [
          // Dish items
          ...lineItems.map((item) => ({
            price_data: {
              currency: 'cad',
              product_data: {
                name: item.name || 'Dish',
              },
              unit_amount: item.unit_cents,
            },
            quantity: item.quantity,
          })),
          // Platform service fee
          // Note: Platform commission is NOT charged to customer - it's deducted from chef's payout
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: 'Service Fee',
              },
              unit_amount: platformFeeCents,
            },
            quantity: 1,
          },
        ],
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
      subtotalCents: total_cents,
      platformCommissionCents,
      platformFeeCents,
      taxCents,
      grandTotalCents,
      chefAmountCents: stripeAccountId ? chefAmountCents : null, // Only relevant if chef has Stripe account
      transferDestination: stripeAccountId,
      captureMethod: 'automatic',
    });

    return j(200, { url: session.url });
  } catch (e) {
    console.error('[create-checkout] unhandled error:', e);
    return j(500, { error: 'Unexpected error', message: String((e as any)?.message || e) });
  }
};

Deno.serve(handler);
