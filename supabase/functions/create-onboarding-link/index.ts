import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';
import { stripe } from '../_shared/stripe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FRONTEND_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:8081';

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(status: number, message: string, detail?: unknown) {
  console.error(`[create-onboarding-link] ${message}`, detail);
  return json(status, { error: message });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Unauthorized');
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse(401, 'Unauthorized', userError);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('create-onboarding-link profile not found', { userId: user.id, profileError });
      return errorResponse(404, 'Profile not found', profileError);
    }

    let stripeAccountId = profile.stripe_account_id as string | null;

    if (!stripeAccountId) {
      if (!profile.email) {
        console.error('create-onboarding-link missing email', { profileId: profile.id });
        return errorResponse(400, 'Profile email required to create Stripe account');
      }

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: profile.email,
        metadata: { profile_id: profile.id },
      });

      stripeAccountId = account.id;

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', profile.id);

      if (updateError) {
        return errorResponse(500, 'Failed to persist Stripe account', updateError);
      }
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/onboarding/refresh`,
      return_url: `${FRONTEND_URL}/onboarding/return`,
      type: 'account_onboarding',
    });

    return json(200, { url: link.url });
  } catch (err) {
    return errorResponse(500, 'Internal Server Error', err);
  }
});
