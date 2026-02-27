// supabase/functions/send-notification-sms/index.ts
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { adminClient } from '../_shared/db.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function toE164(phone: string | null | undefined): string | null {
  if (phone == null || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  // North American: 10 digits -> +1XXXXXXXXXX
  if (cleaned.length === 10) return `+1${cleaned}`;
  // North American: 11 digits starting with 1 -> +1XXXXXXXXXX
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  // International: 11+ digits, assume already has country code
  if (cleaned.length >= 10) return `+${cleaned}`;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Missing Twilio env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    return json(500, { error: 'SMS not configured' });
  }

  try {
    const body = await req.json().catch(() => null);
    console.log('[send-notification-sms] received', JSON.stringify(body?.record || body));

    let notificationId: string | undefined;
    let userId: string;
    let title: string;
    let message: string;
    // Support direct invoke: { user_id, title, message }
    // Support Supabase Database Webhook: { type, table, record: { id, user_id, title, message } }
    if (body?.record) {
      const r = body.record;
      notificationId = r.id;
      userId = r.user_id;
      title = r.title ?? '';
      message = r.message ?? '';
    } else if (body?.user_id && (body?.title != null || body?.message != null)) {
      userId = body.user_id;
      title = body.title ?? '';
      message = body.message ?? '';
    } else {
      return json(400, { error: 'Missing user_id, title, or message' });
    }

    if (!userId) {
      return json(400, { error: 'Missing user_id' });
    }

    const smsText = [title, message].filter(Boolean).join(' - ');
    if (!smsText.trim()) {
      return json(400, { error: 'Empty notification text' });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single();

    const rawPhone = profile?.phone;
    const phone = toE164(rawPhone);
    if (!phone) {
      console.log('[send-notification-sms] no phone for user', userId, 'raw:', rawPhone);
      return json(200, { ok: true, skipped: 'no_phone', raw_phone: rawPhone ?? null });
    }

    console.log('[send-notification-sms] sending to', phone, 'text:', smsText.substring(0, 50) + '...');

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioBody = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: smsText,
    }).toString();

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      },
      body: twilioBody,
    });

    const twilioJson = await twilioRes.json().catch(() => ({}));

    if (!twilioRes.ok) {
      console.error('[send-notification-sms] Twilio error', twilioRes.status, twilioJson);
      return json(502, { error: twilioJson?.message || 'Twilio send failed' });
    }

    if (notificationId) {
      await adminClient.from('notifications').update({ sms_sent: true, sms_sid: twilioJson?.sid ?? null }).eq('id', notificationId).then(() => {});
    }
    console.log('[send-notification-sms] sent ok sid=', twilioJson.sid);
    return json(200, { ok: true, sid: twilioJson.sid });
  } catch (err) {
    console.error('send-notification-sms error', err);
    return json(500, { error: String(err) });
  }
});
