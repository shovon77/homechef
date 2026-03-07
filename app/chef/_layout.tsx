'use client';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../constants/theme';

/**
 * Chef layout with role-based routing
 * Allows admins to view chef detail pages, but redirects non-chefs from chef dashboard
 */
export default function ChefLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ viewAs?: string }>();
  const { loading, user, isAdmin, isChef } = useRole();

  useEffect(() => {
    if (!loading && pathname?.startsWith('/chef')) {
      // Only run redirect logic when we're actually on a chef route (avoids redirecting when navigating away to /browse etc.)
      const isChefDetailPage = pathname?.startsWith('/chef/') && pathname !== '/chef/' && !pathname?.startsWith('/chef/profile') && pathname !== '/chef/index';
      const isChefDashboard = pathname === '/chef' || pathname === '/chef/' || pathname === '/chef/index';

      if (!user) {
        // Allow unauthenticated access only to chef detail pages
        if (isChefDetailPage) return;
        router.replace('/auth');
        return;
      }
      
      // If admin is trying to access chef dashboard, redirect to admin
      // But allow admins to view a specific chef's dashboard when viewAs is present
      if (isAdmin && isChefDashboard && !params?.viewAs) {
        router.replace('/admin');
      } else if (!isAdmin && !isChef && isChefDashboard) {
        // Non-chef, non-admin trying to access chef dashboard
        router.replace('/');
      }
    }
  }, [loading, user, isAdmin, isChef, router, pathname, params?.viewAs]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F0EF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
