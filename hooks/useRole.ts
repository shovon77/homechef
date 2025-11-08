import { useEffect, useState, useRef } from 'react';
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
 * Stable role hook - runs once on mount, no dependency loops
 * 
 * Returns role based on:
 * - isAdmin: profile.is_admin OR email in EXPO_PUBLIC_ADMIN_EMAILS
 * - isChef: profile.is_chef === true
 * - role: 'admin' | 'chef' | 'user'
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

  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasRun.current) return;
    hasRun.current = true;

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

        // Compute isChef: profile.is_chef === true
        const isChef = profile?.is_chef === true;

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

    checkRole();

    return () => {
      mounted = false;
    };
  }, []); // Empty deps - runs once

  return state;
}

