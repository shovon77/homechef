'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet, Linking, Platform, Image, useWindowDimensions, Modal, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import Screen from '../../components/Screen';
import { useCart } from '../../context/CartContext';
import { getChefById } from '../../lib/db';
import { combineLocalDateTime, isValidPickup, getAvailableDatesForChef, getTimeSlotsForDate } from '../../lib/datetime';
import { safeToFixed } from '../../lib/number';
import { submitCheckout } from '../../lib/orders';
import ENV from '@/lib/env';
import { formatCad } from '../../lib/money';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { formatLocationDisplay } from '../../lib/formatAddress';

const BACKGROUND = '#F2F0EF';
const BORDER = '#E5E7EB';
const BORDER_COLOR = '#e7f3f0';
const PRIMARY = '#2C4E4B';
const PRIMARY_COLOR = '#FE734C';
const ACCENT = '#1dbf73';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const BRAND_BLACK = '#33393A';
const CART_ITEM_IMAGE_SIZE = 96;
const CART_ITEM_IMAGE_PAD = theme.spacing.sm;
const CART_ITEM_CONTENT_LEFT = CART_ITEM_IMAGE_PAD + CART_ITEM_IMAGE_SIZE + theme.spacing.md;
const CART_ITEM_MIN_HEIGHT = CART_ITEM_IMAGE_SIZE + CART_ITEM_IMAGE_PAD * 2 + theme.spacing.lg;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartChefId, isReady } = useCart();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [chefName, setChefName] = useState<string | null>(null);
  const [chefLocation, setChefLocation] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [chefPickupAvailability, setChefPickupAvailability] = useState<Array<{ day: string; timeWindow: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cartChefId) {
        if (!cancelled) {
          setChefName(null);
          setChefLocation(null);
          setChefPickupAvailability(null);
        }
        return;
      }

      const chef = await getChefById(cartChefId);
      if (cancelled) return;

      setChefName(chef?.name ?? null);

      const availability = chef?.pickup_availability;
      if (Array.isArray(availability) && availability.length > 0) {
        setChefPickupAvailability(availability);
      } else {
        setChefPickupAvailability(null);
      }

      // Pickup location should come from the chef's profile record (fallback to chefs.location).
      let pickupLocation: string | null = chef?.location ?? null;
      try {
        if (chef?.user_id) {
          const { data } = await supabase
            .from('profiles')
            .select('location')
            .eq('id', chef.user_id)
            .maybeSingle();
          const loc = (data as any)?.location;
          if (typeof loc === 'string' && loc.trim().length > 0) {
            pickupLocation = loc.trim();
          }
        } else if (chef?.email) {
          const { data } = await supabase
            .from('profiles')
            .select('location')
            .eq('email', chef.email)
            .maybeSingle();
          const loc = (data as any)?.location;
          if (typeof loc === 'string' && loc.trim().length > 0) {
            pickupLocation = loc.trim();
          }
        }
      } catch (e) {
        // Non-blocking: fall back to chefs.location if profiles fetch fails.
      }

      if (!cancelled) {
        setChefLocation(pickupLocation);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cartChefId]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  // Platform service fee: flat $1.50
  const platformFee = 1.50;
  // Total (customer): subtotal + platform service fee
  // Note: Platform commission (10% of subtotal) is deducted from chef's payout, not paid by customer
  const total = useMemo(() => subtotal + platformFee, [subtotal, platformFee]);
  const totalCents = useMemo(() => Math.round(total * 100), [total]);
  
  // If chef has pickup_availability, only show dates whose weekday matches.
  // Otherwise fall back to next 3 days from tomorrow.
  const availableDates = useMemo(() => {
    if (chefPickupAvailability && chefPickupAvailability.length > 0) {
      return getAvailableDatesForChef(chefPickupAvailability);
    }

    const now = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() + 1 + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [chefPickupAvailability]);

  // Show time slots only after a date is selected.
  // If chef has pickup_availability, filter to their configured windows; otherwise full 8AM-8PM.
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];

    if (chefPickupAvailability && chefPickupAvailability.length > 0) {
      return getTimeSlotsForDate(chefPickupAvailability, selectedDate);
    }

    // Fallback: full 8AM-8PM range
    const slots: Array<{ value: string; label: string }> = [];
    for (let hour = 8; hour <= 20; hour++) {
      const hour24 = hour.toString().padStart(2, '0');
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      slots.push({ value: `${hour24}:00`, label: `${hour12}:00 ${ampm}` });
    }
    return slots;
  }, [selectedDate, chefPickupAvailability]);
  
  // Check if date and time are both selected
  const isFormValid = selectedDate !== null && selectedTime.trim().length > 0;

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

    if (!selectedDate || !selectedTime) {
      Alert.alert('Pickup time required', 'Please choose a pickup date and time.');
      return;
    }

    // Combine selected date and time
    const [hour, minute] = selectedTime.split(':').map(Number);
    const combined = new Date(selectedDate);
    combined.setHours(hour, minute, 0, 0);

    // Validate that the date is within the allowed range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 1); // Tomorrow
    const maxDate = new Date(today);
    const maxDaysAhead = (chefPickupAvailability && chefPickupAvailability.length > 0) ? 14 : 3;
    maxDate.setDate(today.getDate() + maxDaysAhead);
    
    if (combined < minDate || combined > maxDate) {
      Alert.alert('Invalid date', `Pickup must be within the next ${maxDaysAhead} days.`);
      return;
    }

    if (hour < 8 || hour > 20) {
      Alert.alert('Invalid time', 'Pickup time must be between 8:00 AM and 8:00 PM.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Get base URL for success/cancel redirects
      let baseUrl: string;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const origin = window.location.origin;
        // When running locally, always redirect back to local app
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          baseUrl = origin;
        } else {
          baseUrl = ENV.WEB_BASE_URL || origin;
        }
      } else {
        baseUrl = ENV.WEB_BASE_URL || 'https://yourhomechef.ca';
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      const successUrl = `${baseUrl}/order/success?orderId={ORDER_ID}`;
      const cancelUrl = `${baseUrl}/cart`;

      // Log the URLs being sent for debugging
      console.log('Checkout URLs:', { baseUrl, successUrl, cancelUrl, pickupAt: combined });

      const checkoutPromise = submitCheckout({
        items: items.map(item => ({
          dish_id: Number(item.id),
          quantity: Number(item.quantity),
          notes: item.notes,
        })),
        chef_id: Number(cartChefId),
        pickupAt: combined,
        successUrl,
        cancelUrl,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Checkout is taking too long. Please try again.')), 30000)
      );

      const url = await Promise.race([checkoutPromise, timeoutPromise]);

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

  if (!isReady) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND }} contentStyle={styles.emptyContent}>
        <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </Screen>
    );
  }

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
    <Screen scroll style={{ backgroundColor: BACKGROUND }} contentPadding={0} contentStyle={{ paddingBottom: 0, marginBottom: 100 }}>
      <View style={{ maxWidth: 960, width: '100%', alignSelf: 'center', padding: 24, gap: 24 }}>
        {/* Cart Items */}
        <View style={styles.cartItemsList}>
          {items.map((item) => {
            const itemPrice = formatCad(item.price);
            
            return (
              <View key={String(item.id)} style={styles.cartItem}>
                <Link href={`/dish/${item.id}`} asChild>
                  <TouchableOpacity style={styles.cartItemImageLink}>
                    <Image
                      source={{ uri: (item.image as string) || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=60" }}
                      style={styles.cartItemImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </Link>
                <View style={styles.cartItemContent}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.name || "Item"}</Text>
                    {chefName && (
                      <Text style={styles.cartItemChef}>{chefName}</Text>
                    )}
                    {!!item.notes?.trim() && (
                      <Text
                        style={styles.cartItemNotes}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        Notes: {item.notes.trim()}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.cartItemPriceCorner}>
                  <Text style={styles.cartItemPriceCornerText}>{itemPrice}</Text>
                </View>
                <View style={styles.cartItemQtyCorner}>
                  <Text style={styles.cartItemQtyCornerText}>{item.quantity}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummaryCard}>
          <Text style={styles.priceBreakdownTitle}>Price breakdown</Text>
          <View style={styles.orderSummaryDetails}>
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryLabel}>Subtotal</Text>
              <Text style={styles.orderSummaryValue}>{formatCad(subtotal)}</Text>
                </View>
            <View style={styles.orderSummaryRow}>
              <View style={styles.orderSummaryLabelWithIcon}>
                <Text style={styles.orderSummaryLabel}>Platform service fee </Text>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </View>
              <Text style={styles.orderSummaryValue}>{formatCad(platformFee)}</Text>
            </View>
            <View style={styles.orderSummaryDivider} />
            <View style={styles.orderSummaryRow}>
              <Text style={styles.orderSummaryTotalLabel}>Total</Text>
              <Text style={styles.orderSummaryTotalValue}>{formatCad(total)}</Text>
          </View>
          </View>
          <Text style={styles.platformFeeNote}>ⓘ A small fee supports customer support, marketplace maintenance & secure payments.</Text>
        </View>

        {error && (
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', padding: 16 }}>
            <Text style={{ color: '#DC2626', fontWeight: '700', marginBottom: 4, fontFamily: 'OpenSans_700Bold' }}>Error</Text>
            <Text style={{ color: '#991B1B', fontSize: 14, fontFamily: 'OpenSans_400Regular' }}>{error}</Text>
          </View>
        )}

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, gap: 16 }}>
          <View style={styles.pickupHeader}>
            <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '800', fontFamily: 'OpenSans_700Bold' }}>Preferred pickup</Text>
                <TouchableOpacity
              onPress={() => setShowDateTimePicker(true)}
              style={styles.dateTimePickerButton}
            >
              <Text style={styles.dateTimePickerButtonText}>Date/Time</Text>
                </TouchableOpacity>
          </View>

          {/* Selected date and time */}
          {(selectedDate || selectedTime) && (
            <View style={styles.selectedDateTimeDisplay}>
              {selectedDate && (
                <Text style={styles.selectedDateTimeText}>
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              )}
              {selectedDate && selectedTime && (
                <Text style={styles.selectedDateTimeText}> • </Text>
              )}
              {selectedTime && (
                <Text style={styles.selectedDateTimeText}>
                  {timeSlots.find(slot => slot.value === selectedTime)?.label || selectedTime}
                </Text>
              )}
            </View>
          )}

          <View style={styles.pickupLocationRow}>
            <Text style={styles.pickupLocationLabel}>Pickup location</Text>
            <View style={styles.pickupLocationValueContainer}>
              {chefLocation ? (
                <Text style={styles.pickupLocationValue}>{formatLocationDisplay(chefLocation)}</Text>
              ) : (
                <Text style={styles.pickupLocationValue}>Location not available</Text>
              )}
            </View>
          </View>

          {/* Date/Time Picker Modal */}
          <Modal
            visible={showDateTimePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDateTimePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <TouchableOpacity onPress={() => setShowDateTimePicker(false)}>
                    <Text style={styles.pickerModalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerModalTitle}>Select Date & Time</Text>
                  <TouchableOpacity onPress={() => {
                    if (selectedDate) {
                      setDateInput(selectedDate.toISOString().split('T')[0]);
                    }
                    if (selectedTime) {
                      setTimeInput(selectedTime);
                    }
                    setShowDateTimePicker(false);
                  }}>
                    <Text style={styles.pickerModalConfirm}>Confirm</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inlinePickerContainer}>
                  {/* Date Picker Wheel */}
                  <View style={styles.inlinePickerWheel}>
                    <Text style={styles.inlinePickerLabel}>Date</Text>
                    <ScrollView 
                      style={styles.pickerWheelContainer}
                      contentContainerStyle={styles.pickerWheelContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {availableDates.map((date, index) => {
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        return (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              setSelectedDate(date);
                              setDateInput(date.toISOString().split('T')[0]);
                              setSelectedTime('');
                              setTimeInput('');
                            }}
                            style={[styles.pickerWheelItem, isSelected && styles.pickerWheelItemSelected]}
                          >
                            <Text style={[styles.pickerWheelText, isSelected && styles.pickerWheelTextSelected]}>
                              {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Time Picker Wheel */}
                  <View style={styles.inlinePickerWheel}>
                    <Text style={styles.inlinePickerLabel}>Time</Text>
                    <ScrollView
                      style={styles.pickerWheelContainer}
                      contentContainerStyle={
                        !selectedDate || timeSlots.length === 0
                          ? [styles.pickerWheelContent, styles.pickerTimePlaceholderScrollContent]
                          : styles.pickerWheelContent
                      }
                      showsVerticalScrollIndicator={false}
                    >
                      {!selectedDate ? (
                        <View style={styles.pickerTimePlaceholder}>
                          <Text style={styles.pickerTimePlaceholderText}>
                            Select a date first. Pickup times will appear here.
                          </Text>
                        </View>
                      ) : timeSlots.length === 0 ? (
                        <View style={styles.pickerTimePlaceholder}>
                          <Text style={styles.pickerTimePlaceholderText}>
                            No pickup times for this day.
                          </Text>
                        </View>
                      ) : (
                        timeSlots.map((timeSlot) => {
                          const isSelected = selectedTime === timeSlot.value;
                          return (
                            <TouchableOpacity
                              key={timeSlot.value}
                              onPress={() => {
                                setSelectedTime(timeSlot.value);
                                setTimeInput(timeSlot.value);
                              }}
                              style={[styles.pickerWheelItem, isSelected && styles.pickerWheelItemSelected]}
                            >
                              <Text style={[styles.pickerWheelText, isSelected && styles.pickerWheelTextSelected]}>
                                {timeSlot.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                </View>
              </View>
          </View>
          </Modal>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !isFormValid}
          style={{
            backgroundColor: PRIMARY_COLOR,
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignItems: 'center',
            alignSelf: 'center',
            maxWidth: 200,
            opacity: (submitting || !isFormValid) ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '300', fontFamily: theme.typography.fontFamily.body }}>
              {!isFormValid ? 'Order' : 'Order'}
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
    fontFamily: 'OpenSans_400Regular',
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
    fontFamily: 'OpenSans_700Bold',
  },
  emptySubtitle: {
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'OpenSans_400Regular',
  },
  emptyButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignSelf: 'center',
    maxWidth: 200,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'OpenSans_700Bold',
  },
  cartItemsList: {
    backgroundColor: 'transparent',
    gap: theme.spacing.md,
    overflow: 'visible',
  },
  cartItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
    position: 'relative',
    minHeight: CART_ITEM_MIN_HEIGHT,
    paddingLeft: CART_ITEM_CONTENT_LEFT,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  cartItemContent: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  cartItemImageLink: {
    position: 'absolute',
    left: CART_ITEM_IMAGE_PAD,
    top: CART_ITEM_IMAGE_PAD,
    bottom: CART_ITEM_IMAGE_PAD,
    width: CART_ITEM_IMAGE_SIZE,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cartItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.lg,
    backgroundColor: 'transparent',
  },
  cartItemInfo: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: theme.spacing.xs / 2,
    paddingBottom: theme.spacing.lg,
  },
  cartItemName: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemChef: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemPriceCorner: {
    position: 'absolute',
    left: CART_ITEM_CONTENT_LEFT,
    bottom: theme.spacing.sm,
  },
  cartItemPriceCornerText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemNotes: {
    color: TEXT_DARK,
    opacity: 0.72,
    fontSize: 13,
    fontFamily: 'OpenSans_400Regular',
    lineHeight: 18,
  },
  cartItemQtyCorner: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.sm,
  },
  cartItemQtyCornerText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  priceBreakdownTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700' as any,
    fontFamily: 'OpenSans_700Bold',
    marginBottom: theme.spacing.sm,
  },
  orderSummaryDetails: {
    gap: theme.spacing.md,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSummaryLabel: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  infoIcon: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryDivider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: theme.spacing.xs,
  },
  orderSummaryTotalLabel: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  orderSummaryTotalValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  platformFeeNote: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    marginTop: theme.spacing.sm,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pickerButtonLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    fontWeight: '600' as any,
  },
  pickerButtonValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '50%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pickerModalCancel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  pickerModalTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: 'OpenSans_700Bold',
    fontWeight: '700' as any,
  },
  pickerModalConfirm: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_700Bold',
    fontWeight: '700' as any,
  },
  pickerWheelContainer: {
    maxHeight: 300,
    position: 'relative',
  },
  pickerWheelContent: {
    paddingTop: 20, // Reduced top padding to bring items closer to header
    paddingBottom: 100, // Keep bottom padding for scrolling
    paddingHorizontal: 20,
  },
  pickerTimePlaceholderScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 200,
    paddingBottom: 40,
  },
  pickerTimePlaceholder: {
    paddingHorizontal: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTimePlaceholderText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.xl,
    fontFamily: 'OpenSans_400Regular',
    opacity: 0.4,
    textAlign: 'center',
  },
  pickerWheelItem: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  pickerWheelItemSelected: {
    // Selected item styling handled by text color
  },
  pickerWheelText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.xl,
    fontFamily: 'OpenSans_400Regular',
    opacity: 0.4,
  },
  pickerWheelTextSelected: {
    color: PRIMARY_COLOR,
    fontFamily: 'OpenSans_700Bold',
    fontWeight: '700' as any,
    fontSize: theme.typography.fontSize.xl,
    opacity: 1,
  },
  inlinePickerContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  inlinePickerWheel: {
    flex: 1,
    alignItems: 'center',
  },
  inlinePickerLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: 'OpenSans_700Bold',
    fontWeight: '700' as any,
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  pickupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimePickerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: BACKGROUND,
  },
  dateTimePickerButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    color: BRAND_BLACK,
    fontWeight: '600' as any,
  },
  selectedDateTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: BACKGROUND,
    borderRadius: 8,
  },
  selectedDateTimeText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  pickupLocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  pickupLocationLabel: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '800' as any,
    fontFamily: 'OpenSans_700Bold',
  },
  pickupLocationValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pickupLocationValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    textAlign: 'right',
  },
});
