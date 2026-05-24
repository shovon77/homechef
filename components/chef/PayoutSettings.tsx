import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, Linking, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFn } from '../../lib/fn';
import { theme } from '../../lib/theme';

interface ConnectStatus {
  hasAccount: boolean;
  accountId?: string | null;
  country?: string | null;
  default_currency?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[] } | null;
  loginLink?: string | null;
  error?: string;
}

interface Props {
  /** When an admin views a chef dashboard, load Stripe status for this chef. */
  connectStatusChefId?: number;
  onStatusChange?: (status: ConnectStatus | null, hasAccount: boolean) => void;
}

const ONBOARDING_BENEFITS = [
  'Make your chef store visible to the public',
  'Accept incoming orders from your customers',
  'Instantly receive payments to your bank account',
] as const;

const STORE_SETUP_CARD_TITLE = 'Open store for business';
const STORE_SETUP_CARD_BODY = 'Accept orders & receive payment instantly';

export default function PayoutSettings({ connectStatusChefId, onStatusChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const params = useLocalSearchParams();
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus(null);
        onStatusChangeRef.current?.(null, false);
        return;
      }

      const connectBody = connectStatusChefId != null ? { chef_id: connectStatusChefId } : {};
      const profileAccountId = connectStatusChefId != null
        ? null
        : (await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id', user.id)
            .maybeSingle()).data?.stripe_account_id ?? null;

      try {
        const remoteStatus = await callFn<ConnectStatus>('get-connect-status', connectBody);
        setStatus(remoteStatus);
        const hasAccount = remoteStatus?.hasAccount ?? Boolean(profileAccountId);
        onStatusChangeRef.current?.(remoteStatus, hasAccount);
      } catch (error: any) {
        console.error('get-connect-status error', error);
        Alert.alert('Error', error?.message || 'Failed to load payout status');
        setStatus(profileAccountId ? { hasAccount: true, accountId: profileAccountId } : { hasAccount: false });
        onStatusChangeRef.current?.(null, Boolean(profileAccountId));
      }
    } catch (err: any) {
      console.error('fetch payout status error', err);
      Alert.alert('Error', err?.message || 'Failed to load payout status');
    } finally {
      setLoading(false);
    }
  }, [connectStatusChefId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, params?.onboarding, connectStatusChefId]);

  const openExternal = (url: string) => {
    if (Platform.OS === 'web') {
      // Use location.href (not window.open) - reliable on mobile web, avoids popup blocking
      window.location.href = url;
    } else {
      Linking.openURL(url).catch((err) => console.error('open url error', err));
    }
  };

  const openStripeLink = async () => {
    try {
      setBusy(true);
      const res = await callFn<{ url: string }>('create-onboarding-link', {});
      if (res?.url) {
        openExternal(res.url);
      }
    } catch (err: any) {
      console.error('create-onboarding-link error', err);
      Alert.alert('Error', err?.message || 'Unable to start onboarding');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = () => {
    fetchStatus();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading payout status…</Text>
      </View>
    );
  }

  const payoutsEnabled = Boolean(status?.payouts_enabled);
  const requirements = status?.requirements?.currently_due ?? [];
  const needsMoreInfo = !payoutsEnabled || requirements.length > 0;
  const accountId = status?.accountId ?? null;
  const accountDetailsSubmitted = Boolean(status?.details_submitted);
  const hasAccount = Boolean(status?.hasAccount);
  const onboardingComplete = hasAccount && !needsMoreInfo;
  const needsVerification = hasAccount && needsMoreInfo;
  const stripeLoginLink = status?.loginLink ?? null;

  const pageTitle = onboardingComplete
    ? 'Your bank is connected'
    : needsVerification
      ? 'Action: Verify with Photo ID'
      : 'Action: Connect your bank';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, !onboardingComplete && styles.titleOnboarding]}>
        {pageTitle}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {onboardingComplete
          ? 'Order earnings are deposited to your bank via Stripe'
          : 'Your bank payments are securely powered by Stripe'}
      </Text>

      {!hasAccount && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{STORE_SETUP_CARD_TITLE}</Text>
          <Text style={styles.cardBody}>{STORE_SETUP_CARD_BODY}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && { opacity: 0.8 }]}
              onPress={openStripeLink}
              disabled={busy}
            >
              {busy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                  <Text style={styles.primaryBtnText}>Opening…</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Connect my bank</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {hasAccount && needsMoreInfo && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{STORE_SETUP_CARD_TITLE}</Text>
          <Text style={styles.cardBody}>{STORE_SETUP_CARD_BODY}</Text>
          <View style={styles.buttonRow}>
            {stripeLoginLink ? (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                onPress={() => openExternal(stripeLoginLink)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.primaryBtnText}>Open Stripe</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && { opacity: 0.8 }]}
                onPress={openStripeLink}
                disabled={busy}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {busy ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                    <Text style={styles.primaryBtnText}>Opening…</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Connect my bank</Text>
                )}
              </Pressable>
            )}
            <Pressable style={styles.secondaryBtn} onPress={handleRefresh}>
              <Text style={styles.secondaryBtnText}>Refresh</Text>
            </Pressable>
          </View>
        </View>
      )}

      {hasAccount && !needsMoreInfo && (
        <View style={styles.cardSuccess}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Payouts enabled</Text>
            <Image
              source={require('../../assets/success.png')}
              style={[styles.checkmarkIcon, { tintColor: theme.colors.primary }]}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.cardBody}>You can accept orders and receive payouts.</Text>
          {accountId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account ID</Text>
              <Text style={styles.detailValue}>{accountId}</Text>
            </View>
          )}
          {status?.country && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Country</Text>
              <Text style={styles.detailValue}>{status.country}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Charges</Text>
            <Text style={styles.detailValue}>{status?.charges_enabled ? 'Enabled' : 'Pending'}</Text>
          </View>
          <View style={styles.buttonRow}>
            {stripeLoginLink ? (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                onPress={() => openExternal(stripeLoginLink)}
              >
                <Text style={styles.primaryBtnText}>Open Stripe</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryBtn} onPress={handleRefresh}>
              <Text style={styles.secondaryBtnText}>Refresh</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!onboardingComplete ? (
        <View style={styles.benefitList}>
          {ONBOARDING_BENEFITS.map((line) => (
            <View key={line} style={styles.benefitPill}>
              <Text style={styles.benefitPillText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Chef sales dashboard + theme tokens (Open Sans, brand orange). */
const BRAND = {
  pageBg: '#F2F0EF',
  surface: theme.colors.surfaceLight,
  text: '#33393A',
  textMuted: '#555555',
  primary: theme.colors.primary,
  primaryContrast: theme.colors.primaryContrast,
  border: theme.colors.borderLight,
  warning: theme.colors.warning,
  warningSurface: 'rgba(255, 183, 0, 0.14)',
  primarySurface: theme.colors.primaryLight,
  primaryBorder: 'rgba(254, 115, 76, 0.35)',
} as const;

const FONT_DISPLAY = theme.typography.fontFamily.display;
const FONT_BODY = theme.typography.fontFamily.body;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: BRAND.pageBg,
  },
  wrap: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing['2xl'],
    paddingBottom: 100,
    backgroundColor: BRAND.pageBg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
    backgroundColor: BRAND.pageBg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: BRAND.textMuted,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: FONT_BODY,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold as '700',
    marginBottom: theme.spacing.xs,
    color: BRAND.text,
    fontFamily: FONT_DISPLAY,
  },
  titleOnboarding: {
    color: BRAND.primary,
  },
  subtitle: {
    color: BRAND.textMuted,
    marginBottom: theme.spacing.xl,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
    fontFamily: FONT_BODY,
  },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: BRAND.surface,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardSuccess: {
    borderRadius: theme.radius.lg,
    backgroundColor: BRAND.surface,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  checkmarkIcon: {
    width: 22,
    height: 22,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as '700',
    color: BRAND.text,
    fontFamily: FONT_DISPLAY,
  },
  cardBody: {
    color: BRAND.textMuted,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
    fontFamily: FONT_BODY,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  detailLabel: {
    color: BRAND.textMuted,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: FONT_BODY,
  },
  detailValue: {
    color: BRAND.text,
    fontWeight: theme.typography.fontWeight.semibold as '600',
    fontSize: theme.typography.fontSize.sm,
    marginLeft: theme.spacing.sm,
    fontFamily: FONT_BODY,
  },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    marginRight: theme.spacing.md,
  },
  primaryBtnText: {
    color: BRAND.primaryContrast,
    fontWeight: theme.typography.fontWeight.normal as '400',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: FONT_BODY,
  },
  secondaryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginRight: theme.spacing.sm,
    backgroundColor: BRAND.surface,
  },
  secondaryBtnText: {
    color: BRAND.text,
    fontWeight: theme.typography.fontWeight.normal as '400',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: FONT_BODY,
  },
  benefitList: {
    gap: 10,
  },
  benefitPill: {
    alignSelf: 'stretch',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  benefitPillText: {
    color: BRAND.text,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
    fontFamily: FONT_BODY,
  },
});
