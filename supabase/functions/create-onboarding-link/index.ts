import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://yourhomechef.ca';
const DEFAULT_CONNECT_COUNTRY = Deno.env.get('DEFAULT_CONNECT_COUNTRY') ?? 'CA';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Dev (APP_ENV=development): TEST key. Prod: STRIPE_SECRET_PROD_KEY or STRIPE_SECRET_KEY
// Use case-insensitive check - "Development" and "development" both use test keys
const appEnv = (Deno.env.get('APP_ENV') ?? '').toLowerCase();
const isDev = appEnv === 'development';
const STRIPE_SECRET = isDev
  ? (Deno.env.get('STRIPE_SECRET_TEST_KEY') ?? '')
  : (Deno.env.get('STRIPE_SECRET_PROD_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '');

const STRIPE_API = 'https://api.stripe.com/v1';

/** Detect mode from key prefix for logging (sk_test_ = test, sk_live_ = live) */
const stripeMode = STRIPE_SECRET.startsWith('sk_live_') ? 'LIVE' : STRIPE_SECRET.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Call Stripe REST API using fetch (no Node.js deps - works in Deno Edge) */
async function stripeFetch(endpoint: string, params: Record<string, string>, idempotencyKey?: string): Promise<{ data?: any; error?: { message: string } }> {
  const body = new URLSearchParams(params).toString();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${STRIPE_SECRET}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method: 'POST',
    headers,
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    return { error: { message: json.error?.message ?? String(json) } };
  }
  return { data: json };
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    console.log('create-onboarding-link: APP_ENV=', Deno.env.get('APP_ENV'), 'Stripe mode=', stripeMode);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: prof, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('create-onboarding-link profile error', profileErr);
      throw profileErr;
    }

    let accountId = prof?.stripe_account_id ?? null;

    if (accountId) {
      // Update existing account capabilities
      const updateRes = await stripeFetch('/accounts/' + accountId, {
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
      });
      if (updateRes.error) {
        console.error('Stripe account update error', updateRes.error);
        throw new Error(updateRes.error.message);
      }
    } else {
      // Create new Stripe Connect Express account (legacy type - requires completed platform profile)
      const createParams: Record<string, string> = {
        type: 'express',
        country: DEFAULT_CONNECT_COUNTRY,
        business_type: 'individual',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'metadata[app_user_id]': user.id,
      };
      if (prof?.email) createParams.email = prof.email;

      const createRes = await stripeFetch('/accounts', createParams, `create-express-v2-${user.id}`);
      if (createRes.error) {
        console.error('Stripe account create error', createRes.error, '(Stripe mode:', stripeMode, ')');
        const msg = createRes.error.message;
        if (msg.includes('managing losses') || msg.includes('platform-profile')) {
          throw new Error('Stripe Connect setup required: Complete your platform profile at https://dashboard.stripe.com/settings/connect/platform-profile (use the same mode as your keys - toggle Test/Live in Stripe dashboard).');
        }
        throw new Error(msg);
      }
      accountId = createRes.data?.id;
      if (!accountId) throw new Error('No account id in Stripe response');
      await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
    }

    const normalizedSiteUrl = SITE_URL.replace(/\/$/, '');
    // Use /chef?tab=payouts so user lands on payouts tab (payouts is a tab within chef dashboard, not a separate route)
    const linkRes = await stripeFetch('/account_links', {
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${normalizedSiteUrl}/chef?tab=payouts&onboarding=refresh`,
      return_url: `${normalizedSiteUrl}/chef?tab=payouts&onboarding=return`,
    });

    if (linkRes.error) {
      console.error('Stripe account_links create error', linkRes.error);
      throw new Error(linkRes.error.message);
    }
    const url = linkRes.data?.url;
    if (!url) throw new Error('No url in Stripe account_links response');

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('create-onboarding-link error', err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

Deno.serve(handler);
