'use client';

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';
import { safeToFixed } from '../../lib/number';
import { formatCad } from '../../lib/money';

const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const PRIMARY = '#2C4E4B';

type OrderSummary = {
  id: number;
  status: string;
  pickup_at: string | null;
  chef_id: number | null;
  total_cents: number;
  created_at: string;
};

export default function CheckoutSubmitted() {
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = params.id ? Number(params.id) : null;
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || Number.isNaN(orderId)) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id,status,pickup_at,chef_id,total_cents,created_at')
        .eq('id', orderId)
        .maybeSingle();
      if (error) {
        console.error('fetch order error', error);
      }
      setOrder(data as OrderSummary | null);
      setLoading(false);
    })();
  }, [orderId]);

  if (!orderId) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={styles.card}>
          <Text style={styles.heading}>Order submitted</Text>
          <Text style={styles.subheading}>We could not find that order. Please return to the profile page.</Text>
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>View My Orders</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={PRIMARY} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={styles.card}>
          <Text style={styles.heading}>Order submitted</Text>
          <Text style={styles.subheading}>Order #{orderId} could not be found.</Text>
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>View My Orders</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ alignItems: 'center', padding: 24 }}>
      <View style={styles.card}>
        <Text style={styles.heading}>Order submitted</Text>
        <Text style={styles.orderId}>Order ID: #{order.id}</Text>
        <Text style={styles.status}>Status: Requested</Text>
        <Text style={styles.copy}>Pickup time: {formatLocal(order.pickup_at)}</Text>
        <Text style={styles.copy}>Total: {formatCad((order.total_cents || 0) / 100)}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>View My Orders</Text>
            </TouchableOpacity>
          </Link>
          {order.chef_id ? (
            <Link href={`/chef/${order.chef_id}`} asChild>
              <TouchableOpacity style={styles.buttonSecondary}>
                <Text style={styles.buttonSecondaryText}>Go to Chef</Text>
              </TouchableOpacity>
            </Link>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  subheading: {
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  orderId: {
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 18,
    marginTop: 8,
  },
  status: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 16,
  },
  copy: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  buttonPrimary: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonSecondaryText: {
    color: PRIMARY,
    fontWeight: '800',
  },
});
