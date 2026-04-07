import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.132.0&no-check';

// Dev (APP_ENV=development): TEST key only. Prod: PROD key, then legacy STRIPE_SECRET_KEY
// Case-insensitive so "Development" and "development" both use test keys
const appEnv = (Deno.env.get('APP_ENV') ?? '').toLowerCase();
const isDev = appEnv === 'development';
const stripeSecret = isDev
  ? (Deno.env.get('STRIPE_SECRET_TEST_KEY') ?? '')
  : (Deno.env.get('STRIPE_SECRET_PROD_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '');

export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
