import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

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

type StripeSubject = {
  profile: { id: string; stripe_account_id: string | null } | null;
  chefEmail: string | null;
  viewedChefId: number | null;
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function parseJsonBody(req: Request): Promise<{ chef_id?: number }> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    const chefId = parsed?.chef_id;
    if (chefId == null) return {};
    const n = Number(chefId);
    return Number.isFinite(n) ? { chef_id: n } : {};
  } catch {
    return {};
  }
}

async function resolveStripeSubject(
  supabase: SupabaseClient,
  authUserId: string,
  chefIdParam?: number,
): Promise<StripeSubject> {
  if (chefIdParam == null) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', authUserId)
      .maybeSingle();
    if (error) throw error;
    return { profile, chefEmail: null, viewedChefId: null };
  }

  const { data: caller, error: callerErr } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', authUserId)
    .maybeSingle();
  if (callerErr) throw callerErr;
  if (!caller?.is_admin) {
    throw new Error('Forbidden');
  }

  const { data: chef, error: chefErr } = await supabase
    .from('chefs')
    .select('id, user_id, email')
    .eq('id', chefIdParam)
    .maybeSingle();
  if (chefErr || !chef) {
    throw new Error('Chef not found');
  }

  let profile: StripeSubject['profile'] = null;
  if (chef.user_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', chef.user_id)
      .maybeSingle();
    profile = p;
  } else if (chef.email) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('email', chef.email)
      .maybeSingle();
    profile = p;
  }

  return {
    profile,
    chefEmail: chef.email ?? null,
    viewedChefId: chef.id,
  };
}

async function fetchChefStatus(
  supabase: SupabaseClient,
  subject: StripeSubject,
  fallbackAuthEmail: string | null,
): Promise<string | null> {
  try {
    if (subject.viewedChefId != null) {
      const { data: byId } = await supabase
        .from('chefs')
        .select('status')
        .eq('id', subject.viewedChefId)
        .maybeSingle();
      if (byId?.status) return byId.status;
    }
    if (subject.profile?.id) {
      const { data: r } = await supabase
        .from('chefs')
        .select('status')
        .eq('user_id', subject.profile.id)
        .maybeSingle();
      if (r?.status) return r.status;
    }
    const email = subject.chefEmail ?? fallbackAuthEmail;
    if (email) {
      const { data: re } = await supabase
        .from('chefs')
        .select('status')
        .eq('email', email)
        .maybeSingle();
      return re?.status ?? null;
    }
  } catch (_) { /* non-blocking */ }
  return null;
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

    const body = await parseJsonBody(req);
    const subject = await resolveStripeSubject(supabase, user.id, body.chef_id);
    const profile = subject.profile;
    const chefEmail = subject.chefEmail ?? user.email ?? null;

    if (!profile?.stripe_account_id) {
      if (profile?.id === TEST_CHEF_USER_ID) {
        try {
          await supabase
            .from('chefs')
            .update({ stripe_connect_completed: true })
            .eq('user_id', profile.id);
          if (chefEmail) {
            await supabase.from('chefs').update({ stripe_connect_completed: true }).eq('email', chefEmail);
          }
        } catch (e) {
          console.warn('get-connect-status test chef bypass (no account)', e);
        }
      } else {
        try {
          if (profile?.id) {
            await supabase
              .from('chefs')
              .update({ stripe_connect_completed: false })
              .eq('user_id', profile.id);
          }
          if (chefEmail) {
            await supabase
              .from('chefs')
              .update({ stripe_connect_completed: false })
              .eq('email', chefEmail);
          }
          if (subject.viewedChefId != null) {
            await supabase
              .from('chefs')
              .update({ stripe_connect_completed: false })
              .eq('id', subject.viewedChefId);
          }
        } catch (e) {
          console.warn('get-connect-status chef mark incomplete (no account)', e);
        }
      }
      const chefStatusNoAccount = await fetchChefStatus(supabase, subject, user.email ?? null);
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

    try {
      await supabase
        .from('profiles')
        .update({
          charges_enabled: Boolean(account.charges_enabled),
        })
        .eq('id', profile.id);
    } catch (err) {
      console.error('get-connect-status profile update error', err);
    }

    const canAcceptPayments = profile.id === TEST_CHEF_USER_ID
      ? true
      : Boolean(account.charges_enabled && account.payouts_enabled);
    try {
      const updatePayload: Record<string, unknown> = { stripe_connect_completed: canAcceptPayments };
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
      if (chefEmail) {
        const { error: chefByEmailErr } = await supabase
          .from('chefs')
          .update({ stripe_connect_completed: canAcceptPayments })
          .eq('email', chefEmail);
        if (chefByEmailErr) console.warn('get-connect-status chef update by email', chefByEmailErr);
      }
      if (subject.viewedChefId != null) {
        const { error: chefByIdErr } = await supabase
          .from('chefs')
          .update({ stripe_connect_completed: canAcceptPayments })
          .eq('id', subject.viewedChefId);
        if (chefByIdErr) console.warn('get-connect-status chef update by id', chefByIdErr);
      }
    } catch (err) {
      console.warn('get-connect-status chef update error', err);
    }

    const chefStatus = await fetchChefStatus(supabase, subject, user.email ?? null);

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
    const message = err?.message ?? String(err);
    if (message === 'Forbidden') return respond(403, { error: message });
    if (message === 'Chef not found') return respond(404, { error: message });
    return respond(400, { error: message });
  }
};

Deno.serve(handler);
