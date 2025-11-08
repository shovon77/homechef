import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Ensures a profile row exists in public.profiles for the current user.
 * Preserves existing is_chef value if present.
 * 
 * @param client - Supabase client (defaults to lib/supabase)
 * @returns {Promise<{ ok: boolean; error?: string; profile?: any }>}
 */
export async function ensureProfile(client?: SupabaseClient): Promise<{ ok: boolean; error?: string; profile?: any }> {
  const sb = client || supabase;
  try {
    const { data: userData, error: authError } = await sb.auth.getUser();
    if (authError) return { ok: false, error: `auth.getUser: ${authError.message}` };
    
    const user = userData?.user;
    if (!user || !user.id) return { ok: false, error: 'No authenticated user' };

    // Check if profile already exists to preserve is_chef
    const { data: existingProfile } = await sb
      .from('profiles')
      .select('is_chef')
      .eq('id', user.id)
      .maybeSingle();

    // Upsert profile, preserving is_chef if it exists
    const profileData: {
      id: string;
      email: string | null | undefined;
      is_chef?: boolean;
    } = {
      id: user.id,
      email: user.email,
    };

    // Only include is_chef if it already exists (preserve it)
    if (existingProfile?.is_chef !== undefined && existingProfile?.is_chef !== null) {
      profileData.is_chef = existingProfile.is_chef;
    }

    const { data: upserted, error: upsertError } = await sb
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      return { ok: false, error: `profiles upsert: ${upsertError.message}` };
    }

    return { ok: true, profile: upserted || existingProfile };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

