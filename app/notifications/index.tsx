'use client';
import React, { useEffect, useState, useMemo } from 'react';
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
  muted: '#64748B',
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
        'order_placed',
        'order_ready',
        'order_issue_updated',
        'order_message'
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

  async function markAllAsRead() {
    if (!user?.id) return;
    
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);
      
      if (!error) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Handle welcome notification - show modal
    if (notification.type === 'welcome') {
      setShowWelcomeModal(true);
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
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.markAllReadButton}
            >
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
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
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={!isMobile}
              contentContainerStyle={styles.tableScroll}
            >
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={[styles.tableHeader, !isMobile && { minWidth: 1000 }]}>
                  <View style={[styles.tableHeaderCell, isMobile ? { width: 40, minWidth: 40 } : { flex: 0.3 }]}>
                    <Text style={styles.tableHeaderCellText}>Read</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.5 }]}>
                    <Text style={styles.tableHeaderCellText}>Type</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, isMobile ? { width: 200, minWidth: 200 } : { flex: 2 }]}>
                    <Text style={styles.tableHeaderCellText}>Title</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, isMobile ? { width: 250, minWidth: 250 } : { flex: 2.5 }]}>
                    <Text style={styles.tableHeaderCellText}>Message</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.2 }]}>
                    <Text style={styles.tableHeaderCellText}>Date</Text>
                  </View>
                </View>

                {/* Table Rows */}
                {notifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.tableRow,
                      !notification.read && styles.tableRowUnread,
                      !isMobile && { minWidth: 1000 }
                    ]}
                    onPress={() => handleNotificationClick(notification)}
                  >
                    <View style={[styles.tableCell, isMobile ? { width: 40, minWidth: 40 } : { flex: 0.3 }]}>
                      {notification.read ? (
                        <Text style={styles.readIndicator}>✓</Text>
                      ) : (
                        <View style={styles.unreadIndicator} />
                      )}
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.5 }]}>
                      <Text style={styles.tableCellText}>{notification.type.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 200, minWidth: 200 } : { flex: 2 }]}>
                      <Text style={[styles.tableCellText, !notification.read && styles.tableCellTextBold]}>
                        {notification.title}
                      </Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 250, minWidth: 250 } : { flex: 2.5 }]}>
                      <Text style={styles.tableCellText} numberOfLines={2}>
                        {notification.message}
                      </Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.2 }]}>
                      <Text style={styles.tableCellText}>{formatDate(notification.created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </View>
      
      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
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
    color: palette.text,
    fontFamily: theme.typography.fontFamily.display,
  },
  markAllReadButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: palette.primary,
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
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
    color: palette.muted,
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
    color: palette.muted,
    fontFamily: theme.typography.fontFamily.body,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tableScroll: {
    minWidth: '100%',
  },
  tableContainer: {
    position: 'relative',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: '#F8FAFC',
  },
  tableHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tableHeaderCellText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
  },
  tableRowUnread: {
    backgroundColor: '#FFF9F7',
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  readIndicator: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  tableCellText: {
    fontSize: 14,
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  tableCellTextBold: {
    fontWeight: '600',
  },
});
