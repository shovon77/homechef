'use client';

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import Screen from '../../components/Screen';
import { useCart } from '../../context/CartContext';

const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const PRIMARY = '#2D6966';

export default function OrderSuccessPage() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = params.orderId ? Number(params.orderId) : null;
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Order submitted!</Text>
        <Text style={styles.copy}>
          Thanks for supporting our chefs. Your order is requested and will be reviewed shortly.
        </Text>
        {Number.isFinite(orderId) ? (
          <Text style={styles.orderId}>Order #{String(orderId).padStart(5, '0')}</Text>
        ) : null}
        <Link href={Number.isFinite(orderId) ? `/orders/track?id=${orderId}` : '/orders/track'} asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Track your order</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back to home</Text>
          </TouchableOpacity>
        </Link>
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
  orderId: {
    color: PRIMARY,
    fontWeight: '700',
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
    color: TEXT_MUTED,
    fontWeight: '700',
  },
});
