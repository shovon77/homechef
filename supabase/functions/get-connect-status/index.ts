import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Stripe: use fetch (no Stripe SDK - avoids Deno.core.runMicrotasks in Edge Runtime)
const appEnv = (Deno.env.get('APP_ENV') ?? '').toLowerCase();
const isDev = appEnv === 'development';
const STRIPE_SECRET = isDev
  ? (Deno.env.get('STRIPE_SECRET_TEST_KEY') ?? '')
  : (Deno.env.get('STRIPE_SECRET_PROD_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '');

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeGet(endpoint: string): Promise<{ data?: any; error?: { message: string } }> {
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  const json = await res.json();
  if (!res.ok) return { error: { message: json.error?.message ?? String(json) } };
  return { data: json };
}

async function stripePost(endpoint: string, params: Record<string, string> = {}): Promise<{ data?: any; error?: { message: string } }> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) return { error: { message: json.error?.message ?? String(json) } };
  return { data: json };
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Test chef user ID – bypass Stripe Connect check so dishes stay visible in production */
const TEST_CHEF_USER_ID = 'fb2f513f-fa0c-48d5-828a-086d2f241463';

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return respond(500, { error: 'Server misconfigured' });
  }

  if (req.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return respond(401, { error: 'Unauthorized' });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('get-connect-status profile error', profileErr);
      throw profileErr;
    }

    if (!profile?.stripe_account_id) {
      // Test chef bypass: ensure stripe_connect_completed = true so dishes stay visible
      if (profile?.id === TEST_CHEF_USER_ID) {
        try {
          await supabase
            .from('chefs')
            .update({ stripe_connect_completed: true })
            .eq('user_id', profile.id);
          if (user?.email) {
            await supabase.from('chefs').update({ stripe_connect_completed: true }).eq('email', user.email);
          }
        } catch (e) {
          console.warn('get-connect-status test chef bypass (no account)', e);
        }
      }
      let chefStatusNoAccount: string | null = null;
      try {
        const { data: r } = await supabase.from('chefs').select('status').eq('user_id', profile.id).maybeSingle();
        chefStatusNoAccount = r?.status ?? null;
        if (!chefStatusNoAccount && user?.email) {
          const { data: re } = await supabase.from('chefs').select('status').eq('email', user.email).maybeSingle();
          chefStatusNoAccount = re?.status ?? null;
        }
      } catch (_) { /* non-blocking */ }
      return respond(200, { hasAccount: false, chef_status: chefStatusNoAccount });
    }

    const accountRes = await stripeGet(`/accounts/${profile.stripe_account_id}`);
    if (accountRes.error) {
      throw new Error(accountRes.error.message);
    }
    const account = accountRes.data;

    let loginLink: string | null = null;
    try {
      const linkRes = await stripePost(`/accounts/${account.id}/login_links`);
      if (linkRes.data?.url) loginLink = linkRes.data.url;
    } catch (err) {
      console.warn('get-connect-status login link error', err);
    }

    const requirements = account.requirements ?? null;
    const capabilities = account.capabilities ?? null;

    // Update charges_enabled flag (stripe_payouts_enabled doesn't exist in schema)
    try {
      await supabase
        .from('profiles')
        .update({
          charges_enabled: Boolean(account.charges_enabled),
        })
        .eq('id', profile.id);
    } catch (err) {
      console.error('get-connect-status profile update error', err);
      // Don't fail the request if update fails
    }

    // Update chefs: stripe_connect_completed = true only when BOTH charges AND payouts enabled (else listings hidden)
    // Test chef bypass: always treat as connected so dishes stay visible in production
    const canAcceptPayments = profile.id === TEST_CHEF_USER_ID
      ? true
      : Boolean(account.charges_enabled && account.payouts_enabled);
    try {
      const updatePayload: Record<string, unknown> = { stripe_connect_completed: canAcceptPayments };
      // Only set status='paused' when first completing Connect (stripe_connect_completed false->true).
      // Do NOT overwrite status on every load, or we'd reset Active to Paused.
      const { data: existingChef } = await supabase
        .from('chefs')
        .select('stripe_connect_completed')
        .eq('user_id', profile.id)
        .maybeSingle();
      const wasAlreadyCompleted = existingChef?.stripe_connect_completed === true;
      if (canAcceptPayments && !wasAlreadyCompleted) {
        updatePayload.status = 'paused';
      }
      const { error: chefByUserErr } = await supabase
        .from('chefs')
        .update(updatePayload)
        .eq('user_id', profile.id);
      if (chefByUserErr) console.warn('get-connect-status chef update by user_id', chefByUserErr);
      if (user.email) {
        const { error: chefByEmailErr } = await supabase
          .from('chefs')
          .update({ stripe_connect_completed: canAcceptPayments })
          .eq('email', user.email);
        if (chefByEmailErr) console.warn('get-connect-status chef update by email', chefByEmailErr);
      }
    } catch (err) {
      console.warn('get-connect-status chef update error', err);
    }

    // Fetch updated chef status for client
    let chefStatus: string | null = null;
    try {
      const { data: chefRow } = await supabase
        .from('chefs')
        .select('status')
        .eq('user_id', profile.id)
        .maybeSingle();
      chefStatus = chefRow?.status ?? null;
      if (!chefStatus && user.email) {
        const { data: byEmail } = await supabase
          .from('chefs')
          .select('status')
          .eq('email', user.email)
          .maybeSingle();
        chefStatus = byEmail?.status ?? null;
      }
    } catch (_) { /* non-blocking */ }

    return respond(200, {
      hasAccount: true,
      accountId: account.id,
      country: account.country ?? null,
      default_currency: typeof account.default_currency === 'string' ? account.default_currency : null,
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      requirements,
      capabilities,
      loginLink,
      chef_status: chefStatus,
    });
  } catch (err: any) {
    console.error('get-connect-status error', err);
    return respond(400, { error: err?.message ?? String(err) });
  }
};

Deno.serve(handler);
