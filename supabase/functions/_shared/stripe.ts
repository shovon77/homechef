import Stripe from 'https://esm.sh/stripe@12?target=deno&deno-std=0.224.0';

// Dev (APP_ENV=development): TEST key only. Prod: PROD key, then legacy STRIPE_SECRET_KEY
const isDev = Deno.env.get('APP_ENV') === 'development';
const stripeSecret = isDev
  ? (Deno.env.get('STRIPE_SECRET_TEST_KEY') ?? '')
  : (Deno.env.get('STRIPE_SECRET_PROD_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '');

export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-06-20',
});
