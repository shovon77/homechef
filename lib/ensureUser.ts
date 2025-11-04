import { supabase } from './supabase';

export async function ensureUser(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: ud, error: authErr } = await supabase.auth.getUser();
    if (authErr) return { ok: false, error: `auth.getUser: ${authErr.message}` };
    const u = ud?.user;
    if (!u) return { ok: false, error: 'No auth user' };

    const name =
      (u.user_metadata?.name as string) ||
      (u.user_metadata?.full_name as string) ||
      (u.user_metadata?.display_name as string) ||
      (u.email?.split('@')[0]) ||
      null;

    const base = { id: u.id, email: u.email, name, is_chef: false };

    const up1 = await supabase.from('users').upsert(base, { onConflict: 'id' });
    if (up1.error) return { ok: false, error: `users upsert: ${up1.error.message}` };

    const up2 = await supabase
      .from('profiles')
      .upsert({ ...base, role: 'user' }, { onConflict: 'id' });
    if (up2.error) return { ok: false, error: `profiles upsert: ${up2.error.message}` };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
