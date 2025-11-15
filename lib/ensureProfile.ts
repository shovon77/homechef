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

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      return { ok: false, error: `profiles fetch: ${fetchError.message}` };
    }

    // If profile exists, only update email if it's different (preserve all other fields)
    if (existingProfile) {
      // Only update email if it has changed
      if (existingProfile.email !== user.email) {
        const { error: updateError } = await sb
          .from('profiles')
          .update({ email: user.email })
          .eq('id', user.id);
        
        if (updateError) {
          return { ok: false, error: `profiles update: ${updateError.message}` };
        }
        // Return updated profile
        const { data: updated } = await sb
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        return { ok: true, profile: updated || existingProfile };
      }
      // Profile exists and email is the same, return as-is
      return { ok: true, profile: existingProfile };
    }

    // Profile doesn't exist, create it with minimal data
    const { data: upserted, error: upsertError } = await sb
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
      })
      .select()
      .single();

    if (upsertError) {
      return { ok: false, error: `profiles insert: ${upsertError.message}` };
    }

    return { ok: true, profile: upserted };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Simple helper for chef sign-up flow
 * Ensures a profile row exists in public.profiles for the current user.
 * @param supabaseClient - Supabase client instance
 * @returns Profile data or null
 */
export async function ensureProfileSimple(supabaseClient: typeof supabase) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  // upsert by id
  const { error } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, email: user.email }, { onConflict: 'id' });

  if (error) console.warn('ensureProfile upsert error', error);

  // re-read
  const { data } = await supabaseClient
    .from('profiles')
    .select('id,email,is_admin,is_chef,name')
    .eq('id', user.id)
    .maybeSingle();

  return data ?? null;
}

