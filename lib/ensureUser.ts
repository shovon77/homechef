import { supabase } from './supabase';

export type EnsureUserOptions = {
  /** Override name for new sign-ups (e.g. from First name + Last name fields) */
  name?: string;
  /** Phone number from sign-up (stored in profiles.phone) */
  phone?: string;
};

export async function ensureUser(options?: EnsureUserOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: ud, error: authErr } = await supabase.auth.getUser();
    if (authErr) return { ok: false, error: `auth.getUser: ${authErr.message}` };
    const u = ud?.user;
    if (!u) return { ok: false, error: 'No auth user' };

    // Check if profile already exists to preserve existing fields
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('name, is_chef, role, photo_url, is_admin, stripe_account_id, charges_enabled, location, phone')
      .eq('id', u.id)
      .maybeSingle();

    // Prefer explicit name from options (e.g. sign-up form), then existing profile, then metadata
    const name = (options?.name?.trim()) ||
      existingProfile?.name || 
      (u.user_metadata?.name as string) ||
      (u.user_metadata?.full_name as string) ||
      (u.user_metadata?.display_name as string) ||
      (u.email?.split('@')[0]) ||
      null;

    const base = { id: u.id, email: u.email, name, is_chef: existingProfile?.is_chef ?? false };

    const up1 = await supabase.from('users').upsert(base, { onConflict: 'id' });
    if (up1.error) return { ok: false, error: `users upsert: ${up1.error.message}` };

    // For profiles, preserve all existing fields
    const profileData: any = {
      id: u.id,
      email: u.email,
      role: existingProfile?.role || 'user',
    };

    // Only set name if profile doesn't exist or name is null
    if (!existingProfile || !existingProfile.name) {
      profileData.name = name;
    } else {
      profileData.name = existingProfile.name; // Preserve existing name
    }

    // Preserve other existing fields
    if (existingProfile) {
      if (existingProfile.is_chef !== undefined) profileData.is_chef = existingProfile.is_chef;
      if (existingProfile.photo_url !== undefined) profileData.photo_url = existingProfile.photo_url;
      if (existingProfile.is_admin !== undefined) profileData.is_admin = existingProfile.is_admin;
      if (existingProfile.stripe_account_id !== undefined) profileData.stripe_account_id = existingProfile.stripe_account_id;
      if (existingProfile.charges_enabled !== undefined) profileData.charges_enabled = existingProfile.charges_enabled;
      if (existingProfile.location !== undefined) profileData.location = existingProfile.location;
      if (existingProfile.phone !== undefined) profileData.phone = existingProfile.phone;
    } else {
      // New profile, set defaults
      profileData.is_chef = false;
      profileData.is_admin = false;
    }
    if (options?.phone?.trim() && (!existingProfile || existingProfile.phone == null)) {
      profileData.phone = options.phone.trim();
    }

    const up2 = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });
    if (up2.error) return { ok: false, error: `profiles upsert: ${up2.error.message}` };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
