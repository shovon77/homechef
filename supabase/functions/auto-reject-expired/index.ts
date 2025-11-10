import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

serve(async (_req) => {
  try {
    const nowIso = new Date().toISOString();
    const { data: orders, error } = await adminClient
      .from('orders')
      .select('id, payment_intent_id')
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
        if (order.payment_intent_id) {
          await stripe.paymentIntents.cancel(order.payment_intent_id).catch((err) => {
            console.warn('stripe cancel failed', err);
          });
        }
        await adminClient
          .from('orders')
          .update({ status: 'rejected', payment_status: 'canceled' })
          .eq('id', order.id);
        rejected += 1;
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
