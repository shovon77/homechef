import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12?target=deno';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

// Legacy fallback: chefs should use accept-order (transfer-based flow).
// This endpoint remains for recovery flows where a manual capture is still required.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(status: number, message: string, detail?: unknown) {
  console.error(`[capture-payment] ${message}`, detail);
  return json(status, { error: message });
}

async function allowCapture(userId: string, chefId: number | null): Promise<boolean> {
  if (!chefId) return false;

  const { data: profile } = await adminClient
    .from('profiles')
    .select('email, is_admin')
    .eq('id', userId)
    .maybeSingle();

  const email = profile?.email;
  if (profile?.is_admin) return true;

  if (!email) return false;

  const { data: chef } = await adminClient
    .from('chefs')
    .select('email')
    .eq('id', chefId)
    .maybeSingle();

  if (!chef?.email) return false;

  return chef.email.toLowerCase() === email.toLowerCase();
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

    const body = await req.json().catch(() => null) as { orderId?: number } | null;
    if (!body?.orderId || !Number.isFinite(body.orderId)) {
      return errorResponse(400, 'orderId is required');
    }
    const orderId = Number(body.orderId);

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);
    if (userError || !user) {
      return errorResponse(401, 'Unauthorized', userError);
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, chef_id, payment_intent_id, checkout_session_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError || !order) {
      return errorResponse(404, 'Order not found', orderError);
    }
    let paymentIntentId = order.payment_intent_id;
    if (!paymentIntentId && order.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id).catch(() => null);
      const pi = session?.payment_intent;
      if (typeof pi === 'string') {
        paymentIntentId = pi;
        await adminClient
          .from('orders')
          .update({ payment_intent_id: paymentIntentId })
          .eq('id', orderId);
      }
    }

    if (!paymentIntentId) {
      return errorResponse(400, 'Payment intent not ready yet');
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    if (!intent) {
      return errorResponse(400, 'Payment intent not found');
    }

    if (intent.status === 'requires_capture') {
      await stripe.paymentIntents.capture(intent.id);
    } else if (intent.status !== 'succeeded') {
      return errorResponse(400, `Cannot capture intent with status ${intent.status}`);
    }

    await adminClient
      .from('orders')
      .update({ status: 'pending', payment_status: 'succeeded', payment_intent_id: intent.id })
      .eq('id', orderId);

    return json(200, { ok: true });
  } catch (err) {
    return errorResponse(500, 'Internal Server Error', err);
  }
});
