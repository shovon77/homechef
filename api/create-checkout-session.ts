// Standalone serverless function for creating Stripe checkout sessions
// This can be deployed as a Vercel serverless function, Netlify function, or similar
// Usage: POST to this endpoint with { items: [...] }

import Stripe from 'stripe';

export default async function handler(req: { method: string; body: any; headers: any }): Promise<{ statusCode: number; body: string }> {
  if (req.method !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Stripe secret key not configured' }),
      };
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });

    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No items provided' }),
      };
    }

    // Get the origin from the request to build success/cancel URLs
    const origin = req.headers.origin || 
                   req.headers.referer?.split('/').slice(0, 3).join('/') || 
                   'http://localhost:8081';

    // Create line items for Stripe
    const lineItems = items.map((item: { id: number; name?: string | null; price?: number | null; qty: number; image?: string | null }) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name || 'Item',
          ...(item.image && { images: [item.image] }),
        },
        unit_amount: Math.round((item.price || 0) * 100), // Convert to cents
      },
      quantity: item.qty,
    }));

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        items: JSON.stringify(items),
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
    };
  }
}

