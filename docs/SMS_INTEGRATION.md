# SMS Integration (Twilio)

SMS notifications are sent for all notification types via a **database trigger** that calls the `send-notification-sms` Edge Function when a notification is inserted.

## Setup

1. **Twilio**: Create an account, get Account SID, Auth Token, and a phone number.
2. **Supabase secrets**: Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in Project Settings → Edge Functions.
3. **Deploy**: `supabase functions deploy send-notification-sms`
4. **Run the migration**: See below.

## Database trigger (required)

SMS is triggered by a PostgreSQL trigger on the `notifications` table. Run the migration in **Supabase Dashboard → SQL Editor**:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query and paste the contents of `migrations/add_notification_sms_trigger.sql`
3. Run the query

This requires the **pg_net** extension. Enable it first: **Database** → **Extensions** → search "pg_net" → enable.

## How it works

- **Trigger**: When any row is INSERTed into `notifications` (from client, createWelcomeNotification, or the new_user_signup trigger), the `trigger_send_notification_sms` function fires.
- **pg_net**: The trigger uses pg_net to POST the new row to the Edge Function.
- **Edge Function**: Fetches the user's phone from `profiles.phone`, converts to E.164, and sends via Twilio.

## Phone format

User phone numbers in `profiles.phone` should be in E.164 or 10-digit North American format. The function converts:
- `4155551234` → `+14155551234`
- `(415) 555-1234` → `+14155551234`
