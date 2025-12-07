'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isLocalAdmin } from '../lib/admin';
import type { Profile } from '../lib/types';

type Role = 'admin' | 'chef' | 'user';

type AuthState = {
  loading: boolean;
  role: Role;
  isAdmin: boolean;
  isChef: boolean;
  user: { id: string; email?: string | null } | null;
  profile: Profile | null;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  role: 'user',
  isAdmin: false,
  isChef: false,
  user: null,
  profile: null,
  refreshRole: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refreshRole'>>({
    loading: true,
    role: 'user',
    isAdmin: false,
    isChef: false,
    user: null,
    profile: null,
  });

  const fetchProfileAndRole = async (sessionUser: any) => {
    try {
      if (!sessionUser) {
        setState({
          loading: false,
          role: 'user',
          isAdmin: false,
          isChef: false,
          user: null,
          profile: null,
        });
        return;
      }

      // Fetch profile and check chef table in parallel
      const [profileResult, chefResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, is_admin, is_chef')
          .eq('id', sessionUser.id)
          .maybeSingle(),
        sessionUser.email 
          ? supabase
              .from('chefs')
              .select('id')
              .eq('email', sessionUser.email)
              .maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      const profile = profileResult.data as Profile | null;
      const chefData = chefResult.data;

      // Compute isAdmin
      const isAdminFromProfile = profile?.is_admin === true;
      const isAdminFromEmail = isLocalAdmin(sessionUser);
      const isAdmin = isAdminFromProfile || isAdminFromEmail;

      // Compute isChef
      let isChef = profile?.is_chef === true;
      if (!isChef && chefData) {
        isChef = true;
      }

      // Determine role
      let role: Role = 'user';
      if (isAdmin) {
        role = 'admin';
      } else if (isChef) {
        role = 'chef';
      }

      setState({
        loading: false,
        role,
        isAdmin,
        isChef,
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
        },
        profile: profile || null,
      });

    } catch (e) {
      console.error('Auth context error:', e);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const refreshRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetchProfileAndRole(session?.user);
  };

  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        fetchProfileAndRole(session?.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        // If session exists, fetch profile; otherwise clear state
        // We pass session.user directly
        fetchProfileAndRole(session?.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
