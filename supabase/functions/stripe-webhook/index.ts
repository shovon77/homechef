import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12?target=deno&deno-std=0.224.0';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const webhookSecret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim();
// Required for Deno: Web Crypto API differs from Node.js
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function respond(status: number, body: string) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

/** Create new order request notification for the chef when payment succeeds. Idempotent. */
async function notifyChefOfNewOrder(orderId: number): Promise<void> {
  console.log('[stripe-webhook] notifyChefOfNewOrder called', { orderId });
  try {
    const { data: existing } = await adminClient
      .from('notifications')
      .select('id')
      .eq('related_id', orderId)
      .eq('related_type', 'order')
      .eq('type', 'new_order_request')
      .maybeSingle();
    if (existing) {
      return; // Already notified (e.g. from checkout.session.completed and payment_intent.succeeded)
    }
    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('chef_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr || !order?.chef_id) {
      console.warn('[stripe-webhook] Could not fetch order for chef notification', { orderId, error: orderErr });
      return;
    }
    const { data: chef, error: chefErr } = await adminClient
      .from('chefs')
      .select('user_id, email')
      .eq('id', order.chef_id)
      .maybeSingle();
    if (chefErr || !chef) {
      console.warn('[stripe-webhook] Could not fetch chef for notification', { chefId: order.chef_id, error: chefErr });
      return;
    }
    let chefUserId: string | null = chef.user_id ?? null;
    if (!chefUserId && chef.email) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .ilike('email', chef.email)
        .maybeSingle();
      chefUserId = profile?.id ?? null;
    }
    if (!chefUserId && chef.email) {
      // Fallback: resolve via auth.users (admin API)
      try {
        const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const match = users?.find((u: { email?: string }) =>
          u.email?.toLowerCase() === chef.email?.toLowerCase()
        );
        if (match?.id) chefUserId = match.id;
      } catch (authErr) {
        console.warn('[stripe-webhook] Auth admin lookup failed', { chefId: order.chef_id, error: authErr });
      }
    }
    if (!chefUserId) {
      console.warn('[stripe-webhook] Chef has no user_id and could not resolve from email/auth', {
        chefId: order.chef_id,
        chefEmail: chef.email,
      });
      return;
    }
    const { error: insertErr } = await adminClient.from('notifications').insert({
      user_id: chefUserId,
      type: 'new_order_request',
      title: 'New Order Request',
      message: 'You have received a new order request. Please review and respond.',
      related_id: orderId,
      related_type: 'order',
      read: false,
    });
    if (insertErr) {
      console.error('[stripe-webhook] Notification insert failed', { orderId, chefId: order.chef_id, error: insertErr });
      return;
    }
    console.log('[stripe-webhook] Chef notified of new order', { orderId, chefId: order.chef_id });
  } catch (err) {
    console.error('[stripe-webhook] Failed to create chef notification', { orderId, error: err });
  }
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
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return respond(400, 'Invalid signature');
  }

  console.log('[stripe-webhook] Received event', event.type, 'id=', event.id);

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
        let paymentIntentStatus: string | null = null;

        if (typeof session.payment_intent === 'string') {
          paymentIntentId = session.payment_intent;
          const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
          transferGroup = intent.transfer_group ?? null;
          paymentIntentStatus = intent.status;
        }

        // Verify payment status from both session and payment intent
        const isPaymentSucceeded = 
          session.payment_status === 'paid' || 
          paymentIntentStatus === 'succeeded';

        // Always update payment intent ID and transfer group if available
        // This ensures the order can be found by payment_intent.succeeded event
        const updates: Record<string, unknown> = {};
        if (paymentIntentId) {
          updates.stripe_payment_intent_id = paymentIntentId;
        }
        if (transferGroup) {
          updates.transfer_group = transferGroup;
        }

        if (isPaymentSucceeded) {
          // Payment confirmed - make order visible to chef
          updates.payment_status = 'succeeded';
          updates.status = 'requested';
          console.log('Order payment confirmed and made visible to chef', { 
            orderId, 
            paymentIntentId,
            paymentIntentStatus,
            sessionPaymentStatus: session.payment_status
          });
        } else {
          // Payment not yet confirmed - update metadata but keep hidden
          // payment_intent.succeeded will finalize it
          console.log('Checkout completed but payment pending', { 
            orderId, 
            paymentStatus: session.payment_status,
            paymentIntentStatus
          });
        }

        // Always update to ensure payment intent ID is stored
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await adminClient.from('orders').update(updates).eq('id', orderId);
          if (updateError) {
            console.error('Error updating order in checkout.session.completed', { orderId, error: updateError });
          } else if (isPaymentSucceeded) {
            await notifyChefOfNewOrder(orderId);
          }
        } else {
          console.warn('No updates to apply for checkout.session.completed', { orderId });
        }
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

          if (account.charges_enabled) {
            const { data: profileRow } = await adminClient
              .from('profiles')
              .select('id, email')
              .eq('stripe_account_id', account.id)
              .maybeSingle();
            if (profileRow) {
              await adminClient.from('chefs').update({ stripe_connect_completed: true, status: 'paused' }).eq('user_id', profileRow.id);
              if (profileRow.email) {
                await adminClient.from('chefs').update({ stripe_connect_completed: true, status: 'paused' }).eq('email', profileRow.email);
              }
            }
          }
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Update payment status and ensure order is visible to chef
        // Try to find order by payment intent ID in either field
        const { data: orders, error: findError } = await adminClient
          .from('orders')
          .select('id, payment_status')
          .or(`stripe_payment_intent_id.eq.${pi.id},payment_intent_id.eq.${pi.id}`);
        
        if (findError) {
          console.error('Error finding order for payment intent', pi.id, findError);
        } else if (orders && orders.length > 0) {
          // Update all matching orders (should only be one)
          const updateResult = await adminClient
            .from('orders')
            .update({ 
              payment_status: 'succeeded',
              status: 'requested', // Make order visible to chef after payment
            })
            .or(`stripe_payment_intent_id.eq.${pi.id},payment_intent_id.eq.${pi.id}`);
          
          console.log('Updated orders for payment_intent.succeeded', {
            paymentIntentId: pi.id,
            orderIds: orders.map(o => o.id),
            updated: orders.length,
          });
          for (const o of orders) {
            await notifyChefOfNewOrder(o.id);
          }
        } else {
          // Order not found by payment intent ID - try metadata (e.g. payment_intent.succeeded fired before checkout.session.completed)
          console.log('[stripe-webhook] payment_intent.succeeded: No order by PI id, trying metadata', {
            paymentIntentId: pi.id,
            metadata: pi.metadata,
          });
          if (pi.metadata?.order_id) {
            const orderId = Number(pi.metadata.order_id);
            if (Number.isFinite(orderId)) {
              const { error: metaUpdateErr } = await adminClient
                .from('orders')
                .update({ 
                  payment_status: 'succeeded',
                  status: 'requested',
                  stripe_payment_intent_id: pi.id,
                })
                .eq('id', orderId);
              if (!metaUpdateErr) {
                await notifyChefOfNewOrder(orderId);
              }
              console.log('Updated order from payment intent metadata', { orderId, paymentIntentId: pi.id });
            }
          } else {
            console.warn('payment_intent.succeeded: No order found for payment intent', pi.id);
          }
        }
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
