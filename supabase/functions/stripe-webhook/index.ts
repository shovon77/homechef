import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12?target=deno';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

function respond(status: number, body: string) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

serve(async (req) => {
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return respond(500, 'Server misconfigured');
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return respond(400, 'Missing signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return respond(400, 'Invalid signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderIdRaw = session.client_reference_id ?? session.metadata?.order_id;
        if (!orderIdRaw) {
          console.warn('checkout.session.completed missing order id');
          break;
        }
        const orderId = Number(orderIdRaw);
        if (!Number.isFinite(orderId)) {
          console.warn('checkout.session.completed invalid order id', orderIdRaw);
          break;
        }

        let paymentIntentId: string | null = null;
        let transferGroup: string | null = null;

        if (typeof session.payment_intent === 'string') {
          paymentIntentId = session.payment_intent;
          const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
          transferGroup = intent.transfer_group ?? null;
        }

        const updates: Record<string, unknown> = {
          payment_status: 'succeeded',
        };
        if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;
        if (transferGroup) updates.transfer_group = transferGroup;

        await adminClient.from('orders').update(updates).eq('id', orderId);
        break;
      }
      case 'account.created':
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account?.id) {
          if (account.metadata?.app_user_id) {
            await adminClient
              .from('profiles')
              .update({ stripe_account_id: account.id })
              .eq('id', account.metadata.app_user_id);
          }

          await adminClient
            .from('profiles')
            .update({ charges_enabled: account.charges_enabled ?? false })
            .eq('stripe_account_id', account.id);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await adminClient
          .from('orders')
          .update({ payment_status: 'succeeded' })
          .or(`stripe_payment_intent_id.eq.${pi.id},payment_intent_id.eq.${pi.id}`);
        break;
      }
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await adminClient
          .from('orders')
          .update({ payment_status: 'canceled' })
          .or(`stripe_payment_intent_id.eq.${pi.id},payment_intent_id.eq.${pi.id}`);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await adminClient
          .from('orders')
          .update({ payment_status: 'failed' })
          .or(`stripe_payment_intent_id.eq.${pi.id},payment_intent_id.eq.${pi.id}`);
        break;
      }
      default:
        console.log('Unhandled event type', event.type);
    }
  } catch (err) {
    console.error('Error processing webhook event', err);
    return respond(500, 'Webhook handler error');
  }

  return respond(200, 'ok');
});
