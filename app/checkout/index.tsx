'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet, Linking, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../../components/Screen';
import { useCart } from '../../context/CartContext';
import { getChefById } from '../../lib/db';
import { combineLocalDateTime, isValidPickup } from '../../lib/datetime';
import { safeToFixed } from '../../lib/number';
import { callFn } from '../../lib/fn';

const BACKGROUND = '#F8FCFB';
const BORDER = '#E5E7EB';
const PRIMARY = '#2C4E4B';
const ACCENT = '#1dbf73';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartChefId } = useCart();
  const [chefName, setChefName] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cartChefId) {
      getChefById(cartChefId).then(chef => setChefName(chef?.name ?? null));
    } else {
      setChefName(null);
    }
  }, [cartChefId]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const totalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('Cart is empty', 'Please add items before checking out.');
      router.replace('/cart');
      return;
    }

    if (!cartChefId) {
      Alert.alert('Missing chef', 'We could not determine the chef for this order. Please clear your cart and try again.');
      return;
    }

    if (!dateInput || !timeInput) {
      Alert.alert('Pickup time required', 'Please choose a pickup date and time.');
      return;
    }

    const combined = combineLocalDateTime(dateInput, timeInput);
    if (!combined) {
      Alert.alert('Invalid date/time', 'Please enter date as YYYY-MM-DD and time as HH:mm.');
      return;
    }

    if (!isValidPickup(combined)) {
      Alert.alert('Pickup outside window', 'Pickup must be within the next 7 days between 08:00 and 20:00.');
      return;
    }

    setSubmitting(true);
    try {
      const pickupISO = combined.toISOString();

      const payload = {
        pickupAtISO: pickupISO,
        items: items.map(item => ({ dishId: Number(item.id), quantity: item.quantity })),
      };

      const { url } = await callFn<{ url: string }>('create-checkout', payload);
      if (!url) {
        throw new Error('Checkout session missing URL');
      }

      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        await Linking.openURL(url);
      }
    } catch (error: any) {
      console.error('Checkout submit error:', error);
      Alert.alert('Checkout Error', error?.message || 'Could not place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: BORDER, width: '90%', maxWidth: 420, gap: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT_DARK }}>Your cart is empty</Text>
          <Text style={{ color: TEXT_MUTED, textAlign: 'center' }}>Add a few dishes before checking out.</Text>
          <Link href="/browse" asChild>
            <TouchableOpacity style={{ backgroundColor: PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Browse Dishes</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Screen>
    );
  }

  const today = new Date();
  const upcomingDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { iso, label };
  });

  const timeHint = 'HH:mm (24h)';

  return (
    <Screen scroll style={{ backgroundColor: BACKGROUND }} contentPadding={0}>
      <View style={{ maxWidth: 960, width: '100%', alignSelf: 'center', padding: 24, gap: 24 }}>
        <View>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, marginBottom: 8 }}>Checkout</Text>
          <Text style={{ color: TEXT_DARK, fontSize: 32, fontWeight: '900' }}>Confirm your order</Text>
          {chefName && <Text style={{ color: TEXT_MUTED, marginTop: 4 }}>Chef: {chefName}</Text>}
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, gap: 16 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800' }}>Order Summary</Text>
          <View style={{ gap: 12 }}>
            {items.map(item => (
              <View key={String(item.id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: TEXT_DARK, fontWeight: '700' }}>{item.quantity}×</Text>
                  <Text style={{ color: TEXT_DARK }}>{item.name}</Text>
                </View>
                <Text style={{ color: TEXT_DARK, fontWeight: '600' }}>${safeToFixed(item.price * item.quantity, 2, '0.00')}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: BORDER }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 16 }}>Subtotal</Text>
            <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800' }}>${safeToFixed(subtotal, 2, '0.00')}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, gap: 16 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800' }}>Pickup details</Text>
          <Text style={{ color: TEXT_MUTED }}>Choose a pickup date within the next 7 days and a time between 08:00 and 20:00.</Text>

          <View style={{ gap: 12 }}>
            <Text style={{ color: TEXT_MUTED, fontWeight: '700' }}>Select a date</Text>
            <ScrollRow>
              {upcomingDates.map(d => (
                <TouchableOpacity
                  key={d.iso}
                  onPress={() => setDateInput(d.iso)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: dateInput === d.iso ? PRIMARY : BORDER,
                    backgroundColor: dateInput === d.iso ? PRIMARY + '15' : 'transparent',
                  }}
                >
                  <Text style={{ color: dateInput === d.iso ? PRIMARY : TEXT_DARK }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollRow>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ color: TEXT_MUTED, fontWeight: '700' }}>Pickup time ({timeHint})</Text>
            <TextInput
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="e.g. 18:30"
              placeholderTextColor={TEXT_MUTED}
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? TEXT_MUTED : ACCENT,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Submit order</Text>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexWrap: 'wrap', flexDirection: 'row', gap: 12 }}>{children}</View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: TEXT_DARK,
    backgroundColor: '#FFFFFF',
  },
});
