'use client';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../constants/theme';

/**
 * Chef layout with role-based routing
 * Allows admins to view chef detail pages, but redirects non-chefs from chef dashboard
 */
export default function ChefLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, user, isAdmin, isChef } = useRole();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth');
        return;
      }
      
      // Allow admins to view chef detail pages (e.g., /chef/[id], /chef/[id]/reviews)
      // Only redirect from the chef dashboard (/chef or /chef/index)
      const isChefDashboard = pathname === '/chef' || pathname === '/chef/' || pathname === '/chef/index';
      const isChefDetailPage = pathname?.startsWith('/chef/') && pathname !== '/chef' && pathname !== '/chef/' && pathname !== '/chef/index';
      
      // If admin is trying to access chef dashboard, redirect to admin
      // But allow admins to view individual chef pages
      if (isAdmin && isChefDashboard) {
        router.replace('/admin');
      } else if (!isAdmin && !isChef && isChefDashboard) {
        // Non-chef, non-admin trying to access chef dashboard
        router.replace('/');
      }
    }
  }, [loading, user, isAdmin, isChef, router, pathname]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
