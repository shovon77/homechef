'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, Link, router } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';
import { cents } from '../../lib/money';
import { updateOrderStatus } from '../../lib/orders';

const BG = '#f6f8f8';
const CARD_BG = '#FFFFFF';
const BORDER = '#E3E7E7';
const TEXT_DARK = '#111817';
const TEXT_MUTED = '#638886';
const PRIMARY = '#2D6966';
const ACCENT = '#2D6966';

const ACTIVE_STATUSES = ['requested', 'pending', 'ready', 'paid'] as const;
const STATUS_STEPS = ['requested', 'pending', 'ready', 'completed'] as const;

const STEP_META: Record<string, { label: string; icon: string }> = {
  requested: { label: 'Order Placed', icon: '🧾' },
  pending: { label: 'In the Kitchen', icon: '👩‍🍳' },
  ready: { label: 'Ready for Pickup', icon: '🛍️' },
  completed: { label: 'Completed', icon: '✅' },
  rejected: { label: 'Rejected', icon: '❌' },
};

type OrderRow = {
  id: number;
  user_id: string;
  chef_id: number | null;
  status: string;
  total_cents: number;
  pickup_at: string | null;
  created_at: string;
};

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
  image?: string | null;
  price?: number | null;
};

type ChefRow = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
};

export default function TrackOrderPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<(OrderItemRow & { dish?: DishRow | null })[]>([]);
  const [chef, setChef] = useState<ChefRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please sign in to track your orders.');
          setOrder(null);
          setItems([]);
          setChef(null);
          setLoading(false);
          return;
        }

        let selectedOrder: OrderRow | null = null;

        if (params.id) {
          const r = await supabase
            .from('orders')
            .select('*')
            .eq('id', Number(params.id))
            .eq('user_id', user.id)
            .maybeSingle();
          if (!r.error) selectedOrder = r.data as OrderRow | null;
        }

        if (!selectedOrder) {
          const r = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ACTIVE_STATUSES as any)
            .order('created_at', { ascending: false })
            .limit(1);
          if (!r.error && Array.isArray(r.data) && r.data.length > 0) {
            selectedOrder = r.data[0] as OrderRow;
          }
        }

        if (!selectedOrder) {
          setOrder(null);
          setItems([]);
          setChef(null);
          setLoading(false);
          return;
        }

        if (mounted) setOrder(selectedOrder);

        const itemRes = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', selectedOrder.id);
        const itemRows = Array.isArray(itemRes.data) ? (itemRes.data as OrderItemRow[]) : [];

        if (itemRows.length) {
          const dishIds = itemRows.map(it => it.dish_id).filter((id): id is number => typeof id === 'number');
          const dishRes = dishIds.length
            ? await supabase.from('dishes').select('id,name,image,price').in('id', dishIds)
            : { data: [] };
          const dishMap = new Map<number, DishRow>();
          (dishRes.data ?? []).forEach(d => dishMap.set(d.id, d as DishRow));
          if (mounted) setItems(itemRows.map(it => ({ ...it, dish: it.dish_id ? dishMap.get(it.dish_id) ?? null : null })));
        } else if (mounted) {
          setItems([]);
        }

        if (selectedOrder.chef_id) {
          const chefRes = await supabase
            .from('chefs')
            .select('id,name,email,phone,location')
            .eq('id', selectedOrder.chef_id)
            .maybeSingle();
          if (!chefRes.error && mounted) setChef(chefRes.data as ChefRow | null);
        } else if (mounted) {
          setChef(null);
        }

        channel = supabase
          .channel(`orders-tracking-${selectedOrder.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${selectedOrder.id}` }, payload => {
            const next = payload.new as OrderRow;
            setOrder(prev => (prev && prev.id === next.id ? next : prev));
          })
          .subscribe();
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Failed to load order');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [params.id]);

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
    [items]
  );
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  if (loading) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center' }} style={{ backgroundColor: BG }}>
        <ActivityIndicator color={PRIMARY} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }} style={{ backgroundColor: BG }}>
        <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Unable to load order</Text>
        <Text style={{ color: TEXT_MUTED, textAlign: 'center' }}>{error}</Text>
        <Link href="/browse" asChild>
          <TouchableOpacity style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Browse dishes</Text>
          </TouchableOpacity>
        </Link>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }} style={{ backgroundColor: BG }}>
        <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>No active orders</Text>
        <Text style={{ color: TEXT_MUTED, marginBottom: 16, textAlign: 'center' }}>Once you place an order you can track it here.</Text>
        <Link href="/browse" asChild>
          <TouchableOpacity style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Browse dishes</Text>
          </TouchableOpacity>
        </Link>
      </Screen>
    );
  }

  const totalCents = Number.isFinite(order.total_cents) ? order.total_cents : subtotalCents;
  const visualStatus = order.status === 'completed' ? 'ready' : order.status;
  const rawIndex = STATUS_STEPS.findIndex(s => s === visualStatus);
  const stepIndex = rawIndex < 0 ? 0 : rawIndex;
  const stepMeta = STEP_META[visualStatus] ?? { label: visualStatus, icon: '•' };

  let statusMessage = '';
  switch (visualStatus) {
    case 'requested':
      statusMessage = 'Waiting for chef approval';
      break;
    case 'pending':
      statusMessage = 'Chef approved — preparing your order';
      break;
    case 'ready':
      statusMessage = 'Your order is ready for pickup';
      break;
    default:
      statusMessage = order.status;
  }

  const showReadyAction = order.status === 'ready' || order.status === 'completed';
  const showRejectedBanner = order.status === 'rejected';
  const showCompletedBadge = order.status === 'completed';

  const chefName = chef?.name ?? 'Chef';

  return (
    <Screen scroll style={{ backgroundColor: BG }} contentPadding={0}>
      <View style={styles.wrapper}>
        <View style={styles.topBar}>
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={{ fontSize: 16 }}>←</Text>
            </TouchableOpacity>
          </Link>
          <Text style={styles.topTitle}>Track Your Order</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${Math.max(0, Math.min(stepIndex, STATUS_STEPS.length - 1)) / (STATUS_STEPS.length - 1 || 1) * 100}%` }]} />
          </View>
          <View style={styles.progressSteps}>
            {STATUS_STEPS.slice(0, 3).map((status, idx) => {
              const meta = STEP_META[status];
              const isActive = idx <= stepIndex;
              return (
                <View key={status} style={styles.progressStep}>
                  <View style={[styles.progressDot, isActive ? styles.progressDotActive : styles.progressDotInactive]}>
                    <Text style={{ fontSize: 16 }}>{meta?.icon ?? '•'}</Text>
                  </View>
                  <Text style={[styles.progressLabel, isActive ? styles.progressLabelActive : styles.progressLabelInactive]}>{meta?.label ?? status}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.heroTitle}>{stepMeta.label}</Text>
        <Text style={styles.statusMessage}>{statusMessage}</Text>

        {showRejectedBanner ? (
          <View style={styles.rejectedBanner}>
            <Text style={styles.rejectedText}>Order was rejected by the chef.</Text>
          </View>
        ) : null}

        {showCompletedBadge ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Order #{String(order.id).padStart(5, '0')}</Text>
          <Text style={styles.cardTitle}>{chefName}'s Kitchen</Text>
          <Text style={styles.cardMeta}>Pickup: {formatLocal(order.pickup_at)}</Text>
          <Text style={styles.cardMeta}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
          {chef?.email ? (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${chef.email}`)}
              style={styles.contactButton}
            >
              <Text style={styles.contactButtonIcon}>💬</Text>
              <Text style={styles.contactButtonText}>Contact Chef</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={{ gap: 12 }}>
            {items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.dish?.name ?? `Dish #${item.dish_id}`} × {item.quantity}
                </Text>
                <Text style={styles.itemPrice}>{cents(item.unit_price_cents * item.quantity)}</Text>
              </View>
            ))}
            {items.length === 0 && <Text style={{ color: TEXT_MUTED }}>No items recorded.</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{cents(subtotalCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fees</Text>
            <Text style={styles.summaryValue}>{cents(0)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: '800', color: TEXT_DARK }]}>Total</Text>
            <Text style={[styles.summaryValue, { fontWeight: '800', color: TEXT_DARK }]}>{cents(totalCents)}</Text>
          </View>
        </View>

        {chef?.location ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pickup Location</Text>
            <Text style={{ color: TEXT_MUTED }}>{chef.location}</Text>
          </View>
        ) : null}

        {showReadyAction ? (
          <TouchableOpacity
            style={styles.readyAction}
            onPress={async () => {
              const { error } = await updateOrderStatus(order.id, 'completed');
              if (error) {
                console.error('complete order error', error);
                return;
              }
              router.replace(`/orders/thank-you?id=${order.id}`);
            }}
          >
            <Text style={styles.readyActionText}>I picked up my order</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 24 }} />
      </View>
      <View style={styles.bottomBar}>
        <Link href="/profile" asChild>
          <TouchableOpacity style={styles.bottomButton}>
            <Text style={styles.bottomButtonText}>View Order Summary</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E9E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 18,
  },
  progressSection: {
    gap: 16,
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D7E2E0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: PRIMARY,
  },
  progressDotInactive: {
    backgroundColor: '#E1E9E8',
  },
  progressLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  progressLabelInactive: {
    color: TEXT_MUTED,
  },
  heroTitle: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  statusMessage: {
    color: TEXT_MUTED,
  },
  rejectedBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
  },
  rejectedText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedText: {
    color: '#15803D',
    fontWeight: '700',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    gap: 8,
  },
  cardLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  cardTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: '800',
  },
  cardMeta: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  contactButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
  },
  contactButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    color: TEXT_DARK,
  },
  itemPrice: {
    color: TEXT_DARK,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryLabel: {
    color: TEXT_MUTED,
  },
  summaryValue: {
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  readyAction: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readyActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  bottomButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ctaPrimary: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
