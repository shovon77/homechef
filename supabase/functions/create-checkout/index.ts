// supabase/functions/create-checkout/index.ts
import { CreateCheckoutBody, TCreateCheckoutBody } from '../_shared/schemas.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';
import { resolveChefTimezoneId } from '../_shared/chef-timezone.ts';

// Platform service fee disabled (was $1.50 / 150 cents)
const PLATFORM_FEE_CENTS = 0;
// Platform commission: 10% of subtotal (food only)
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

function validateScheduledAtInChefTimezone(
  iso: string,
  chefTimezone: string | null | undefined,
  label: 'Pickup' | 'Delivery',
): { ok: true; iso: string } | { ok: false; error: string } {
  const scheduled = new Date(iso);
  if (Number.isNaN(scheduled.getTime())) {
    return { ok: false, error: `${label} time is invalid` };
  }
  const now = new Date();
  const max = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (scheduled.getTime() < now.getTime() || scheduled.getTime() > max.getTime()) {
    return { ok: false, error: `${label} must be within the next 7 days` };
  }
  const chefTz = resolveChefTimezoneId(chefTimezone);
  let localHour = NaN;
  try {
    localHour = Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: chefTz,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(scheduled),
    );
  } catch {
    localHour = Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(scheduled),
    );
  }
  if (!Number.isFinite(localHour) || localHour < 8 || localHour >= 20) {
    return { ok: false, error: `${label} time must be between 08:00 and 20:00` };
  }
  return { ok: true, iso: scheduled.toISOString() };
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
    const isDev = (Deno.env.get('APP_ENV') ?? '').toLowerCase() === 'development';
    const STRIPE_SECRET_KEY = isDev
      ? Deno.env.get('STRIPE_SECRET_TEST_KEY')
      : (Deno.env.get('STRIPE_SECRET_PROD_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY'));
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
      .select('id, status, timezone, fulfillment_mode, delivery_flat_fee')
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

    const chefFulfillment = String((chef as { fulfillment_mode?: string | null }).fulfillment_mode ?? 'pickup_only').trim();
    const allowsPickup = chefFulfillment === 'pickup_only' || chefFulfillment === 'pickup_and_delivery';
    const allowsDelivery = chefFulfillment === 'delivery_only' || chefFulfillment === 'pickup_and_delivery';

    if (body.fulfillment_method === 'pickup' && !allowsPickup) {
      return j(400, { error: 'This chef does not offer pickup' });
    }
    if (body.fulfillment_method === 'delivery' && !allowsDelivery) {
      return j(400, { error: 'This chef does not offer delivery' });
    }

    let pickupAtIso: string | null = null;
    let deliveryAtIso: string | null = null;
    let deliveryAddress: string | null = null;
    let deliveryPhone: string | null = null;
    const chefTimezone = (chef as { timezone?: string | null }).timezone;

    if (body.fulfillment_method === 'pickup') {
      const validated = validateScheduledAtInChefTimezone(body.pickup_at!, chefTimezone, 'Pickup');
      if (!validated.ok) return j(400, { error: validated.error });
      pickupAtIso = validated.iso;
    } else {
      deliveryAddress = (body.delivery_address ?? '').trim();
      deliveryPhone = (body.delivery_phone ?? '').trim();
      const validated = validateScheduledAtInChefTimezone(body.delivery_at!, chefTimezone, 'Delivery');
      if (!validated.ok) return j(400, { error: validated.error });
      deliveryAtIso = validated.iso;
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

    const platformFeeCents = PLATFORM_FEE_CENTS;

    const platformCommissionCents = Math.round(total_cents * PLATFORM_COMMISSION_RATE);

    // No tax charged on orders
    const taxCents = 0;

    let deliveryFeeCents = 0;
    if (body.fulfillment_method === 'delivery') {
      const flatFee = Number((chef as { delivery_flat_fee?: number | null }).delivery_flat_fee ?? 0);
      if (Number.isFinite(flatFee) && flatFee > 0) {
        deliveryFeeCents = Math.round(flatFee * 100);
      }
    }
    
    // Customer pays: subtotal + delivery fee (commission is NOT paid by customer; service fee currently 0)
    const grandTotalCents = total_cents + platformFeeCents + deliveryFeeCents;
    
    // Chef receives: food subtotal minus 10% commission + full delivery fee (no commission on delivery).
    // Stripe processing fees are deducted separately by Stripe.
    const chefAmountCents = total_cents - platformCommissionCents + deliveryFeeCents;

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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data: orderRow, error: orderError } = await adminClient
      .from('orders')
      .insert({
        user_id: user.id,
        chef_id: body.chef_id,
        status: 'requested',
        payment_status: 'awaiting_payment', // Order is created before payment
        total_cents: grandTotalCents, // Total customer pays: subtotal + delivery (commission deducted from chef)
        subtotal_cents: total_cents, // Subtotal (dish prices only)
        platform_commission_cents: platformCommissionCents, // 10% of subtotal
        platform_fee_cents: platformFeeCents, // Customer service fee (currently 0)
        tax_cents: 0, // No tax charged
        fulfillment_method: body.fulfillment_method,
        pickup_at: pickupAtIso,
        delivery_address: deliveryAddress,
        delivery_phone: deliveryPhone,
        delivery_at: deliveryAtIso,
        delivery_fee_cents: deliveryFeeCents,
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
        fulfillment_method: body.fulfillment_method,
        ...(pickupAtIso ? { pickup_at: pickupAtIso } : {}),
        ...(deliveryAtIso ? { delivery_at: deliveryAtIso } : {}),
      },
    };

    // Only add transfer data if we have a destination account
    // Customer pays: subtotal + delivery fee
    // Chef receives: subtotal - commission + delivery fee
    // Platform receives: commission (+ any service fee if re-enabled)
    if (stripeAccountId) {
      paymentIntentData.transfer_data = {
        destination: stripeAccountId,
        amount: chefAmountCents,
      };
      paymentIntentData.transfer_group = transferGroup;
      console.log('[create-checkout] Stripe transfer setup', {
        chefAmountCents,
        deliveryFeeCents,
        platformCommissionCents,
        platformFeeCents,
        grandTotalCents,
        platformTotal: grandTotalCents - chefAmountCents,
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
          // Platform commission is NOT charged to customer — deducted from chef's payout.
          // Service fee line only when PLATFORM_FEE_CENTS > 0.
          ...(platformFeeCents > 0
            ? [
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
              ]
            : []),
          ...(deliveryFeeCents > 0
            ? [
                {
                  price_data: {
                    currency: 'cad',
                    product_data: {
                      name: 'Delivery fee',
                    },
                    unit_amount: deliveryFeeCents,
                  },
                  quantity: 1,
                },
              ]
            : []),
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
