/**
 * Supabase Admin client for E2E tests.
 * Uses service role key to verify/cleanup test data.
 * Requires: SUPABASE_SERVICE_ROLE_KEY and EXPO_PUBLIC_SUPABASE_URL in .env.test
 */
import { createClient, User } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !serviceRoleKey) {
  console.warn('E2E: Missing SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_URL. DB verification and cleanup will be skipped.');
}

export const adminClient = url && serviceRoleKey
  ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  : null;

export async function findUserByEmail(email: string): Promise<User | null> {
  if (!adminClient) return null;
  const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getProfile(userId: string) {
  if (!adminClient) return null;
  const { data } = await adminClient.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function getUser(userId: string) {
  if (!adminClient) return null;
  const { data } = await adminClient.from('users').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function confirmUserEmail(userId: string): Promise<boolean> {
  if (!adminClient) return false;
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  return !error;
}

export async function deleteTestUser(userId: string): Promise<void> {
  if (!adminClient) return;
  try {
    await adminClient.from('profiles').delete().eq('id', userId);
    await adminClient.from('users').delete().eq('id', userId);
    await adminClient.auth.admin.deleteUser(userId);
  } catch (e) {
    console.warn('E2E cleanup error:', e);
  }
}
