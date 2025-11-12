import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

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
  console.error(`[accept-order] ${message}`, detail);
  return json(status, { error: message });
}

Deno.serve(async (req) => {
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
    const token = authHeader.replace('Bearer ', '').trim();

    const body = await req.json().catch(() => null) as { orderId?: number } | null;
    if (!body?.orderId || !Number.isFinite(body.orderId)) {
      console.error('accept-order missing orderId', body);
      return json(400, { error: 'orderId is required' });
    }
    const orderId = Number(body.orderId);

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return errorResponse(401, 'Unauthorized', userError);
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, chef_id, total_cents, status, transfer_group, stripe_payment_intent_id, payment_intent_id, checkout_session_id, stripe_transfer_id, platform_fee_cents')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('[accept-order] order not found', { orderId, error: orderError });
      return errorResponse(404, 'Order not found', orderError);
    }

    if (order.status !== 'requested') {
      console.error('[accept-order] invalid status', { orderId, status: order.status });
      return errorResponse(400, `Order is not in a requested state (current: ${order.status})`);
    }

    // Get payment intent ID - check both fields
    let paymentIntentId = order.stripe_payment_intent_id || order.payment_intent_id || null;
    
    // If not found, try to get it from the checkout session
    if (!paymentIntentId && order.checkout_session_id) {
      try {
        console.log('[accept-order] retrieving payment intent from checkout session', { 
          orderId, 
          checkout_session_id: order.checkout_session_id 
        });
        const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
        paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        
        // If we found it, save it to the order for future use
        if (paymentIntentId) {
          await adminClient
            .from('orders')
            .update({ stripe_payment_intent_id: paymentIntentId })
            .eq('id', orderId);
          console.log('[accept-order] saved payment intent ID from session', { orderId, paymentIntentId });
        }
      } catch (err) {
        console.error('[accept-order] failed to retrieve checkout session', { 
          orderId, 
          checkout_session_id: order.checkout_session_id,
          error: err 
        });
      }
    }

    if (!paymentIntentId) {
      console.error('[accept-order] missing payment intent', { 
        orderId, 
        stripe_payment_intent_id: order.stripe_payment_intent_id,
        payment_intent_id: order.payment_intent_id,
        checkout_session_id: order.checkout_session_id,
        orderStatus: order.status,
      });
      return errorResponse(400, 'Order missing payment information. The payment may not have been completed. Please contact support.');
    }

    if (!order.transfer_group) {
      console.error('[accept-order] missing transfer_group', { orderId });
      return errorResponse(400, 'Order missing transfer group');
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, is_admin, charges_enabled, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    const email = profile?.email ?? user.email ?? undefined;
    const isAdmin = profile?.is_admin === true;

    const { data: chef, error: chefError } = await adminClient
      .from('chefs')
      .select('id, email')
      .eq('id', order.chef_id)
      .maybeSingle();

    if (chefError || !chef) {
      return errorResponse(404, 'Chef not found', chefError);
    }

    const isChefOwner = chef.email && email ? chef.email.toLowerCase() === email.toLowerCase() : false;
    if (!isChefOwner && !isAdmin) {
      return errorResponse(403, 'Forbidden');
    }

    // Get stripe_account_id from profiles table using chef's email
    let stripeAccountId: string | null = null;
    let chargesEnabled = false;
    if (chef.email) {
      const { data: chefProfile } = await adminClient
        .from('profiles')
        .select('stripe_account_id, charges_enabled')
        .eq('email', chef.email)
        .maybeSingle();
      stripeAccountId = chefProfile?.stripe_account_id ?? null;
      chargesEnabled = chefProfile?.charges_enabled === true;
    }

    if (!stripeAccountId) {
      return errorResponse(400, 'Please complete payouts onboarding first');
    }

    if (!chargesEnabled) {
      return errorResponse(400, 'Please complete payouts onboarding first');
    }

    // Check if already accepted (prevent double-accept)
    if (order.stripe_transfer_id) {
      return errorResponse(400, 'Order already accepted');
    }

    // With destination charges (application_fee_amount), the PaymentIntent was created with
    // transfer_data.destination, so capturing it will automatically transfer funds to the chef
    // and the platform fee is already collected as application_fee_amount
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    // Update order status to pending and record the capture
    // Note: With destination charges, the transfer happens automatically on capture
    // The platform fee was already collected as application_fee_amount during checkout
    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'pending',
        payment_status: paymentIntent.status ?? 'succeeded',
        stripe_transfer_id: paymentIntent.id, // Mark as accepted
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[accept-order] failed to update order', updateError);
      return errorResponse(500, 'Failed to update order status', updateError);
    }

    console.log('[accept-order] order accepted', {
      orderId,
      paymentIntentId: paymentIntent.id,
      chefAccountId: stripeAccountId,
      totalCents: order.total_cents,
      platformFeeCents: order.platform_fee_cents,
    });

    return json(200, { ok: true, paymentIntentId: paymentIntent.id });
  } catch (err) {
    console.error('accept-order error', err);
    return errorResponse(500, 'Internal Server Error', err);
  }
});
