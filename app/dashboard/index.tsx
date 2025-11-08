import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../constants/theme';

/**
 * Role-aware dashboard router
 * Routes to correct area based on user role
 */
export default function Dashboard() {
  const router = useRouter();
  const { loading, role } = useRole();

  useEffect(() => {
    if (!loading) {
      if (role === 'admin') {
        router.replace('/admin');
      } else if (role === 'chef') {
        router.replace('/chef/dashboard');
      } else {
        router.replace('/');
      }
    }
  }, [loading, role, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

