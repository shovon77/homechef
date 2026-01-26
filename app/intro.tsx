'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions, Image, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../components/Screen';
import { theme } from '../lib/theme';
import Footer from '../components/Footer';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import WelcomeModal from '../components/WelcomeModal';

const PRIMARY_COLOR = '#FE734C';
const BG_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const TEXT_GREY = '#667085';
const BORDER_LIGHT = '#E5E7EB';

export default function IntroPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { loading, user, isAdmin, isChef } = useRole();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [hasReadyOrder, setHasReadyOrder] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Redirect admins and chefs away from intro page
  useEffect(() => {
    if (!loading && user) {
      if (isAdmin) {
        router.replace('/admin');
        return;
      }
      if (isChef) {
        router.replace('/chef');
        return;
      }
    }
  }, [loading, user, isAdmin, isChef, router]);

  // Check for active orders
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) {
        if (mounted) {
          setHasActiveOrder(false);
          setHasReadyOrder(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status')
          .eq('user_id', user.id)
          .in('status', ['requested', 'pending', 'ready', 'paid']);
        if (mounted && !error) {
          const statuses = (data ?? []).map((row: any) => row.status);
          setHasActiveOrder(statuses.length > 0);
          setHasReadyOrder(statuses.includes('ready'));
        } else if (mounted) {
          setHasActiveOrder(false);
          setHasReadyOrder(false);
        }
      } catch (err) {
        if (mounted) {
          setHasActiveOrder(false);
          setHasReadyOrder(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Load notifications
  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      
      // Subscribe to real-time notification updates
      const channel = supabase
        .channel(`intro-notifications-${user.id}`)
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
    } else {
      setNotifications([]);
    }
  }, [user?.id, isAdmin, isChef]);

  // Refresh notifications when dropdown opens - load immediately
  useEffect(() => {
    if (isNotificationsOpen && user?.id) {
      // Load notifications immediately when dropdown opens
      loadNotifications();
    }
  }, [isNotificationsOpen, user?.id]);

  async function loadNotifications() {
    if (!user?.id) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }
    
    setNotificationsLoading(true);
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
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Native Icon Fallbacks - memoized to prevent re-renders and blinking (matching NavBar)
  const MenuIcon = React.useMemo(() => (
    <Image 
      source={require('../assets/menu.png')} 
      style={{ width: 24, height: 24, tintColor: PRIMARY_COLOR }} 
      resizeMode="contain" 
    />
  ), []);
  
  const CloseIcon = React.useMemo(() => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: PRIMARY_COLOR, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: PRIMARY_COLOR, transform: [{ rotate: '-45deg' }] }} />
    </View>
  ), []);

  return (
    <Screen noHeader noFooter style={{ backgroundColor: BG_LIGHT }}>
      {/* Custom minimal navbar matching cart page */}
      <View style={styles.navbar}>
        <View style={styles.navbarContent}>
          {/* Left Section: Logo */}
          <Link href="/" asChild>
            <TouchableOpacity style={styles.logoContainer}>
              <Image
                source={require('../assets/AppLogoFinal2026.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Link>

          {/* Center Section: Order (if active) */}
          {hasActiveOrder && (
            <View style={styles.centerSection}>
              <Link href="/orders/track" asChild>
                <TouchableOpacity style={styles.orderButton}>
                  <Text style={styles.orderButtonText}>Order</Text>
                  {hasReadyOrder ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR, marginLeft: 6 }} /> : null}
                </TouchableOpacity>
              </Link>
            </View>
          )}

          {/* Right Section: FAQ, Notifications, and Menu */}
          <View style={styles.rightSection}>
            <Link href="/faq" asChild>
              <TouchableOpacity style={styles.iconButton}>
                <Text style={styles.faqButtonText}>FAQ</Text>
              </TouchableOpacity>
            </Link>
            {user && (
              <TouchableOpacity 
                onPress={() => setIsNotificationsOpen(!isNotificationsOpen)}
                style={styles.notificationsButton}
              >
                <Image 
                  source={require('../assets/alarm.png')} 
                  style={styles.notificationsIconImage}
                  resizeMode="contain"
                />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => setIsMenuOpen(!isMenuOpen)}
              style={styles.iconButton}
            >
              {isMenuOpen ? CloseIcon : MenuIcon}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Mobile Menu Overlay */}
      {isMobile && isMenuOpen && (
        <View style={styles.mobileMenu}>
          {user ? (
            <>
              <Link href="/profile?tab=settings" asChild>
                <TouchableOpacity
                  onPress={() => setIsMenuOpen(false)}
                  style={styles.mobileMenuItem}
                >
                  <Text style={[styles.mobileMenuText, { color: PRIMARY_COLOR }]}>Profile</Text>
                </TouchableOpacity>
              </Link>
              <TouchableOpacity
                onPress={async () => {
                  setIsMenuOpen(false);
                  await supabase.auth.signOut();
                  router.replace('/auth');
                }}
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
              >
                <Text style={StyleSheet.flatten([styles.mobileMenuText, { color: PRIMARY_COLOR }])}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Link href="/auth" asChild>
                <TouchableOpacity
                  onPress={() => setIsMenuOpen(false)}
                  style={styles.mobileMenuItem}
                >
                  <Text style={styles.mobileMenuText}>Login</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/auth" asChild>
                <TouchableOpacity
                  onPress={() => setIsMenuOpen(false)}
                  style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
                >
                  <Text style={styles.mobileMenuText}>Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </>
          )}
        </View>
      )}

      <View style={styles.container}>
        <View style={styles.content}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to YourHomeChef!</Text>
            <Text style={styles.welcomeSubtitle}>How would you like to use the platform?</Text>
            <Text style={styles.welcomeHint}>You can change it later in your settings.</Text>
          </View>

          {/* Order Food Option */}
          <View style={styles.optionCard}>
            <Text style={styles.optionTitle}>Order homemade food</Text>
            <Text style={styles.optionDescription}>Discover & pick up meals from local chefs.</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/browse')}
            >
              <Text style={styles.actionButtonText}>Start exploring food</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Sell Food Option */}
          <View style={styles.optionCard}>
            <Text style={styles.optionTitle}>Sell dishes as a chef</Text>
            <Text style={styles.optionDescription}>List dishes & manage pickups on your schedule.</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/auth/chef')}
            >
              <Text style={styles.actionButtonText}>Start chef setup</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Unsure Option */}
          <View style={styles.unsureSection}>
            <Text style={styles.unsureText}>Not sure yet? <Link href="/browse?tab=dishes" asChild><Text style={styles.exploreLink}>Explore first.</Text></Link></Text>
            <Link href="/terms" asChild>
              <TouchableOpacity>
                <Text style={styles.learnMoreLink}>Learn more about becoming a chef.</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>

      {/* Notifications Dropdown */}
      {isNotificationsOpen && user && (
        <Pressable 
          style={styles.notificationsOverlay}
          onPress={() => setIsNotificationsOpen(false)}
        >
          <Pressable 
            style={styles.notificationsDropdown}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>Notifications</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsNotificationsOpen(false);
                  router.push('/notifications');
                }}
                style={styles.allNotificationsButton}
              >
                <Text style={styles.allNotificationsButtonText}>All notifications</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, minHeight: 150 }}>
              {notificationsLoading ? (
                <View style={styles.notificationsContent}>
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                  <Text style={[styles.noNotificationsText, { marginTop: 8 }]}>Loading...</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.notificationsContent}>
                  <Text style={styles.noNotificationsText}>No notifications yet!</Text>
                </View>
              ) : (
                <ScrollView 
                  style={styles.notificationsList}
                  contentContainerStyle={styles.notificationsListContent}
                  showsVerticalScrollIndicator={!isMobile}
                >
                  {notifications.map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationItem,
                        !notification.read && styles.notificationItemUnread
                      ]}
                      onPress={async () => {
                        // Mark as read if unread
                        if (!notification.read) {
                          try {
                            const { error } = await supabase
                              .from('notifications')
                              .update({ read: true })
                              .eq('id', notification.id);
                            
                            if (!error) {
                              setNotifications(prev => 
                                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                              );
                            }
                          } catch (err) {
                            console.error('Error marking notification as read:', err);
                          }
                        }
                        
                        // Handle welcome notification - show modal
                        if (notification.type === 'welcome') {
                          setIsNotificationsOpen(false);
                          setShowWelcomeModal(true);
                          return;
                        }
                        
                        // Handle navigation based on notification type
                        if (notification.related_id && notification.related_type === 'order') {
                          router.push(`/orders/track?id=${notification.related_id}`);
                          setIsNotificationsOpen(false);
                        }
                      }}
                    >
                      <View style={styles.notificationItemContent}>
                        <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                        <Text style={styles.notificationItemMessage}>{notification.message}</Text>
                        <Text style={styles.notificationItemTime}>
                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                            timeZone: 'America/New_York',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      {!notification.read && (
                        <View style={styles.notificationUnreadDot} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      <Footer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    paddingHorizontal: Platform.select({
      web: theme.spacing['3xl'],
      default: theme.spacing.md,
    }),
    paddingVertical: theme.spacing.xl,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    gap: theme.spacing['2xl'],
    paddingLeft: Platform.select({
      web: 0,
      default: 0,
    }),
  },
  welcomeSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.display,
  },
  welcomeSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  welcomeHint: {
    fontSize: theme.typography.fontSize.sm,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  optionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  optionDescription: {
    fontSize: theme.typography.fontSize.base,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButton: {
    backgroundColor: PRIMARY_COLOR,
    borderWidth: 1,
    borderColor: TEXT_DARK,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  arrow: {
    fontSize: theme.typography.fontSize.lg,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  unsureSection: {
    gap: theme.spacing.xs,
  },
  unsureText: {
    fontSize: theme.typography.fontSize.base,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  learnMoreLink: {
    fontSize: theme.typography.fontSize.base,
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
    textDecorationLine: 'underline',
  },
  exploreLink: {
    fontSize: theme.typography.fontSize.base,
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
    textDecorationLine: 'underline',
  },
  navbar: {
    backgroundColor: BG_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    paddingBottom: theme.spacing.md,
    paddingTop: 0,
  },
  navbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingRight: Platform.select({
      web: 16,
      default: 8,
    }),
    paddingLeft: 0,
    minHeight: 56, // Ensure consistent height for vertical centering
  },
  logoContainer: {
    marginLeft: -80,
    paddingLeft: 0,
    paddingTop: 0,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: Platform.select({
      web: 280,
      default: 80,
    }),
    height: Platform.select({
      web: 56,
      default: 32,
    }),
  },
  centerSection: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }] as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    display: 'flex',
  },
  notificationsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  notificationsIconImage: {
    width: 20,
    height: 20,
    tintColor: PRIMARY_COLOR,
  },
  faqButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  orderButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  mobileMenu: {
    position: 'absolute',
    top: 60, // Below navbar
    right: 0,
    width: '50%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_LIGHT,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 4,
      },
    }),
    zIndex: 1000,
  },
  mobileMenuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mobileMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  notificationsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.select({
      web: 80,
      default: 60,
    }),
    paddingRight: Platform.select({
      web: 16,
      default: 8,
    }),
  },
  notificationsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: Platform.select({
      web: 400,
      default: '90%',
    }),
    minHeight: 200,
    maxHeight: '70%',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.display,
  },
  allNotificationsButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY_COLOR + '15',
  },
  allNotificationsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
  },
  notificationsContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    flex: 1,
  },
  noNotificationsText: {
    fontSize: 14,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
  },
  notificationsList: {
    flex: 1,
    maxHeight: 400,
  },
  notificationsListContent: {
    padding: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  notificationItemUnread: {
    backgroundColor: '#FFF9F7',
  },
  notificationItemContent: {
    flex: 1,
    gap: 4,
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  notificationItemMessage: {
    fontSize: 13,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
  },
  notificationItemTime: {
    fontSize: 11,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 4,
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY_COLOR,
    alignSelf: 'center',
    marginLeft: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
});

