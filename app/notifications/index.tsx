'use client';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import { Screen } from '../../components/Screen';
import { theme } from '../../lib/theme';
import WelcomeModal from '../../components/WelcomeModal';

const palette = {
  background: '#F2F0EF',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#33393A',
  muted: '#33393A',
  primary: '#FE734C',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user, isAdmin, isChef } = useRole();
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    related_id?: number;
    related_type?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeModalVariant, setWelcomeModalVariant] = useState<'user' | 'chef'>('user');

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel(`notifications-page-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, isAdmin, isChef]);

  async function loadNotifications() {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Define allowed notification types based on user role
      const allowedTypes: string[] = [
        'welcome',
        'chef_application_submitted',
        'order_placed',
        'order_ready',
        'order_issue_updated',
        'order_message',
        'order_rejected',
        'chef_pickup_reminder',
        'chef_pickup_reminder_1h',
        'user_pickup_reminder_2h',
        'user_pickup_reminder_1h'
      ];

      if (isAdmin) {
        allowedTypes.push('issue_reported', 'chef_request', 'new_user_signup');
      }

      if (isChef) {
        allowedTypes.push('chef_application_submitted', 'chef_application_approved', 'chef_application_rejected', 'new_order_request');
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('type', allowedTypes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (!error) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }

  const getOrderIdFromNotification = (notification: typeof notifications[0]): string => {
    const id = notification.related_id;
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    const hay = `${notification.title || ''} ${notification.message || ''}`;
    return hay.match(/order\s*#\s*(\d+)/i)?.[1] ?? '';
  };

  const getPreviewCopy = (notification: typeof notifications[0]) => {
    if (notification.type === 'order_message') {
      const oid = getOrderIdFromNotification(notification);
      return {
        title: oid ? `Order #${oid} - Update!` : 'Order - Update!',
        message: isChef ? 'You have a new message from a customer.' : 'You have a new message from chef.',
      };
    }
    if (notification.type === 'welcome') {
      return {
        title: 'Welcome!',
        message: 'Explore homemade meals or start selling.',
      };
    }
    if (notification.type === 'chef_application_submitted') {
      return {
        title: 'Welcome, Chef!',
        message: "Here's how YourHomeChef works for you.",
      };
    }
    return {
      title: notification.title,
      message: notification.message,
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Handle welcome notification - show modal
    if (notification.type === 'welcome') {
      setWelcomeModalVariant('user');
      setShowWelcomeModal(true);
      return;
    }

    if (notification.type === 'chef_application_submitted') {
      setWelcomeModalVariant('chef');
      setShowWelcomeModal(true);
      return;
    }

    // Order message notifications: route based on role
    if (notification.type === 'order_message' && notification.related_id) {
      if (isAdmin) {
        router.push('/admin');
      } else if (isChef) {
        router.push('/chef');
      } else {
        router.push(`/orders/track?id=${notification.related_id}`);
      }
      return;
    }

    // New order request: chefs go to chef dashboard
    if (notification.type === 'new_order_request' && isChef) {
      router.push('/chef');
      return;
    }

    // Chef pickup reminders: go to chef dashboard
    if (notification.type === 'chef_pickup_reminder' || notification.type === 'chef_pickup_reminder_1h') {
      router.push('/chef');
      return;
    }

    // User pickup reminders: go to order tracking
    if ((notification.type === 'user_pickup_reminder_2h' || notification.type === 'user_pickup_reminder_1h') && notification.related_id) {
      router.push(`/orders/track?id=${notification.related_id}`);
      return;
    }
    
    // Handle navigation based on notification type
    if (notification.related_id && notification.related_type === 'order') {
      router.push(`/orders/track?id=${notification.related_id}`);
    }
  };

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet!</Text>
          </View>
        ) : (
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={!isMobile}
          >
            <View style={styles.cards}>
              {notifications.map((notification) => {
                const preview = getPreviewCopy(notification);
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.card,
                      notification.read ? styles.cardRead : styles.cardUnread,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleNotificationClick(notification)}
                  >
                    <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
                      {preview.title}
                    </Text>
                    <Text style={styles.cardMessage} numberOfLines={1} ellipsizeMode="tail">
                      {preview.message}
                    </Text>
                    <Text style={styles.cardDate}>{formatDate(notification.created_at)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
      
      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        variant={welcomeModalVariant}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    ...Platform.select({
      web: {
        maxWidth: 1400,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        padding: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.primary,
    fontFamily: theme.typography.fontFamily.display,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  cards: {
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  cardRead: {
    // Match navbar notification dropdown (read)
    backgroundColor: 'rgba(51, 57, 58, 0.05)',
  },
  cardUnread: {
    // Match navbar notification dropdown (unread)
    backgroundColor: 'rgba(254, 115, 76, 0.05)',
  },
  cardTitle: {
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardMessage: {
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardDate: {
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
  },
});
