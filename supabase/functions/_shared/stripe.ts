import Stripe from 'https://esm.sh/stripe@12?target=deno&deno-std=0.224.0';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});
