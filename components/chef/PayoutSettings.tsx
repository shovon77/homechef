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
  capabilities?: Record<string, unknown> | null;
  loginLink?: string | null;
  error?: string;
}

interface Props {
  onStatusChange?: (status: ConnectStatus | null, hasAccount: boolean) => void;
}

export default function PayoutSettings({ onStatusChange }: Props) {
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

      const profileAccountId = (await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .maybeSingle()).data?.stripe_account_id ?? null;

      try {
        const remoteStatus = await callFn<ConnectStatus>('get-connect-status', {});
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
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, params?.onboarding]);

  const openExternal = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
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
        <ActivityIndicator size="large" color="#FE734C" />
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Payout settings</Text>
      <Text style={styles.subtitle}>Connect your Stripe account to receive payouts.</Text>

      {!hasAccount && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No payout account yet</Text>
          <Text style={styles.cardBody}>Connect with Stripe to start receiving payouts.</Text>
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryBtn} onPress={openStripeLink} disabled={busy}>
              <Text style={styles.primaryBtnText}>{busy ? 'Opening…' : 'Connect with Stripe'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {hasAccount && needsMoreInfo && (
        <View style={styles.cardWarning}>
          <Text style={styles.cardTitle}>More information required</Text>
          <Text style={styles.cardBodyWarning}>
            {requirements.length > 0
              ? 'Stripe needs more details to enable payouts—business info, personal details, and bank account. Click below to complete the setup.'
              : 'Payouts are not enabled yet.'}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryBtn} onPress={openStripeLink} disabled={busy}>
              <Text style={styles.primaryBtnText}>Continue onboarding</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleRefresh}>
              <Text style={styles.secondaryBtnText}>Refresh</Text>
            </Pressable>
            {status?.loginLink && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => openExternal(status.loginLink!)}
              >
                <Text style={styles.secondaryBtnText}>Open Stripe</Text>
              </Pressable>
            )}
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transfers</Text>
            <Text style={styles.detailValue}>
              {status?.capabilities && typeof status.capabilities === 'object'
                ? (status.capabilities as any).transfers?.status ?? 'unknown'
                : 'unknown'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Card payments</Text>
            <Text style={styles.detailValue}>
              {status?.capabilities && typeof status.capabilities === 'object'
                ? (status.capabilities as any).card_payments?.status ?? 'unknown'
                : 'unknown'}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryBtn} onPress={handleRefresh}>
              <Text style={styles.secondaryBtnText}>Refresh</Text>
            </Pressable>
            {status?.loginLink && (
              <Pressable style={styles.primaryBtn} onPress={() => openExternal(status.loginLink!)}>
                <Text style={styles.primaryBtnText}>Open Stripe</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>Orders can only be accepted when payouts are enabled. Complete onboarding to proceed with the next steps.</Text>
      </View>
    </ScrollView>
  );
}

const NAVBAR_BG = '#F2F0EF';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: NAVBAR_BG,
  },
  wrap: {
    padding: 24,
    paddingBottom: 100,
    backgroundColor: NAVBAR_BG,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#555555',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    color: '#1E1E1E',
  },
  subtitle: {
    color: '#636363',
    marginBottom: 20,
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  cardWarning: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    padding: 16,
    marginBottom: 16,
  },
  cardInfo: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: 16,
    marginBottom: 16,
  },
  cardSuccess: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7CC',
    backgroundColor: '#FFF4F1',
    padding: 16,
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checkmarkIcon: {
    width: 22,
    height: 22,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardBody: {
    color: '#4B5563',
    marginBottom: 12,
  },
  cardBodyWarning: {
    color: '#92400E',
    marginBottom: 12,
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
    paddingVertical: 4,
  },
  detailLabel: {
    color: '#4B5563',
    fontSize: 13,
  },
  detailValue: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
  },
  primaryBtn: {
    backgroundColor: '#FE734C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
  },
  secondaryBtnText: {
    color: '#1F2937',
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  infoText: {
    color: '#374151',
    fontSize: 13,
  },
});
