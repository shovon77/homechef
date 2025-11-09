import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/ensureProfile';
import { isLocalAdmin } from '../lib/admin';
import type { Profile } from '../lib/types';

type Role = 'admin' | 'chef' | 'user';

type RoleState = {
  loading: boolean;
  role: Role;
  isAdmin: boolean;
  isChef: boolean;
  user: { id: string; email?: string | null } | null;
  profile: Profile | null;
};

/**
 * Role hook that listens to auth state changes and refreshes role
 * 
 * Returns role based on:
 * - isAdmin: profile.is_admin OR email in EXPO_PUBLIC_ADMIN_EMAILS
 * - isChef: profile.is_chef === true
 * - role: 'admin' | 'chef' | 'user'
 * 
 * Note: This hook refreshes on auth state changes. If a user's profile
 * changes (e.g., becomes a chef) without an auth state change, the role
 * may not update immediately. Consider refreshing the page or navigating
 * to trigger a re-check.
 */
export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({
    loading: true,
    role: 'user',
    isAdmin: false,
    isChef: false,
    user: null,
    profile: null,
  });

  useEffect(() => {
    let mounted = true;

    async function checkRole() {
      try {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError || !userData?.user) {
          if (mounted) {
            setState({
              loading: false,
              role: 'user',
              isAdmin: false,
              isChef: false,
              user: null,
              profile: null,
            });
          }
          return;
        }

        const user = userData.user;

        // Ensure profile exists
        await ensureProfile(supabase);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, is_admin, is_chef')
          .eq('id', user.id)
          .maybeSingle();

        // Handle RLS errors gracefully
        if (profileError && profileError.code !== 'PGRST116') {
          console.warn('Error fetching profile:', profileError);
        }

        const profile = profileData as Profile | null;

        // Compute isAdmin: profile.is_admin OR email in allow-list
        const isAdminFromProfile = profile?.is_admin === true;
        const isAdminFromEmail = isLocalAdmin(user);
        const isAdmin = isAdminFromProfile || isAdminFromEmail;

        // Compute isChef: profile.is_chef === true OR user exists in chefs table
        let isChef = profile?.is_chef === true;
        
        // Also check chefs table as fallback (in case profile.is_chef isn't set but chef entry exists)
        if (!isChef && profile?.email) {
          const { data: chefData } = await supabase
            .from('chefs')
            .select('id')
            .eq('email', profile.email)
            .maybeSingle();
          isChef = !!chefData;
        }

        // Determine role
        let role: Role = 'user';
        if (isAdmin) {
          role = 'admin';
        } else if (isChef) {
          role = 'chef';
        }

        if (mounted) {
          setState({
            loading: false,
            role,
            isAdmin,
            isChef,
            user: {
              id: user.id,
              email: user.email,
            },
            profile: profile || null,
          });
        }
      } catch (e: any) {
        console.error('useRole error:', e);
        if (mounted) {
          setState({
            loading: false,
            role: 'user',
            isAdmin: false,
            isChef: false,
            user: null,
            profile: null,
          });
        }
      }
    }

    // Check role on mount
    checkRole();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Refresh role when auth state changes
        checkRole();
      }
    });

    // Also periodically refresh role (every 30 seconds) to catch profile changes
    // This handles cases where profile.is_chef is updated without an auth state change
    const intervalId = setInterval(() => {
      if (mounted) {
        checkRole();
      }
    }, 30000); // 30 seconds

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []); // Empty deps - only run on mount/unmount

  return state;
}

