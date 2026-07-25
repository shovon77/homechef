'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';
import { cents } from '../../lib/money';
import { isDeliveryOrder } from '../../lib/chef-fulfillment';
import { formatLocationDisplay } from '../../lib/formatAddress';
import { formatPhone } from '../../lib/formatPhone';
const BG_LIGHT = '#F2F0EF';
const PRIMARY = '#FE734C';
const TEXT_GRAY = '#4F4F4F';
const TEXT_DARK = '#111813';
const BORDER = '#E3E7E7';

type OrderItemRow = {
  id: number;
  order_id: number;
  dish_id: number | null;
  quantity: number;
  unit_price_cents: number;
};

type DishRow = {
  id: number;
  name: string;
};

export default function OrderThankYouPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [isDelivery, setIsDelivery] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState<string | null>(null);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number | null>(null);
  const [items, setItems] = useState<(OrderItemRow & { dish?: DishRow | null })[]>([]);
  const [chefName, setChefName] = useState<string | null>(null);
  const [chefId, setChefId] = useState<number | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [orderTotals, setOrderTotals] = useState<{
    total_cents: number | null;
    subtotal_cents: number | null;
    platform_fee_cents: number | null;
    tax_cents: number | null;
  }>({
    total_cents: null,
    subtotal_cents: null,
    platform_fee_cents: null,
    tax_cents: null,
  });

  useEffect(() => {
    let mounted = true;
    if (!params.id) {
      setLoading(false);
      return;
    }
    
    (async () => {
      try {
        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(
            'pickup_at, delivery_at, fulfillment_method, delivery_address, delivery_phone, delivery_fee_cents, chef_id, total_cents, subtotal_cents, platform_fee_cents, tax_cents'
          )
          .eq('id', Number(params.id))
          .maybeSingle();
        
        if (!orderError && mounted && orderData) {
          const deliveryOrder = isDeliveryOrder(orderData);
          setIsDelivery(deliveryOrder);
          if (deliveryOrder) {
            setScheduledAt(orderData.delivery_at ?? null);
            setDeliveryAddress(orderData.delivery_address?.trim() || null);
            setDeliveryPhone(orderData.delivery_phone?.trim() || null);
            if (typeof orderData.delivery_fee_cents === 'number') {
              setDeliveryFeeCents(orderData.delivery_fee_cents);
            }
          } else {
            setScheduledAt(orderData.pickup_at ?? null);
          }
          setOrderTotals({
            total_cents: typeof orderData.total_cents === 'number' ? orderData.total_cents : null,
            subtotal_cents: typeof orderData.subtotal_cents === 'number' ? orderData.subtotal_cents : null,
            platform_fee_cents: typeof orderData.platform_fee_cents === 'number' ? orderData.platform_fee_cents : null,
            tax_cents: typeof orderData.tax_cents === 'number' ? orderData.tax_cents : null,
          });
          
          // Fetch chef name
          if (orderData.chef_id) {
            setChefId(orderData.chef_id);
            const { data: chefData } = await supabase
              .from('chefs')
              .select('name')
              .eq('id', orderData.chef_id)
              .maybeSingle();
            if (mounted && chefData) {
              setChefName(chefData.name);
            }
          }
        }

        // Fetch order items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', Number(params.id));
        
        if (!itemsError && mounted && itemsData) {
          const itemRows = itemsData as OrderItemRow[];
          
          // Fetch dish names
          const dishIds = itemRows.map(it => it.dish_id).filter((id): id is number => typeof id === 'number');
          if (dishIds.length > 0) {
            const { data: dishesData } = await supabase
              .from('dishes')
              .select('id, name')
              .in('id', dishIds);
            
            const dishMap = new Map<number, DishRow>();
            (dishesData ?? []).forEach(d => dishMap.set(d.id, d as DishRow));
            
            if (mounted) {
              setItems(itemRows.map(it => ({ ...it, dish: it.dish_id ? dishMap.get(it.dish_id) ?? null : null })));
            }
          } else if (mounted) {
            setItems(itemRows);
          }
        }
      } catch (err) {
        console.error('Error loading order:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, [params.id]);

  // Totals match what was charged at checkout (subtotal + optional platform fee + delivery).
  const itemsSubtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
    [items]
  );
  const subtotalCents = orderTotals.subtotal_cents ?? itemsSubtotalCents;
  const platformFeeCents = orderTotals.platform_fee_cents ?? 0;
  const taxesCents = orderTotals.tax_cents ?? 0;
  const deliveryFee = isDelivery ? (deliveryFeeCents ?? 0) : 0;
  const totalCents = useMemo(() => {
    if (orderTotals.total_cents != null && Number.isFinite(orderTotals.total_cents)) {
      return orderTotals.total_cents;
    }
    return subtotalCents + platformFeeCents + taxesCents + deliveryFee;
  }, [orderTotals.total_cents, subtotalCents, platformFeeCents, taxesCents, deliveryFee]);

  const showFulfillmentCard =
    Boolean(scheduledAt) || (isDelivery && (deliveryAddress || deliveryPhone));

  if (loading) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center' }} style={{ backgroundColor: BG_LIGHT }}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentPadding={0}
      style={{ backgroundColor: BG_LIGHT }}
      scrollViewContentStyle={styles.scrollContent}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Thank you for your order!</Text>
        <Text style={styles.subtitle}>
          Enjoy your delicious, home-cooked meal! Your support means the world to our local chefs.
        </Text>
        
        {showFulfillmentCard ? (
          <View style={[styles.pickupCard, isDelivery && styles.fulfillmentCardDelivery]}>
            {isDelivery ? (
              <>
                <Text style={styles.fulfillmentCardTitle}>Delivery details</Text>
                {deliveryPhone ? (
                  <View style={styles.fulfillmentDetailRow}>
                    <Text style={styles.detailSubLabel}>Phone</Text>
                    <Text style={styles.detailSubValue}>
                      {formatPhone(deliveryPhone) || deliveryPhone}
                    </Text>
                  </View>
                ) : null}
                {deliveryAddress ? (
                  <View style={styles.fulfillmentDetailRow}>
                    <Text style={styles.detailSubLabel}>Address</Text>
                    <Text style={styles.detailSubValue}>
                      {formatLocationDisplay(deliveryAddress)}
                    </Text>
                  </View>
                ) : null}
                {scheduledAt ? (
                  <View style={styles.fulfillmentDetailRow}>
                    <Text style={styles.detailSubLabel}>Time</Text>
                    <Text style={styles.detailSubValue}>{formatLocal(scheduledAt)}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.pickupLabel}>Pickup time</Text>
                <Text style={styles.pickupValue}>{formatLocal(scheduledAt!)}</Text>
              </>
            )}
          </View>
        ) : null}

        {/* Order Summary */}
        {items.length > 0 && (
          <View style={styles.summaryCard}>
            <TouchableOpacity 
              style={styles.summaryHeader} 
              onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryTitle}>Order summary</Text>
              <View style={styles.toggleIcon}>
                <Text style={styles.toggleIconText}>{isSummaryExpanded ? '−' : '+'}</Text>
              </View>
            </TouchableOpacity>
            
            {isSummaryExpanded && (
              <>
                {/* Order Items */}
                <View style={styles.itemsContainer}>
                  {items.map(item => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.dish?.name ?? `Dish #${item.dish_id}`} {chefName ? `(${chefName})` : ''}
                      </Text>
                      <View style={styles.itemQuantityPrice}>
                        <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                        <Text style={styles.itemPrice}>{cents(item.unit_price_cents)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                
                <View style={styles.divider} />
                
                {/* Price Breakdown */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Subtotal</Text>
                  <Text style={styles.priceValue}>{cents(subtotalCents)}</Text>
                </View>
                {platformFeeCents > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Platform service fee</Text>
                    <Text style={styles.priceValue}>{cents(platformFeeCents)}</Text>
                  </View>
                )}
                {isDelivery && deliveryFee > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Delivery fee</Text>
                    <Text style={styles.priceValue}>{cents(deliveryFee)}</Text>
                  </View>
                ) : null}
                {taxesCents > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Taxes</Text>
                    <Text style={styles.priceValue}>{cents(taxesCents)}</Text>
                  </View>
                ) : null}
                
                <View style={styles.divider} />
                
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{cents(totalCents)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <Link href="/browse" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Explore</Text>
            </TouchableOpacity>
          </Link>
          <Link href={chefId ? `/chef/${chefId}` : '/browse'} asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Rate your chef</Text>
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
    paddingTop: 24,
    // Room below the in-scroll Footer; Screen also inserts the footer with marginTop: -60 over content above it.
    paddingBottom: 32,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingTop: 16,
    // Keep action buttons above the footer overlap (Screen footer wrapper uses marginTop: -60).
    paddingBottom: 88,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    fontFamily: 'OpenSans_700Bold',
    marginTop: 0,
  },
  subtitle: {
    color: TEXT_GRAY,
    textAlign: 'center',
    fontSize: 16,
    maxWidth: 360,
    fontFamily: 'OpenSans_400Regular',
  },
  pickupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  fulfillmentCardDelivery: {
    alignItems: 'stretch',
    gap: 12,
  },
  fulfillmentCardTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'OpenSans_700Bold',
    width: '100%',
  },
  fulfillmentDetailRow: {
    width: '100%',
    gap: 4,
  },
  detailSubLabel: {
    color: TEXT_GRAY,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  detailSubValue: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: 'OpenSans_400Regular',
  },
  pickupLabel: {
    color: TEXT_GRAY,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  pickupValue: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'OpenSans_700Bold',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    width: '100%',
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    fontFamily: 'OpenSans_700Bold',
  },
  toggleIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconText: {
    color: PRIMARY,
    fontSize: 24,
    fontWeight: '700',
  },
  itemsContainer: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  itemQuantityPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  itemQuantity: {
    color: TEXT_GRAY,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  itemPrice: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
    minWidth: 70,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  priceValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: 'OpenSans_400Regular',
  },
  totalLabel: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'OpenSans_700Bold',
  },
  totalValue: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'OpenSans_400Regular',
  },
  actions: {
    width: '100%',
    maxWidth: 260,
    alignSelf: 'center',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'OpenSans_400Regular',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'OpenSans_400Regular',
  },
});
