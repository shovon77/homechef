import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
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
      .select('id, chef_id, total_cents, status, transfer_group, stripe_payment_intent_id, stripe_transfer_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('accept-order order not found', { orderId });
      return errorResponse(404, 'Order not found', orderError);
    }

    if (order.status !== 'requested') {
      console.error('accept-order invalid status', { orderId, status: order.status });
      return errorResponse(400, 'Order is not in a requested state');
    }

    if (order.stripe_transfer_id) {
      console.error('accept-order already transferred', { orderId, stripe_transfer_id: order.stripe_transfer_id });
      return errorResponse(400, 'Order has already been accepted');
    }

    if (!order.transfer_group || !order.stripe_payment_intent_id) {
      console.error('accept-order missing payment info', { orderId });
      return errorResponse(400, 'Order missing payment information');
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
      .select('id, email, stripe_account_id')
      .eq('id', order.chef_id)
      .maybeSingle();

    if (chefError || !chef) {
      return json(404, { error: 'Chef not found' });
    }

    const isChefOwner = chef.email && email ? chef.email.toLowerCase() === email.toLowerCase() : false;
    if (!isChefOwner && !isAdmin) {
      return errorResponse(403, 'Forbidden');
    }

    const stripeAccountId = profile?.stripe_account_id ?? chef.stripe_account_id ?? null;

    if (!stripeAccountId) {
      return errorResponse(400, 'Please complete payouts onboarding first');
    }

    if (profile?.charges_enabled === false) {
      return errorResponse(400, 'Please complete payouts onboarding first');
    }

    const platformFeePercent = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '10');
    const platformFeeCents = Math.round(order.total_cents * platformFeePercent / 100);
    const transferAmount = order.total_cents - platformFeeCents;

    if (transferAmount <= 0) {
      return errorResponse(400, 'Transfer amount must be positive');
    }

    const transfer = await stripe.transfers.create({
      amount: transferAmount,
      currency: 'usd',
      destination: stripeAccountId,
      transfer_group: order.transfer_group,
    });

    await adminClient
      .from('orders')
      .update({
        status: 'pending',
        platform_fee_cents: platformFeeCents,
        stripe_transfer_id: transfer.id,
      })
      .eq('id', orderId);

    return json(200, { ok: true, transferId: transfer.id });
  } catch (err) {
    console.error('accept-order error', err);
    return errorResponse(500, 'Internal Server Error', err);
  }
});
