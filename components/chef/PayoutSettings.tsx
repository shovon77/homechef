import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, Linking, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { callFn } from '../../lib/fn';

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

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus(null);
        onStatusChange?.(null, false);
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
        onStatusChange?.(remoteStatus, hasAccount);
      } catch (error: any) {
        console.error('get-connect-status error', error);
        Alert.alert('Error', error?.message || 'Failed to load payout status');
        setStatus(profileAccountId ? { hasAccount: true, accountId: profileAccountId } : { hasAccount: false });
        onStatusChange?.(null, Boolean(profileAccountId));
      }
    } catch (err: any) {
      console.error('fetch payout status error', err);
      Alert.alert('Error', err?.message || 'Failed to load payout status');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

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
        <ActivityIndicator size="large" color="#0E7A57" />
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
      <Text style={styles.title}>Payout Settings</Text>
      <Text style={styles.subtitle}>Connect your Stripe account to receive payouts from HomeChef.</Text>

      {!hasAccount && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No payout account yet</Text>
          <Text style={styles.cardBody}>Connect with Stripe to start receiving payouts.</Text>
          <Pressable style={styles.primaryBtn} onPress={openStripeLink} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? 'Opening…' : 'Connect with Stripe'}</Text>
          </Pressable>
        </View>
      )}

      {hasAccount && needsMoreInfo && (
        <View style={styles.cardWarning}>
          <Text style={styles.cardTitle}>More information required</Text>
          {requirements.length > 0 ? (
            <Text style={styles.cardBodyWarning}>Stripe still needs: {requirements.join(', ')}</Text>
          ) : (
            <Text style={styles.cardBodyWarning}>Payouts are not enabled yet.</Text>
          )}
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryBtn} onPress={openStripeLink} disabled={busy}>
              <Text style={styles.primaryBtnText}>Continue onboarding</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleRefresh}>
              <Text style={styles.secondaryBtnText}>Refresh status</Text>
            </Pressable>
            {status?.loginLink && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => openExternal(status.loginLink!)}
              >
                <Text style={styles.secondaryBtnText}>Open Stripe Dashboard</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {hasAccount && !needsMoreInfo && (
        <View style={styles.cardSuccess}>
          <Text style={styles.cardTitle}>Payouts enabled ✅</Text>
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
              <Text style={styles.secondaryBtnText}>Refresh status</Text>
            </Pressable>
            {status?.loginLink && (
              <Pressable style={styles.primaryBtn} onPress={() => openExternal(status.loginLink!)}>
                <Text style={styles.primaryBtnText}>Open Stripe Dashboard</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>Orders can only be accepted when payouts are enabled. Complete onboarding to proceed.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  wrap: {
    padding: 24,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#BBF7D0',
    backgroundColor: '#DCFCE7',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
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
    backgroundColor: '#0E7A57',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    fontWeight: '600',
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
