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
  console.error(`[cancel-payment] ${message}`, detail);
  return json(status, { error: message });
}

type CancelReason = 'chef_rejected' | 'expired' | 'user_cancelled';

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

    const body = await req.json().catch(() => null) as { orderId?: number; reason?: CancelReason } | null;
    if (!body?.orderId || !Number.isFinite(body.orderId)) {
      return errorResponse(400, 'orderId is required');
    }
    const reason: CancelReason = body.reason ?? 'chef_rejected';

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return errorResponse(401, 'Unauthorized', userError);
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, chef_id, payment_intent_id, payment_status, stripe_payment_intent_id')
      .eq('id', body.orderId)
      .maybeSingle();
    if (orderError || !order) {
      return errorResponse(404, 'Order not found', orderError);
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, is_admin')
      .eq('id', user.id)
      .maybeSingle();

    const email = profile?.email ?? user.email ?? undefined;
    const isAdmin = profile?.is_admin === true;

    const { data: chef } = await adminClient
      .from('chefs')
      .select('id, email')
      .eq('id', order.chef_id)
      .maybeSingle();

    const isChefOwner = chef?.email && email ? chef.email === email : false;

    if (!isAdmin && !isChefOwner && reason !== 'user_cancelled') {
      return errorResponse(403, 'Forbidden');
    }

    const paymentIntentId = order.stripe_payment_intent_id ?? order.payment_intent_id;

    if (!paymentIntentId) {
      return errorResponse(400, 'Order missing payment intent');
    }

    try {
      if (reason === 'user_cancelled') {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } else {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
      }
    } catch (err) {
      return errorResponse(500, 'Failed to refund payment – please retry', err);
    }

    const status = reason === 'user_cancelled' ? 'cancelled' : 'rejected';

    await adminClient
      .from('orders')
      .update({ status, payment_status: 'canceled' })
      .eq('id', order.id);

    return json(200, { ok: true });
  } catch (err) {
    return errorResponse(500, 'Internal Server Error', err);
  }
});
