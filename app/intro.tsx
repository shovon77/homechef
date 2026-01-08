'use client';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions, Image } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../components/Screen';
import { theme } from '../lib/theme';
import Footer from '../components/Footer';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';

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

  // Native Icon Fallbacks
  const MenuIcon = () => (
    <View style={{ width: 24, height: 24, justifyContent: 'space-around', paddingVertical: 4 }}>
      <View style={{ height: 2, backgroundColor: PRIMARY_COLOR, borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: PRIMARY_COLOR, borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: PRIMARY_COLOR, borderRadius: 1 }} />
    </View>
  );
  const CloseIcon = () => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: PRIMARY_COLOR, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: PRIMARY_COLOR, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );

  return (
    <Screen noHeader noFooter style={{ backgroundColor: BG_LIGHT }}>
      {/* Custom minimal navbar matching cart page */}
      <View style={styles.navbar}>
        <View style={styles.navbarContent}>
          {/* Left Section: Logo */}
          <Link href="/" asChild>
            <TouchableOpacity style={styles.logoContainer}>
              <Image
                source={require('../assets/AppLogoWordFinal2026.png')}
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

          {/* Right Section: FAQ and Menu */}
          <View style={styles.rightSection}>
            <Link href="/faq" asChild>
              <TouchableOpacity style={styles.iconButton}>
                <Text style={styles.faqButtonText}>FAQ</Text>
              </TouchableOpacity>
            </Link>
            <TouchableOpacity 
              onPress={() => setIsMenuOpen(!isMenuOpen)}
              style={styles.iconButton}
            >
              {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
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
    paddingHorizontal: Platform.select({
      web: 16,
      default: 3,
    }),
  },
  logoContainer: {
    marginLeft: Platform.select({
      web: -100,
      default: -100, // Move further left
    }),
  },
  logoImage: {
    width: Platform.select({
      web: 364,
      default: 260,
    }),
    height: Platform.select({
      web: 73,
      default: 52,
    }),
    marginTop: -9,
  },
  centerSection: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }] as any,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 50, // Push Order button to the right, away from logo
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
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
});

