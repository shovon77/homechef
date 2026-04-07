import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

serve(async (_req) => {
  try {
    const nowIso = new Date().toISOString();
    const { data: orders, error } = await adminClient
      .from('orders')
      .select('id, user_id, payment_intent_id, stripe_payment_intent_id')
      .eq('status', 'requested')
      .lt('expires_at', nowIso);

    if (error || !orders?.length) {
      return new Response(JSON.stringify({ checked: 0, rejected: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rejected = 0;
    for (const order of orders) {
      try {
        const piId = order.stripe_payment_intent_id ?? order.payment_intent_id;
        if (piId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId);
            if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
              // Payment was captured — issue a full refund
              if (pi.status === 'requires_capture') {
                await stripe.paymentIntents.cancel(piId);
              } else {
                await stripe.refunds.create({ payment_intent: piId });
              }
            } else if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation' || pi.status === 'requires_action' || pi.status === 'processing') {
              await stripe.paymentIntents.cancel(piId);
            }
            // If already canceled/refunded, nothing to do
          } catch (stripeErr) {
            console.warn('[auto-reject-expired] stripe refund/cancel failed', order.id, stripeErr);
          }
        }
        await adminClient
          .from('orders')
          .update({ status: 'rejected', payment_status: 'canceled' })
          .eq('id', order.id);
        rejected += 1;

        // Notify user that their order expired and refund will be processed
        const userId = order.user_id;
        if (userId) {
          const orderNum = String(order.id).padStart(5, '0');
          await adminClient.rpc('create_notification_for_user', {
            p_user_id: userId,
            p_type: 'order_rejected',
            p_title: 'Order Expired',
            p_message: `Your order #${orderNum} has expired. Your refund will be processed immediately.`,
            p_related_id: order.id,
            p_related_type: 'order',
          }).catch((err) => console.warn('[auto-reject-expired] notification error', order.id, err));
        }
      } catch (err) {
        console.error('auto reject error', err);
      }
    }

    return new Response(JSON.stringify({ checked: orders.length, rejected }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('auto-reject-expired error', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
