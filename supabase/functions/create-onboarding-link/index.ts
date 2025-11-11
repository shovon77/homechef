import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { stripe } from '../_shared/stripe.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:8081';
const DEFAULT_CONNECT_COUNTRY = Deno.env.get('DEFAULT_CONNECT_COUNTRY') ?? 'CA';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Server misconfigured', { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response('Unauthorized', { status: 401 });
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
    const capabilities = {
      card_payments: { requested: true as const },
      transfers: { requested: true as const },
    };

    if (accountId) {
      await stripe.accounts.update(accountId, { capabilities });
    } else {
      // attempt to find existing account by metadata
      let foundAccountId: string | null = null;
      try {
        const results = await stripe.accounts.search({
          query: `metadata['app_user_id']:'${user.id}'`,
          limit: 1,
        });
        if (results.data.length > 0) {
          foundAccountId = results.data[0].id;
        }
      } catch (searchErr) {
        console.warn('Stripe account search by metadata failed', searchErr);
      }

      if (!foundAccountId && prof?.email) {
        try {
          const results = await stripe.accounts.search({
            query: `email:'${prof.email}'`,
            limit: 1,
          });
          if (results.data.length > 0) {
            foundAccountId = results.data[0].id;
          }
        } catch (searchErr) {
          console.warn('Stripe account search by email failed', searchErr);
        }
      }

      if (foundAccountId) {
        accountId = foundAccountId;
        await stripe.accounts.update(accountId, { capabilities });
        await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
      } else {
        const created = await stripe.accounts.create({
          type: 'express',
          country: DEFAULT_CONNECT_COUNTRY,
          email: prof?.email ?? undefined,
          business_type: 'individual',
          capabilities,
          metadata: { app_user_id: user.id },
        }, {
          idempotencyKey: user.id,
        });
        accountId = created.id;
        await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
      }
    }

    const normalizedSiteUrl = SITE_URL.replace(/\/$/, '');
    const link = await stripe.accountLinks.create({
      account: accountId!,
      type: 'account_onboarding',
      refresh_url: `${normalizedSiteUrl}/chef/payouts?onboarding=refresh`,
      return_url: `${normalizedSiteUrl}/chef/payouts?onboarding=return`,
    });

    return new Response(JSON.stringify({ url: link.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('create-onboarding-link error', err?.raw ?? err);
    return new Response(JSON.stringify({ error: err?.raw?.message ?? String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

Deno.serve(handler);
