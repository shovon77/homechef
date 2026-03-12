'use client';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../components/Screen';
import Footer from '../components/Footer';
import { theme } from '../lib/theme';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { isLocalAdmin } from '../lib/admin';

const PRIMARY_COLOR = '#FE734C';
const BRAND_BLACK = '#33393A';
const BG_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const TEXT_GREY = '#667085';

export default function IntroPage() {
  const router = useRouter();
  const { loading, user, isAdmin, isChef } = useRole();

  // Redirect admins and chefs away from intro page
  useEffect(() => {
    let mounted = true;
    let checkInterval: NodeJS.Timeout | null = null;

    async function checkAndRedirect() {
      // If AuthContext has loaded and we have user info, use it
      if (!loading && user) {
        if (isAdmin) {
          router.replace('/admin');
          return;
        }
        if (isChef) {
          router.replace('/chef');
          return;
        }
        return;
      }

      // If still loading, check session directly as fallback
      if (loading) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return;

          // Fetch profile to determine role
          const [profileResult, chefResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('is_admin, is_chef')
              .eq('id', session.user.id)
              .maybeSingle(),
            session.user.email
              ? supabase
                  .from('chefs')
                  .select('status, is_active')
                  .eq('email', session.user.email)
                  .maybeSingle()
              : Promise.resolve({ data: null })
          ]);

          if (!mounted) return;

          const profile = profileResult.data;
          const chefData = chefResult.data;

          // Check if admin (from profile or email)
          const isAdminFromEmail = isLocalAdmin(session.user);
          const isAdminFromProfile = profile?.is_admin === true;
          const isAdminCheck = isAdminFromProfile || isAdminFromEmail;

          // Check if chef
          let isChefCheck = profile?.is_chef === true;
          if (isChefCheck && chefData) {
            const chefIsInactive = chefData.status === 'inactive' || chefData.is_active === false;
            if (chefIsInactive) {
              isChefCheck = false;
            }
          } else if (!isChefCheck && chefData) {
            const chefIsActive = chefData.status !== 'inactive' && chefData.is_active !== false;
            if (chefIsActive) {
              isChefCheck = true;
            }
          }

          // Redirect based on role
          if (isAdminCheck) {
            router.replace('/admin');
            return;
          }
          if (isChefCheck) {
            router.replace('/chef');
            return;
          }
        } catch (err) {
          console.warn('Error checking role for redirect:', err);
        }
      }
    }

    // Check immediately
    checkAndRedirect();

    // Also set up an interval to check periodically if still loading
    // This handles cases where AuthContext is slow to update
    if (loading) {
      checkInterval = setInterval(() => {
        if (mounted) {
          checkAndRedirect();
        }
      }, 500); // Check every 500ms

      // Clear interval after 5 seconds (fallback timeout)
      setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }, 5000);
    }

    return () => {
      mounted = false;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [loading, user, isAdmin, isChef, router]);

  return (
    <Screen style={{ backgroundColor: BG_LIGHT }} noFooter>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to <Text style={{ color: PRIMARY_COLOR }}>YourHomeChef</Text></Text>
            <Text style={styles.welcomeSubtitle}>How would you like to use the platform?</Text>
            <Text style={styles.welcomeHint}>You can change it later in your settings.</Text>
          </View>

          {/* Sell Food Option */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>Sell homemade food</Text>
              <Text style={styles.optionDescription}>No sign-up fees. No commitments.{'\n'}Cook from home, whenever you want.</Text>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/auth/chef')}
            >
              <Text style={styles.actionButtonText}>Start chef setup</Text>
            </TouchableOpacity>
          </View>

          {/* Order Food Option */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>Order homemade food</Text>
              <Text style={styles.optionDescription}>Pickup from local chefs nearby.{'\n'}Secure payments. Order with confidence.</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonChef]}
              onPress={() => router.push('/browse')}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextChef]}>Start exploring food</Text>
            </TouchableOpacity>
          </View>

          {/* Unsure Option */}
          <View style={styles.unsureSection}>
            <Text style={styles.unsureText}>
              Not sure what to do?{' '}
              <Link href="/browse?tab=dishes" asChild>
                <Text>
                  <Text style={styles.exploreLink}>Explore</Text>
                  <Text style={styles.unsureText}> the platform first</Text>
                </Text>
              </Link>
              {' or '}
              <Link href="/terms" asChild>
                <Text>
                  <Text style={styles.learnMoreLink}>learn more</Text>
                  <Text style={styles.unsureText}> about becoming a chef</Text>
                </Text>
              </Link>
              .
            </Text>
          </View>
        </View>
      </View>
      <Footer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_LIGHT,
    paddingHorizontal: Platform.select({
      web: theme.spacing['3xl'],
      default: theme.spacing.md,
    }),
    paddingTop: theme.spacing.xl,
    paddingBottom: Platform.select({
      web: theme.spacing.xl,
      default: 100, // Extra space on mobile so unsure section is visible above footer
    }),
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
    fontSize: theme.typography.fontSize.xs,
    color: TEXT_GREY,
    fontFamily: theme.typography.fontFamily.body,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  optionHeader: {
    gap: theme.spacing.xs,
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
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtonChef: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  actionButtonTextChef: {
    color: BRAND_BLACK,
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
  },
  exploreLink: {
    fontSize: theme.typography.fontSize.base,
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.body,
  },
});

