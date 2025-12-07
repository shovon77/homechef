'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet, Linking, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../../components/Screen';
import { useCart } from '../../context/CartContext';
import { getChefById } from '../../lib/db';
import { combineLocalDateTime, isValidPickup } from '../../lib/datetime';
import { safeToFixed } from '../../lib/number';
import { submitCheckout } from '../../lib/orders';
import ENV from '@/lib/env';
import { formatCad } from '../../lib/money';
import { theme } from '../../lib/theme';

const BACKGROUND = '#F2F0EF';
const BORDER = '#E5E7EB';
const PRIMARY = '#2C4E4B';
const ACCENT = '#1dbf73';
const TEXT_DARK = '#FE73FC';
const TEXT_MUTED = '#FE73FC';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartChefId } = useCart();
  const [chefName, setChefName] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cartChefId) {
      getChefById(cartChefId).then(chef => setChefName(chef?.name ?? null));
    } else {
      setChefName(null);
    }
  }, [cartChefId]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const totalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);
  
  // Generate time slots from 8am to 8pm in 30-minute intervals
  // Returns array of { value: 'HH:mm' (24h), label: 'h:mm AM/PM' (12h) }
  // MUST be before any early returns to satisfy Rules of Hooks
  const timeSlots = useMemo(() => {
    const slots: Array<{ value: string; label: string }> = [];
    for (let hour = 8; hour <= 20; hour++) {
      const hour24 = hour.toString().padStart(2, '0');
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      
      slots.push({
        value: `${hour24}:00`,
        label: `${hour12}:00 ${ampm}`,
      });
      if (hour < 20) {
        slots.push({
          value: `${hour24}:30`,
          label: `${hour12}:30 ${ampm}`,
        });
      }
    }
    return slots;
  }, []);

  // Generate upcoming dates - MUST be before any early returns
  const upcomingDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return { iso, label };
    });
  }, []);
  
  // Check if date and time are both selected
  const isFormValid = dateInput.trim().length > 0 && timeInput.trim().length > 0;

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
    setError(null);
    try {
      // Get base URL: prefer env var, then detect from window.location (for production), fallback to localhost
      let baseUrl = ENV.WEB_BASE_URL;
      if (!baseUrl || baseUrl === 'http://localhost:8081') {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Use current origin in production
          baseUrl = window.location.origin;
        } else {
          baseUrl = 'http://localhost:8081';
        }
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      const successUrl = `${baseUrl}/order/success?orderId={ORDER_ID}`;
      const cancelUrl = `${baseUrl}/cart`;

      // Log the URLs being sent for debugging
      console.log('Checkout URLs:', { baseUrl, successUrl, cancelUrl, pickupAt: combined });

      const url = await submitCheckout({
        items: items.map(item => ({
          dish_id: Number(item.id),
          quantity: Number(item.quantity),
        })),
        chef_id: cartChefId,
        pickupAt: combined,
        successUrl,
        cancelUrl,
      });

      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      console.error('Checkout error:', e);
      console.error('Checkout error details:', {
        message: e?.message,
        stack: e?.stack,
        name: e?.name,
      });
      const errorMessage = typeof e?.message === 'string' ? e.message : 'Checkout failed';
      setError(errorMessage);
      if (e?.code === 'CHEF_NOT_ONBOARDED') {
        Alert.alert('Chef not ready', "This chef hasn't completed payouts yet. Please choose another chef.");
      } else {
        Alert.alert('Checkout Error', errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND }} contentStyle={styles.emptyContent}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add a few dishes before checking out.</Text>
          <Link href="/browse" asChild>
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Browse Dishes</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll style={{ backgroundColor: BACKGROUND }} contentPadding={0}>
      <View style={{ maxWidth: 960, width: '100%', alignSelf: 'center', padding: 24, gap: 24 }}>
        <View>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Checkout</Text>
          <Text style={{ color: TEXT_DARK, fontSize: 32, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Confirm your order</Text>
          {chefName && <Text style={{ color: TEXT_MUTED, marginTop: 4, fontFamily: theme.typography.fontFamily.body }}>Chef: {chefName}</Text>}
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, gap: 16 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.fontFamily.display }}>Order Summary</Text>
          <View style={{ gap: 12 }}>
            {items.map(item => (
              <View key={String(item.id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: TEXT_DARK, fontWeight: '700', fontFamily: theme.typography.fontFamily.body }}>{item.quantity}×</Text>
                  <Text style={{ color: TEXT_DARK, fontFamily: theme.typography.fontFamily.body }}>{item.name}</Text>
                </View>
                <Text style={{ color: TEXT_DARK, fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>{formatCad(item.price * item.quantity)}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: BORDER }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 16, fontFamily: theme.typography.fontFamily.body }}>Subtotal</Text>
            <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.fontFamily.display }}>{formatCad(subtotal)}</Text>
          </View>
        </View>

        {error && (
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', padding: 16 }}>
            <Text style={{ color: '#DC2626', fontWeight: '700', marginBottom: 4 }}>Error</Text>
            <Text style={{ color: '#991B1B', fontSize: 14 }}>{error}</Text>
          </View>
        )}

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, gap: 16 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800', fontFamily: theme.typography.fontFamily.display }}>Pickup details</Text>
          <Text style={{ color: TEXT_MUTED, fontFamily: theme.typography.fontFamily.body }}>Choose a pickup date within the next 7 days and a time between 08:00 and 20:00.</Text>

          <View style={{ gap: 12 }}>
            <Text style={{ color: TEXT_MUTED, fontWeight: '700', fontFamily: theme.typography.fontFamily.body }}>Select a date</Text>
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
                  <Text style={{ color: dateInput === d.iso ? PRIMARY : TEXT_DARK, fontFamily: theme.typography.fontFamily.body }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollRow>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ color: TEXT_MUTED, fontWeight: '700', fontFamily: theme.typography.fontFamily.body }}>Pickup time</Text>
            <ScrollRow>
              {timeSlots.map(timeSlot => (
                <TouchableOpacity
                  key={timeSlot.value}
                  onPress={() => setTimeInput(timeSlot.value)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: timeInput === timeSlot.value ? PRIMARY : BORDER,
                    backgroundColor: timeInput === timeSlot.value ? PRIMARY + '15' : 'transparent',
                  }}
                >
                  <Text style={{ color: timeInput === timeSlot.value ? PRIMARY : TEXT_DARK, fontFamily: theme.typography.fontFamily.body }}>
                    {timeSlot.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollRow>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !isFormValid}
          style={{
            backgroundColor: (submitting || !isFormValid) ? TEXT_MUTED : '#123524',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            opacity: (submitting || !isFormValid) ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', fontFamily: theme.typography.fontFamily.body }}>
              {!isFormValid ? 'Please select date and time' : 'Submit order'}
            </Text>
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
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 12,
    fontFamily: theme.typography.fontFamily.display,
  },
  emptySubtitle: {
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: theme.typography.fontFamily.body,
  },
  emptyButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
});
