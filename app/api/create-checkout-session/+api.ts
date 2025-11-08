// This is a serverless function for creating Stripe checkout sessions
// It uses server-only environment variables (STRIPE_SECRET_KEY)
// Requires: npm install stripe
export async function POST(request: Request): Promise<Response> {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Dynamic import of Stripe (requires: npm install stripe)
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });

    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the origin from the request to build success/cancel URLs
    const origin = request.headers.get('origin') || 
                   request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 
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

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

