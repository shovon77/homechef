'use client';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../constants/theme';

/**
 * Chef layout with role-based routing
 */
export default function ChefLayout() {
  const router = useRouter();
  const { loading, user, isAdmin } = useRole();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth');
      } else if (isAdmin) {
        router.replace('/admin');
      }
    }
  }, [loading, user, isAdmin, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
