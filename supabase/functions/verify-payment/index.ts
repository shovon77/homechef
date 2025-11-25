// supabase/functions/verify-payment/index.ts
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Max-Age': '86400', // 24 hours
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const { data: userResult, error: userError } = await adminClient.auth.getUser(accessToken);
    const user = userResult?.user ?? null;
    if (userError || !user) {
      return json(401, { error: 'Unauthorized' });
    }

    const body = await req.json().catch(() => null) as { orderId?: number } | null;
    if (!body?.orderId || !Number.isFinite(body.orderId)) {
      return json(400, { error: 'orderId is required' });
    }

    const orderId = Number(body.orderId);

    // Get order with payment info
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, stripe_payment_intent_id, checkout_session_id, payment_status, payment_intent_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order not found', { orderId, error: orderError });
      return json(404, { error: 'Order not found' });
    }

    let paymentSucceeded = false;
    let paymentIntentId: string | null = order.stripe_payment_intent_id || order.payment_intent_id || null;
    let sessionPaymentStatus: string | null = null;
    let needsPaymentIntentUpdate = false;

    // If we have a checkout session, check it first (especially if payment intent ID is missing)
    if (order.checkout_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
        sessionPaymentStatus = session.payment_status;
        
        // Get payment intent from session if we don't have it stored
        if (!paymentIntentId) {
          if (typeof session.payment_intent === 'string') {
            paymentIntentId = session.payment_intent;
            needsPaymentIntentUpdate = true;
            console.log('Retrieved payment intent from checkout session', { orderId, paymentIntentId });
          } else if (session.payment_intent && typeof session.payment_intent === 'object') {
            paymentIntentId = (session.payment_intent as any)?.id || null;
            if (paymentIntentId) {
              needsPaymentIntentUpdate = true;
              console.log('Retrieved payment intent from checkout session object', { orderId, paymentIntentId });
            }
          }
        }
        
        // Check session payment status - this is a reliable indicator
        if (session.payment_status === 'paid') {
          paymentSucceeded = true;
          console.log('Payment confirmed via checkout session', { 
            orderId, 
            sessionId: order.checkout_session_id,
            paymentStatus: session.payment_status
          });
        } else {
          console.log('Checkout session payment not paid', { 
            orderId, 
            sessionId: order.checkout_session_id,
            paymentStatus: session.payment_status
          });
        }
      } catch (e) {
        console.error('Error retrieving checkout session', { orderId, error: e });
      }
    }

    // Verify payment intent status (this is the most reliable check)
    if (paymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        // Handle manual capture mode - if payment requires capture, capture it
        if (intent.status === 'requires_capture') {
          try {
            await stripe.paymentIntents.capture(paymentIntentId);
            paymentSucceeded = true;
            console.log('Payment captured and confirmed', { orderId, paymentIntentId });
          } catch (captureError: any) {
            console.error('Error capturing payment intent', { orderId, paymentIntentId, error: captureError });
            // If capture fails, check if it's already succeeded
            const updatedIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (updatedIntent.status === 'succeeded') {
              paymentSucceeded = true;
              console.log('Payment already succeeded after capture attempt', { orderId, paymentIntentId });
            }
          }
        } else if (intent.status === 'succeeded') {
          paymentSucceeded = true;
          console.log('Payment confirmed via payment intent', { orderId, paymentIntentId, status: intent.status });
        } else {
          console.log('Payment intent not succeeded', { orderId, paymentIntentId, status: intent.status });
        }
      } catch (e) {
        console.error('Error retrieving payment intent', { orderId, paymentIntentId, error: e });
      }
    }

    // Update order if payment was successful OR if we found a payment intent that needs to be stored
    const updates: Record<string, unknown> = {};
    
    // Always store payment intent ID if we found it and it's not stored
    if (paymentIntentId && needsPaymentIntentUpdate && !order.stripe_payment_intent_id) {
      updates.stripe_payment_intent_id = paymentIntentId;
    }
    
    // Update payment status if payment was successful
    if (paymentSucceeded && order.payment_status !== 'succeeded') {
      updates.payment_status = 'succeeded';
      updates.status = 'requested';
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminClient.from('orders').update(updates).eq('id', orderId);
      if (updateError) {
        console.error('Error updating order', { orderId, error: updateError });
        return json(500, { error: 'Failed to update order', details: updateError });
      }
      console.log('Order updated', { 
        orderId, 
        paymentIntentId, 
        previousStatus: order.payment_status,
        updates,
        paymentSucceeded
      });
    } else if (!paymentSucceeded) {
      console.log('Payment not verified as successful', { 
        orderId, 
        paymentStatus: order.payment_status,
        hasPaymentIntent: !!paymentIntentId,
        hasCheckoutSession: !!order.checkout_session_id,
        sessionPaymentStatus,
      });
    }

    return json(200, {
      orderId,
      paymentSucceeded,
      paymentStatus: paymentSucceeded ? 'succeeded' : order.payment_status,
      updated: (paymentSucceeded && order.payment_status !== 'succeeded') || needsPaymentIntentUpdate,
      paymentIntentId: paymentIntentId || null,
      sessionPaymentStatus,
    });
  } catch (err) {
    console.error('verify-payment error', err);
    return json(500, { error: 'Internal server error' });
  }
});

