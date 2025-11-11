import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { stripe } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export const handler = async (req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return respond(500, { error: 'Server misconfigured' });
  }

  if (req.method === 'OPTIONS') {
    return respond(200, { ok: true });
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
      return respond(200, { hasAccount: false });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    let loginLink: string | null = null;
    try {
      const link = await stripe.accounts.createLoginLink(account.id);
      loginLink = link.url;
    } catch (err) {
      console.warn('get-connect-status login link error', err?.raw ?? err);
    }

    const requirements = account.requirements ?? null;
    const capabilities = account.capabilities ?? null;

    try {
      await supabase
        .from('profiles')
        .update({
          stripe_payouts_enabled: Boolean(account.payouts_enabled),
          stripe_requirements_due: Array.isArray(requirements?.currently_due) ? requirements?.currently_due : [],
        })
        .eq('id', profile.id);
    } catch (err) {
      console.error('get-connect-status profile update error', err);
    }

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
    });
  } catch (err: any) {
    console.error('get-connect-status error', err?.raw ?? err);
    return respond(400, { error: err?.raw?.message ?? String(err) });
  }
};

Deno.serve(handler);
