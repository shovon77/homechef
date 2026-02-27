// One-time backfill: fetch Twilio message history and update notifications.sms_sent
// Invoke via: supabase functions invoke backfill-sms-sent --no-verify-jwt

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
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length >= 10) return `+${cleaned}`;
  return null;
}

async function fetchTwilioMessages(
  accountSid: string,
  authToken: string,
  options: { dateSentAfter?: string; dateSentBefore?: string; limit?: number } = {}
): Promise<{ sid: string; body: string; to: string; date_sent: string }[]> {
  const params = new URLSearchParams();
  if (options.dateSentAfter) params.set('DateSent>=', options.dateSentAfter);
  if (options.dateSentBefore) params.set('DateSent<=', options.dateSentBefore);
  params.set('PageSize', String(options.limit ?? 1000));
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`) },
  });
  if (!res.ok) throw new Error(`Twilio list failed: ${res.status}`);
  const data = await res.json();
  return (data.messages || []).map((m: any) => ({
    sid: m.sid,
    body: m.body || '',
    to: m.to || '',
    date_sent: m.date_sent,
  }));
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

  if (!accountSid || !authToken) {
    return json(500, { error: 'Twilio not configured' });
  }

  try {
    // 1. Reset legacy notifications to sms_sent = false (clear any prior backfill)
    await adminClient.from('notifications').update({ sms_sent: false }).is('sms_sid', null);

    // 2. Fetch notifications without sms_sid (legacy)
    const { data: notifications, error: notifErr } = await adminClient
      .from('notifications')
      .select('id, user_id, title, message, created_at')
      .is('sms_sid', null)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (notifErr || !notifications?.length) {
      return json(200, { updated: 0, message: 'No legacy notifications to backfill' });
    }

    // 3. Fetch user phones
    const userIds = [...new Set(notifications.map((n: any) => n.user_id).filter(Boolean))];
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, phone')
      .in('id', userIds);
    const phoneMap = new Map<string, string>();
    for (const p of profiles || []) {
      const e164 = toE164(p.phone);
      if (e164) phoneMap.set(p.id, e164);
    }

    // 4. Date range from notifications (Twilio uses UTC)
    const dates = notifications.map((n: any) => new Date(n.created_at).getTime());
    const minDate = new Date(Math.min(...dates) - 60000); // 1 min before
    const maxDate = new Date(Math.max(...dates) + 60000); // 1 min after
    const dateSentAfter = minDate.toISOString().slice(0, 19) + 'Z';
    const dateSentBefore = maxDate.toISOString().slice(0, 19) + 'Z';

    // 5. Fetch Twilio messages in that range
    const twilioMessages = await fetchTwilioMessages(accountSid, authToken, {
      dateSentAfter,
      dateSentBefore,
      limit: 1000,
    });

    console.log(`[backfill-sms-sent] notifications=${notifications.length} twilio=${twilioMessages.length}`);

    // 6. Build lookup: key = "phone|body" -> list of Twilio msgs (same body can go to same user multiple times)
    const twilioByKey = new Map<string, { sid: string; date_sent: string }[]>();
    for (const m of twilioMessages) {
      const key = `${m.to}|${m.body}`;
      if (!twilioByKey.has(key)) twilioByKey.set(key, []);
      twilioByKey.get(key)!.push({ sid: m.sid, date_sent: m.date_sent });
    }

    // 7. For each notification, find matching Twilio message and update
    let updated = 0;
    for (const n of notifications) {
      const phone = phoneMap.get(n.user_id);
      if (!phone) continue;
      const smsText = [n.title, n.message].filter(Boolean).join(' - ');
      if (!smsText.trim()) continue;
      const key = `${phone}|${smsText}`;
      const matches = twilioByKey.get(key);
      if (!matches || matches.length === 0) continue;

      const nTime = new Date(n.created_at).getTime();
      let best: { sid: string } | null = null;
      let bestDiff = Infinity;
      for (const m of matches) {
        const mTime = new Date(m.date_sent).getTime();
        const diff = Math.abs(nTime - mTime);
        if (diff < bestDiff && diff < 120000) {
          bestDiff = diff;
          best = m;
        }
      }
      if (!best) continue;

      const { error: upErr } = await adminClient
        .from('notifications')
        .update({ sms_sent: true, sms_sid: best.sid })
        .eq('id', n.id);
      if (!upErr) {
        updated++;
        // Remove this match so we don't reuse for another notification
        const arr = twilioByKey.get(key)!;
        const idx = arr.findIndex((x) => x.sid === best!.sid);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }

    return json(200, { updated, total: notifications.length, twilioFetched: twilioMessages.length });
  } catch (err) {
    console.error('backfill-sms-sent error', err);
    return json(500, { error: String(err?.message || err) });
  }
});
