import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isLocalAdmin } from '../lib/admin';
import { getProfile, isAdmin as checkIsAdmin } from '../lib/db';
import type { Profile } from '../lib/types';

type AdminState = {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  user: { id: string; email?: string | null } | null;
  profile: Profile | null;
};

/**
 * Hook to check if current user is an admin
 * 
 * Checks both:
 * - profiles.is_admin (database flag) via db.isAdmin()
 * - EXPO_PUBLIC_ADMIN_EMAILS (environment variable allow-list)
 * 
 * @returns {AdminState} Admin state with isAdmin, loading, error, user, and profile
 */
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({
    isAdmin: false,
    loading: true,
    error: null,
    user: null,
    profile: null,
  });

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData?.user;
        if (!user) {
          if (mounted) {
            setState({
              isAdmin: false,
              loading: false,
              error: null,
              user: null,
              profile: null,
            });
          }
          return;
        }

        // Get profile using db helper
        const profile = await getProfile(user.id);
        const isAdminFromProfile = profile ? await checkIsAdmin(user.id) : false;
        const isAdminFromEmail = isLocalAdmin(user);

        if (mounted) {
          setState({
            isAdmin: isAdminFromProfile || isAdminFromEmail,
            loading: false,
            error: null,
            user: {
              id: user.id,
              email: user.email,
            },
            profile: profile,
          });
        }
      } catch (e: any) {
        if (mounted) {
          setState({
            isAdmin: false,
            loading: false,
            error: e?.message || String(e),
            user: null,
            profile: null,
          });
        }
      }
    }

    checkAdmin();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (mounted) checkAdmin();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

