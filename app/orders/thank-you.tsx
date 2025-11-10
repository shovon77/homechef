'use client';

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';

const BG_LIGHT = '#ffffff';
const BG_DARK = '#102216';
const TAL0_GREEN = '#294B29';
const PRIMARY = '#13ec5b';
const TEXT_GRAY = '#4F4F4F';
const TEXT_DARK = '#111813';

export default function OrderThankYouPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [pickupAt, setPickupAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!params.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('pickup_at')
        .eq('id', Number(params.id))
        .maybeSingle();
      if (!error && mounted) {
        setPickupAt(data?.pickup_at ?? null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  return (
    <Screen
      scroll
      contentPadding={0}
      style={{ backgroundColor: BG_LIGHT }}
      {...{ contentContainerStyle: styles.scrollContent }}
    >
      <View style={styles.container}>
        <View style={styles.heroCircle}>
          <Text style={styles.heroIcon}>🍽️</Text>
        </View>
        <Text style={styles.title}>Thank you for your order!</Text>
        <Text style={styles.subtitle}>
          Enjoy your delicious, home-cooked meal! Your support means the world to our local chefs.
        </Text>
        {pickupAt ? (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupLabel}>Pickup time</Text>
            <Text style={styles.pickupValue}>{formatLocal(pickupAt)}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Rate Your Chef</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    paddingTop: 48,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  heroCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: TAL0_GREEN + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  heroIcon: {
    fontSize: 72,
    color: TAL0_GREEN,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: TAL0_GREEN,
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_GRAY,
    textAlign: 'center',
    fontSize: 16,
    maxWidth: 360,
  },
  pickupCard: {
    backgroundColor: '#F4F6F4',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  pickupLabel: {
    color: TEXT_GRAY,
    fontSize: 14,
  },
  pickupValue: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: TAL0_GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TAL0_GREEN,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: TAL0_GREEN,
    fontSize: 16,
    fontWeight: '700',
  },
});
