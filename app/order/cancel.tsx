'use client';

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import { callFn } from '../../lib/fn';

const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const PRIMARY = '#2D6966';

export default function OrderCancelPage() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  const orderId = params.orderId ? Number(params.orderId) : null;

  const handleCancelRequest = async () => {
    if (!Number.isFinite(orderId)) {
      Alert.alert('Missing order', 'Unable to cancel this order.');
      return;
    }

    try {
      setCancelling(true);
      await callFn('cancel-payment', { orderId, reason: 'user_cancelled' });
      Alert.alert('Order cancelled', 'We have cancelled your request.');
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Cancel failed', err?.message || 'Could not cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Checkout cancelled</Text>
        <Text style={styles.copy}>
          Your payment was not completed. You can try again or cancel your order request.
        </Text>
        <Link href="/checkout" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={styles.secondaryButton} disabled={cancelling} onPress={handleCancelRequest}>
          <Text style={[styles.secondaryButtonText, cancelling && { opacity: 0.7 }]}>Cancel request</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FCFB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    width: '100%',
    maxWidth: 420,
    gap: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  copy: {
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
});
