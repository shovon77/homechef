'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert, Linking, Platform, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { uploadToBucket } from '../../lib/upload';
import FilePicker from '../../components/FilePicker';
import LocationPicker from '../../components/LocationPicker';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { formatLocal } from '../../lib/datetime';
import { updateOrderStatus } from '../../lib/orders';
import { callFn } from '../../lib/fn';
import PayoutSettings from '../../components/chef/PayoutSettings';
import { formatCad, cents } from '../../lib/money';

// Colors matching homepage
const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';
const BG_LIGHT = '#FFFFFF';
const BG_PAGE = '#F2F0EF';
const BG_GRAY = '#F4F4F4';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#555555';
const BORDER_LIGHT = '#EAECF0';

type ChefRow = { id: number; name: string; email?: string | null; bio?: string | null; photo?: string | null; location?: string | null };
type DishRow = { id: number; chef_id: number | null; name: string; price: number; description?: string | null; ingredients?: string | null; image?: string | null; thumbnail?: string | null; chef?: string | null };
type OrderRow = { id: number; user_id: string; status: string; total_cents: number; platform_fee_cents?: number | null; created_at: string; pickup_at: string | null; stripe_transfer_id?: string | null; order_items?: Array<{ id: number; dish_id: number; dish_name?: string; quantity: number; unit_price_cents: number }>; user_email?: string };

export default function ChefDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chef, setChef] = useState<ChefRow | null>(null);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'orders' | 'reviews' | 'payouts' | 'profile'>('dashboard');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'requested' | 'pending' | 'ready' | 'paid' | 'completed' | 'cancelled' | 'rejected'>('requested');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [chargesEnabled, setChargesEnabled] = useState<boolean>(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [payoutsEnabled, setPayoutsEnabled] = useState<boolean>(false);
  const [earningsRange, setEarningsRange] = useState<'week' | 'month'>('week');
  const [reviews, setReviews] = useState<Array<{ id: number; rating: number; comment: string | null; created_at: string; user_email?: string; user_name?: string }>>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          router.replace('/auth');
          return;
        }
        const email = auth.user.email;
        if (!email) throw new Error('Missing email on session');

        const profileRow = await supabase.from('profiles').select('charges_enabled,stripe_account_id').eq('id', auth.user.id).maybeSingle();
        if (!profileRow.error) {
          setChargesEnabled(profileRow.data?.charges_enabled ?? false);
          setStripeAccountId(profileRow.data?.stripe_account_id ?? null);
          // For Stripe Connect, charges_enabled typically means payouts are also enabled
          setPayoutsEnabled(profileRow.data?.charges_enabled ?? false);
        }

        let me = (await supabase.from('chefs').select('*').eq('email', email).maybeSingle()).data as ChefRow | null;
        if (!me) {
          const defaultName = auth.user.user_metadata?.name || email.split('@')[0];
          const ins = await supabase.from('chefs').insert({ name: defaultName, email }).select('*').single();
          if (ins.error) throw ins.error;
          me = ins.data as ChefRow;
        }
        setChef(me);
        setName(me.name || '');
        setBio(me.bio || '');
        setPhoto(me.photo || undefined);
        setLocation(me.location || '');

        // Load dishes
        const d = await supabase.from('dishes').select('*').eq('chef_id', me.id).order('id', { ascending: true });
        if (d.error) throw d.error;
        setDishes((d.data || []) as DishRow[]);

        await refreshOrdersForChef(me.id);
        await loadReviews(me.id);

      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (dishes.length > 0 && chef) {
      refreshOrdersForChef(chef.id);
    }
  }, [dishes, chef]);

  useEffect(() => {
    if (activeTab === 'reviews' && chef) {
      loadReviews(chef.id);
    }
  }, [activeTab, chef]);

  async function saveProfile() {
    if (!chef) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { error } = await supabase.from('chefs').update({ 
        name: name || chef.name, 
        bio: bio ?? null, 
        photo: photo ?? null,
        location: location.trim() || null
      }).eq('id', chef.id);
      if (error) throw error;
      setChef({ ...chef, name: name || chef.name, bio: bio ?? null, photo: photo ?? null, location: location.trim() || null });
      setMsg('Profile saved ✓');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr('Save failed: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPick(file: File) {
    if (!chef) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { publicUrl } = await uploadToBucket('public-assets', file, `chefs/${chef.id}/avatar`);
      setPhoto(publicUrl);
      const { error } = await supabase.from('chefs').update({ photo: publicUrl }).eq('id', chef.id);
      if (error) throw error;
      setChef({ ...chef, photo: publicUrl });
      setMsg('Avatar updated ✓');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr('Avatar upload failed: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function createDish(d: { name: string; price: number; description?: string; ingredients?: string; file?: File | null; preview?: string }) {
    if (!chef) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const ins = await supabase.from('dishes').insert({
        chef_id: chef.id,
        chef: name || chef.name,
        name: d.name,
        price: d.price,
        description: d.description || null,
        ingredients: d.ingredients || null
      }).select('*').single();
      if (ins.error) throw ins.error;
      const created = ins.data as DishRow;

      if (d.file) {
        const { publicUrl } = await uploadToBucket('dish-images', d.file, `chefs/${chef.id}/dishes/${created.id}`);
        const up = await supabase.from('dishes').update({ image: publicUrl, thumbnail: publicUrl }).eq('id', created.id);
        if (up.error) throw up.error;
        created.image = publicUrl;
        created.thumbnail = publicUrl;
      }

      setDishes(p => [...p, created]);
      setMsg('Dish created ✓');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr('Create dish failed: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function startOnboarding() {
    try {
      setSaving(true);
      const { url } = await callFn<{ url: string }>('create-onboarding-link');
      if (url) {
        if (Platform.OS === 'web') {
          window.location.href = url;
        } else {
          await Linking.openURL(url);
        }
      }
    } catch (error: any) {
      Alert.alert('Stripe onboarding failed', error?.message || 'Unable to start onboarding');
    } finally {
      setSaving(false);
    }
  }

  async function updateDish(p: { id: number; name?: string; price?: number | string; description?: string; ingredients?: string; file?: File | null; preview?: string }) {
    if (!chef) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const payload: any = {};

      if (typeof p.name !== 'undefined') payload.name = p.name;
      if (typeof p.price !== 'undefined' && p.price !== null && p.price !== '') {
        const n = Number(p.price);
        if (!Number.isFinite(n)) throw new Error('Price must be a number');
        payload.price = n;
      }
      if (typeof p.description !== 'undefined') payload.description = p.description || null;
      if (typeof p.ingredients !== 'undefined') payload.ingredients = p.ingredients || null;

      if (p.file) {
        const { publicUrl } = await uploadToBucket('dish-images', p.file, `chefs/${chef!.id}/dishes/${p.id}`);
        payload.image = publicUrl;
        payload.thumbnail = publicUrl;
      }

      const { error } = await supabase.from('dishes').update(payload).eq('id', p.id);
      if (error) throw error;

      setDishes(prev =>
        prev.map(d =>
          d.id === p.id ? { ...d, ...payload } as DishRow : d
        )
      );

      setMsg('Dish updated ✓');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr('Update dish failed: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDish(id: number) {
    if (!chef) return;
    Alert.alert('Delete Dish', 'Are you sure you want to delete this dish?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setMsg(null);
          setErr(null);
          try {
            const { error } = await supabase.from('dishes').delete().eq('id', id);
            if (error) throw error;
            setDishes(prev => prev.filter(d => d.id !== id));
            setMsg('Dish deleted ✓');
            setTimeout(() => setMsg(null), 3000);
          } catch (e: any) {
            setErr('Delete failed: ' + (e.message || String(e)));
          } finally {
            setSaving(false);
          }
        }
      }
    ]);
  }

  async function updateOrderStatus(orderId: number, newStatus: string) {
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setMsg('Order updated ✓');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr('Failed to update order: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function handleOrderStatus(id: number, status: 'pending' | 'rejected' | 'ready') {
    if (!chef) return;
    try {
      const response = await updateOrderStatus(id, status);
      if (response && 'error' in response && response.error) {
        Alert.alert('Update failed', response.error.message);
        return;
      }
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to update order status');
      return;
    }
    await refreshOrdersForChef(chef.id);
  }

  async function refreshOrdersForChef(chefId: number) {
    try {
      // Show orders that are ready for chef to process
      // Fetch all 'requested' orders and filter for paid ones
      // Include: payment_status='succeeded' OR (payment_status IS NULL AND has stripe_payment_intent_id)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id,user_id,status,total_cents,platform_fee_cents,created_at,pickup_at,chef_id,stripe_transfer_id,payment_status,stripe_payment_intent_id,checkout_session_id')
        .eq('chef_id', chefId)
        .eq('status', 'requested')
        .order('created_at', { ascending: false });

      if (error || !ordersData) {
        if (error) console.error('load chef orders error', error);
        setOrders([]);
        return;
      }

      // Client-side filter: ONLY show orders where payment was successfully processed
      // This is strict to ensure chefs only see paid orders
      // Include:
      // 1. payment_status = 'succeeded' (confirmed paid - webhook updated)
      // 2. payment_status IS NULL AND stripe_payment_intent_id IS NOT NULL (legacy paid orders)
      // Exclude: 'awaiting_payment', 'failed', 'canceled', or any other non-success status
      // Note: Orders with 'awaiting_payment' are NOT shown until webhook updates them to 'succeeded'
      const filteredOrders = ordersData.filter(order => {
        const paymentStatus = order.payment_status;
        const hasPaymentIntent = !!order.stripe_payment_intent_id;
        
        // Only show if:
        // 1. payment_status is explicitly 'succeeded' (confirmed paid)
        // 2. payment_status is null but has payment intent (legacy paid order from before payment_status tracking)
        if (paymentStatus === 'succeeded') return true;
        if (paymentStatus === null && hasPaymentIntent) return true;
        
        // For orders with 'awaiting_payment' status, verify payment in background but DON'T show them
        // They will appear after webhook updates payment_status to 'succeeded'
        if (paymentStatus === 'awaiting_payment' && (order.stripe_payment_intent_id || order.checkout_session_id)) {
          // Verify payment status from Stripe asynchronously to update the order
          // This helps fix orders where webhook didn't fire, but we don't show them until verified
          supabase.functions.invoke('verify-payment', {
            body: { orderId: order.id },
          })
          .then(result => {
            console.log('Payment verification result for order', order.id, result);
            // If payment was verified, refresh orders to show the updated order
            if (result?.paymentSucceeded && result?.updated) {
              // Refresh orders after a short delay to allow DB update to propagate
              setTimeout(() => {
                refreshOrdersForChef(chefId);
              }, 1000);
            }
          })
          .catch(err => {
            console.warn('Failed to verify payment for order', order.id, err);
          });
        }
        
        return false;
      });

      const orderIds = filteredOrders.map(o => o.id);
      const userIds = [...new Set(filteredOrders.map(o => o.user_id))];

      const { data: itemsData, error: itemsError } = orderIds.length > 0
        ? await supabase.from('order_items').select('id,order_id,dish_id,quantity,unit_price_cents').in('order_id', orderIds)
        : { data: [], error: null };
      if (itemsError) console.warn('order_items fetch error', itemsError);

      const dishIds = [...new Set((itemsData || []).map(item => item.dish_id).filter(Boolean))];
      const { data: dishesData } = dishIds.length > 0
        ? await supabase.from('dishes').select('id,name').in('id', dishIds as number[])
        : { data: [], error: null };
      const dishMap = new Map((dishesData || []).map((d: any) => [d.id, d.name]));

      const { data: profilesData, error: profilesError } = userIds.length > 0
        ? await supabase.from('profiles').select('id,email,charges_enabled').in('id', userIds)
        : { data: [], error: null };
      if (profilesError) console.warn('profiles fetch error', profilesError);
      const emailMap = new Map((profilesData || []).map((p: any) => [p.id, p.email || '']));

      const itemsByOrderId = new Map<number, OrderRow['order_items']>();
      (itemsData || []).forEach((item: any) => {
        if (!itemsByOrderId.has(item.order_id)) {
          itemsByOrderId.set(item.order_id, []);
        }
        itemsByOrderId.get(item.order_id)!.push({
          id: item.id,
          dish_id: item.dish_id,
          dish_name: item.dish_id ? dishMap.get(item.dish_id) ?? 'Dish' : undefined,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        });
      });

      const mapped = filteredOrders.map(order => ({
        id: order.id,
        user_id: order.user_id,
        status: order.status,
        total_cents: order.total_cents ?? 0,
        created_at: order.created_at,
        pickup_at: order.pickup_at ?? null,
        user_email: emailMap.get(order.user_id) ?? undefined,
        platform_fee_cents: order.platform_fee_cents ?? 0,
        order_items: itemsByOrderId.get(order.id) ?? [],
        stripe_transfer_id: order.stripe_transfer_id ?? undefined,
      }));

      setOrders(mapped);
    } catch (error) {
      console.error('refreshOrdersForChef error', error);
      setOrders([]);
    }
  }

  // Calculate analytics
  const topDishes = useMemo(() => {
    const dishCounts: Record<number, number> = {};
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        if (dishes.find(d => d.id === item.dish_id)) {
          dishCounts[item.dish_id] = (dishCounts[item.dish_id] || 0) + item.quantity;
        }
      });
    });
    return dishes
      .map(d => ({ dish: d, count: dishCounts[d.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [orders, dishes]);

  const earningsSeries = useMemo(() => {
    const netOrders = orders
      .filter(order => Boolean(order.stripe_transfer_id))
      .map(order => ({
        date: new Date(order.created_at),
        amount: Math.max(0, (order.total_cents ?? 0) - (order.platform_fee_cents ?? 0)),
      }));

    const now = new Date();
    const labels: string[] = [];
    const values: number[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;

    if (earningsRange === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      weekLabels.forEach(label => labels.push(label));
      for (let i = 0; i < 7; i += 1) {
        values[i] = 0;
      }

      netOrders.forEach(order => {
        if (order.date >= startOfWeek && order.date < endOfWeek) {
          const dayIndex = (order.date.getDay() + 6) % 7; // convert Sun=6
          values[dayIndex] += order.amount;
        }
      });
    } else {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const daysInMonth = Math.round((endOfMonth.getTime() - startOfMonth.getTime()) / msPerDay);
      const weeksInMonth = Math.max(1, Math.ceil(daysInMonth / 7));
      for (let i = 0; i < weeksInMonth; i += 1) {
        labels.push(`Week ${i + 1}`);
        values[i] = 0;
      }

      netOrders.forEach(order => {
        if (order.date >= startOfMonth && order.date < endOfMonth) {
          const diffDays = Math.floor((order.date.getTime() - startOfMonth.getTime()) / msPerDay);
          const idx = Math.min(weeksInMonth - 1, Math.floor(diffDays / 7));
          values[idx] += order.amount;
        }
      });
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    const maxValue = Math.max(...values, 0);

    return {
      labels,
      values,
      total,
      maxValue,
    };
  }, [orders, earningsRange]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  async function loadReviews(chefId: number) {
    setReviewsLoading(true);
    try {
      const { data: reviewsData, error } = await supabase
        .from('chef_reviews')
        .select('id, rating, comment, created_at, user_id')
        .eq('chef_id', chefId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((reviewsData || []).map((r: any) => r.user_id).filter((id): id is string => Boolean(id)))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', userIds)
        : { data: [], error: null };
      const emailMap = new Map((profilesData || []).map((p: any) => [p.id, p.email || '']));

      const reviewsWithUsers = (reviewsData || []).map((r: any) => {
        const email = r.user_id ? (emailMap.get(r.user_id) || '') : '';
        const nameFromEmail = email ? email.split('@')[0] : '';
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          user_email: email || undefined,
          user_name: nameFromEmail || 'Anonymous',
        };
      });

      setReviews(reviewsWithUsers);
    } catch (e: any) {
      console.error('loadReviews error', e);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }

  const reviewStats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const filteredAndSortedReviews = useMemo(() => {
    let filtered = reviews;
    
    if (reviewSearch.trim()) {
      const searchLower = reviewSearch.toLowerCase();
      filtered = filtered.filter(r => 
        r.comment?.toLowerCase().includes(searchLower) ||
        r.user_name?.toLowerCase().includes(searchLower) ||
        r.user_email?.toLowerCase().includes(searchLower)
      );
    }

    const sorted = [...filtered];
    switch (reviewSort) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'highest':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        sorted.sort((a, b) => a.rating - b.rating);
        break;
    }
    return sorted;
  }, [reviews, reviewSearch, reviewSort]);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_LIGHT }}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={{ color: TEXT_MUTED, marginTop: 16 }}>Loading dashboard...</Text>
        </View>
      </Screen>
    );
  }

  if (!chef) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: BG_LIGHT }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '700', fontFamily: theme.typography.fontFamily.display }}>Chef profile not found</Text>
          <TouchableOpacity
            onPress={() => router.replace('/auth')}
            style={{ marginTop: 16, backgroundColor: PRIMARY_COLOR, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontFamily: theme.typography.fontFamily.body }}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const navItems = [
    { key: 'dashboard' as const, label: 'Overview', icon: <Image source={require('../../assets/controls.png')} style={{ width: 24, height: 24 }} resizeMode="contain" /> },
    { key: 'menu' as const, label: 'Menu', icon: <Image source={require('../../assets/notebook.png')} style={{ width: 24, height: 24 }} resizeMode="contain" /> },
    { key: 'orders' as const, label: 'Orders', icon: <Image source={require('../../assets/add.png')} style={{ width: 24, height: 24 }} resizeMode="contain" /> },
    { key: 'reviews' as const, label: 'Reviews', icon: <Image source={require('../../assets/edit.png')} style={{ width: 24, height: 24 }} resizeMode="contain" /> },
    { key: 'payouts' as const, label: 'Payment', icon: <Image source={require('../../assets/credit-card.png')} style={{ width: 24, height: 24 }} resizeMode="contain" /> },
  ];

  const footerNavItems = [
    { key: 'profile' as const, label: 'Profile', icon: <Image source={require('../../assets/settings.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />, action: 'profile' as const },
    { key: 'logout' as const, label: 'Logout', icon: <Image source={require('../../assets/logout.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />, action: 'logout' as const },
  ];

  const Sidebar = (
    <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
      <ScrollView contentContainerStyle={styles.sidebarInner} horizontal={isMobile} showsHorizontalScrollIndicator={false}>
        {!isMobile && (
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarIconWrap}>
            {chef?.photo ? (
              <Image 
                source={{ uri: chef.photo }} 
                style={styles.sidebarAvatar}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.sidebarIcon}>🍽️</Text>
            )}
          </View>
          <Text style={styles.sidebarTitle}>ChefDash</Text>
        </View>
        )}

        <View style={[styles.sidebarSection, isMobile && styles.sidebarSectionMobile]}>
          {navItems.map(item => (
            <Pressable
              key={item.key}
              onPress={() => setActiveTab(item.key)}
              style={({ pressed }) => [
                styles.navItem,
                isMobile && styles.navItemMobile,
                activeTab === item.key && styles.navItemActive,
                pressed && styles.navItemPressed,
              ]}
            >
              <View style={styles.navIconWrap}>{typeof item.icon === 'string' ? <Text style={styles.navIcon}>{item.icon}</Text> : item.icon}</View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.navLabel, activeTab === item.key && styles.navLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        
        {!isMobile && (
        <View style={styles.sidebarSectionFooter}>
          {footerNavItems.map(item => {
            const isActive = item.action === 'profile' && activeTab === 'profile';
            const handlePress = item.action === 'logout'
              ? async () => {
                  await supabase.auth.signOut();
                  router.replace('/auth');
                }
              : () => setActiveTab('profile');
            return (
              <Pressable
                key={item.key}
                onPress={handlePress}
                style={({ pressed }) => [
                  styles.navItem,
                  isActive && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
              >
                <View style={styles.navIconWrap}>{typeof item.icon === 'string' ? <Text style={styles.navIcon}>{item.icon}</Text> : item.icon}</View>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.navLabel, isActive && styles.navLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        )}
      </ScrollView>
    </View>
  );

  const DashboardTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 24, paddingBottom: 120 }}>
      {msg && (
        <View style={{ backgroundColor: PRIMARY_COLOR + '20', borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, padding: 12, borderRadius: 8 }}>
          <Text style={{ color: TEXT_DARK, fontWeight: '700' }}>{msg}</Text>
        </View>
      )}
      {err && (
        <View style={{ backgroundColor: '#ef444420', borderLeftWidth: 4, borderLeftColor: '#ef4444', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>{err}</Text>
        </View>
      )}

      <View>
        <Text style={{ color: TEXT_DARK, fontSize: 28, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Welcome, {chef.name.split(' ')[0]}!</Text>
        <Text style={{ color: TEXT_MUTED, fontSize: 16, marginTop: 4, fontFamily: theme.typography.fontFamily.body }}>Here's a summary of your business today.</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        {/* Weekly Earnings Card */}
        <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Weekly Earnings</Text>
            <View style={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4 }}>
              <TouchableOpacity
                onPress={() => setEarningsRange('week')}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: earningsRange === 'week' ? BG_LIGHT : 'transparent',
                }}
              >
                <Text style={{ color: earningsRange === 'week' ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700' }}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEarningsRange('month')}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: earningsRange === 'month' ? BG_LIGHT : 'transparent',
                }}
              >
                <Text style={{ color: earningsRange === 'month' ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700' }}>This Month</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            {earningsSeries.labels.map((label, idx) => {
              const value = earningsSeries.values[idx] || 0;
              const ratio = earningsSeries.maxValue > 0 ? value / earningsSeries.maxValue : 0;
              const barHeight = Math.max(8, ratio * 160);
              return (
                <View key={label} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '600' }}>
                    {value > 0 ? formatCad(value / 100) : formatCad(0)}
                  </Text>
                  <View style={{
                    width: '100%',
                    height: barHeight,
                    backgroundColor: value > 0 ? PRIMARY_COLOR : PRIMARY_COLOR + '30',
                    borderRadius: 6,
                  }} />
                  <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>{label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', marginTop: 16 }}>
            {formatCad(earningsSeries.total / 100)}
          </Text>
        </View>

        {/* Top Dishes Card */}
        <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', marginBottom: 16, fontFamily: theme.typography.fontFamily.display }}>Top Performing Dishes</Text>
          <View style={{ gap: 16 }}>
            {topDishes.length > 0 ? (
              topDishes.map(({ dish, count }, idx) => (
                <View key={dish.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: TEXT_DARK, fontSize: 14, fontWeight: '700', fontFamily: theme.typography.fontFamily.body }}>{dish.name}</Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', fontFamily: theme.typography.fontFamily.body }}>{count} sold</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: BG_GRAY, borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.max(40, (count / (topDishes[0]?.count || 1)) * 100)}%`, backgroundColor: PRIMARY_COLOR }} />
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>No dishes sold yet</Text>
            )}
          </View>
        </View>
      </View>

      {/* Order Management */}
      <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16 }}>
        <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', marginBottom: 16, fontFamily: theme.typography.fontFamily.display }}>Order Management</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4, marginBottom: 16, minWidth: '100%' }}>
          {(['requested', 'pending', 'ready', 'completed'] as const).map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => setOrderStatusFilter(status)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 6,
                backgroundColor: orderStatusFilter === status ? BG_LIGHT : 'transparent',
                minWidth: 100,
              }}
            >
              <Text style={{ color: orderStatusFilter === status ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
                {status.charAt(0).toUpperCase() + status.slice(1)} Orders
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ gap: 16 }}>
          {filteredOrders.length > 0 ? (
            filteredOrders.slice(0, 10).map(order => (
              <View key={order.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Order #{order.id}</Text>
                  <Text style={{ color: PRIMARY_COLOR, fontSize: 16, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>{formatCad((order.total_cents || 0) / 100)}</Text>
                </View>
                <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Customer: {order.user_email || 'Unknown'}</Text>
                <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Pickup: {formatLocal(order.pickup_at)}</Text>
                <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>Placed: {formatLocal(order.created_at)}</Text>
                <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
                  Items: {order.order_items?.map((item: any) => `${item.quantity}x ${item.dish_name || item.dishes?.name || 'Item'}`).join(', ') || 'No items'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {order.status === 'requested' ? (
                    <>
                      {(() => {
                        const transferSent = Boolean(order.stripe_transfer_id);
                        const canAccept = chargesEnabled && !!stripeAccountId && !transferSent;
                        return (
                          <TouchableOpacity
                            disabled={!canAccept}
                            onPress={async () => {
                              if (!canAccept) {
                                if (!chargesEnabled || !stripeAccountId) {
                                  Alert.alert('Cannot accept order', 'Please complete payouts onboarding first.');
                                } else if (transferSent) {
                                  Alert.alert('Order already accepted', 'This order has already been accepted.');
                                }
                                return;
                              }
                              try {
                                await callFn('accept-order', { orderId: order.id });
                                Alert.alert('Success', 'Order accepted! Payment has been captured.');
                                await refreshOrdersForChef(chef!.id);
                              } catch (err: any) {
                                Alert.alert('Accept failed', err?.message || 'Unable to accept order');
                              }
                            }}
                            style={{
                              backgroundColor: PRIMARY_COLOR,
                              paddingVertical: 8,
                              paddingHorizontal: 16,
                              borderRadius: 8,
                              opacity: canAccept ? 1 : 0.5,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{transferSent ? 'Accepted' : 'Accept'}</Text>
                          </TouchableOpacity>
                        );
                      })()}
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await callFn('cancel-payment', { orderId: order.id, reason: 'chef_rejected' });
                            await refreshOrdersForChef(chef!.id);
                          } catch (err: any) {
                            Alert.alert('Reject failed', err?.message || 'Unable to reject order');
                          }
                        }}
                        style={{ backgroundColor: '#F97316', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  ) : order.status === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await handleOrderStatus(order.id, 'ready');
                            Alert.alert('Success', 'Order marked as ready!');
                          } catch (err: any) {
                            Alert.alert('Update failed', err?.message || 'Unable to mark order as ready');
                          }
                        }}
                        style={{ backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Mark as Ready</Text>
                      </TouchableOpacity>
                      <Text style={{ color: PRIMARY_COLOR, fontWeight: '700' }}>In the kitchen</Text>
                    </View>
                  ) : order.status === 'ready' ? (
                    <View style={{ backgroundColor: '#DCFCE7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                      <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '700' }}>Ready</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: TEXT_MUTED, fontSize: 14, padding: 16, textAlign: 'center' }}>No {orderStatusFilter} orders</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const MenuTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 16, gap: 32, paddingBottom: 120 }}>
      {msg && (
        <View style={{ backgroundColor: PRIMARY_COLOR + '20', borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, padding: 12, borderRadius: 8 }}>
          <Text style={{ color: TEXT_DARK, fontWeight: '700' }}>{msg}</Text>
        </View>
      )}
      {err && (
        <View style={{ backgroundColor: '#ef444420', borderLeftWidth: 4, borderLeftColor: '#ef4444', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>{err}</Text>
        </View>
      )}

      <Text style={{ color: TEXT_DARK, fontSize: 30, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Menu Management</Text>

      <NewDishForm onCreate={createDish} saving={saving} />

      <View style={{ gap: 24 }}>
        {dishes.length === 0 ? (
          <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>No dishes yet. Add your first dish above.</Text>
        ) : (
          dishes.map(d => <DishEditor key={d.id} dish={d} onSave={updateDish} onDelete={deleteDish} saving={saving} />)
        )}
      </View>
    </ScrollView>
  );

  const OrdersTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 16, paddingBottom: 120 }}>
      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Order History</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4, minWidth: '100%' }}>
        {(['requested', 'pending', 'ready', 'paid', 'completed', 'cancelled', 'rejected'] as const).map(status => (
          <TouchableOpacity
            key={status}
            onPress={() => setOrderStatusFilter(status)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 6,
              backgroundColor: orderStatusFilter === status ? BG_LIGHT : 'transparent',
              minWidth: 100,
            }}
          >
            <Text style={{ color: orderStatusFilter === status ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filteredOrders.map(order => (
        <View key={order.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Order #{order.id}</Text>
            <Text style={{ color: PRIMARY_COLOR, fontSize: 16, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>{formatCad((order.total_cents || 0) / 100)}</Text>
          </View>
          <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Customer: {order.user_email || 'Unknown'}</Text>
          <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Pickup: {formatLocal(order.pickup_at)}</Text>
          <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>Placed: {formatLocal(order.created_at)}</Text>
          <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
            Items: {order.order_items?.map((item: any) => `${item.quantity}x ${item.dish_name || 'Item'}`).join(', ') || 'No items'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {order.status === 'requested' ? (
              <>
                {(() => {
                  const transferSent = Boolean(order.stripe_transfer_id);
                  const canAccept = chargesEnabled && !!stripeAccountId && !transferSent;
                  return (
                    <TouchableOpacity
                      disabled={!canAccept}
                      onPress={async () => {
                        if (!canAccept) {
                          if (!chargesEnabled || !stripeAccountId) {
                            Alert.alert('Cannot accept order', 'Please complete payouts onboarding first.');
                          } else if (transferSent) {
                            Alert.alert('Order already accepted', 'This order has already been accepted.');
                          }
                          return;
                        }
                        try {
                          await callFn('accept-order', { orderId: order.id });
                          Alert.alert('Success', 'Order accepted! Payment has been captured.');
                          await refreshOrdersForChef(chef.id);
                        } catch (err: any) {
                          Alert.alert('Accept failed', err?.message || 'Unable to accept order');
                        }
                      }}
                      style={{
                        backgroundColor: PRIMARY_COLOR,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        opacity: canAccept ? 1 : 0.5,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{transferSent ? 'Accepted' : 'Accept'}</Text>
                    </TouchableOpacity>
                  );
                })()}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await callFn('cancel-payment', { orderId: order.id, reason: 'chef_rejected' });
                      await refreshOrdersForChef(chef.id);
                    } catch (err: any) {
                      Alert.alert('Reject failed', err?.message || 'Unable to reject order');
                    }
                  }}
                  style={{ backgroundColor: '#F97316', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Reject</Text>
                </TouchableOpacity>
              </>
            ) : order.status === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await handleOrderStatus(order.id, 'ready');
                      Alert.alert('Success', 'Order marked as ready!');
                    } catch (err: any) {
                      Alert.alert('Update failed', err?.message || 'Unable to mark order as ready');
                    }
                  }}
                  style={{ backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Mark as Ready</Text>
                </TouchableOpacity>
                <Text style={{ color: PRIMARY_COLOR, fontWeight: '700' }}>In the kitchen</Text>
              </View>
            ) : order.status === 'ready' ? (
              <View style={{ backgroundColor: '#DCFCE7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '700' }}>Ready</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {filteredOrders.length === 0 && (
        <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center', padding: 32 }}>No {orderStatusFilter} orders</Text>
      )}
    </ScrollView>
  );

  const ReviewsTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 24, paddingBottom: 120 }}>
      <Text style={{ color: TEXT_DARK, fontSize: 30, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>My Reviews</Text>

      {/* Rating Summary Card */}
      <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const rounded = Math.round(reviewStats.avg * 2) / 2; // Round to nearest 0.5
              if (star <= Math.floor(rounded)) {
                return <Text key={star} style={{ fontSize: 32, color: '#FBBF24' }}>★</Text>;
              } else if (star === Math.ceil(rounded) && rounded % 1 === 0.5) {
                // Half star - using a visual approximation
                return <Text key={star} style={{ fontSize: 32, color: '#FBBF24', opacity: 0.6 }}>★</Text>;
              } else {
                return <Text key={star} style={{ fontSize: 32, color: '#D1D5DB' }}>★</Text>;
              }
            })}
          </View>
          <View>
            <Text style={{ color: TEXT_DARK, fontSize: 28, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
              {reviewStats.count > 0 ? reviewStats.avg.toFixed(1) : '0.0'}
            </Text>
            <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
              Based on {reviewStats.count} {reviewStats.count === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        </View>
      </View>

      {/* Search and Sort */}
      <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 16, justifyContent: 'space-between', alignItems: Platform.OS === 'web' ? 'center' : 'stretch' }}>
        <View style={{ flex: Platform.OS === 'web' ? 1 : 1, position: 'relative', maxWidth: Platform.OS === 'web' ? 400 : '100%' }}>
          <Text style={{ position: 'absolute', left: 12, top: 12, color: TEXT_MUTED, zIndex: 1 }}>🔍</Text>
          <TextInput
            value={reviewSearch}
            onChangeText={setReviewSearch}
            placeholder="Search reviews..."
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, paddingLeft: 40, minHeight: 44 }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Sort by:</Text>
          <View style={{ backgroundColor: BG_LIGHT, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 4 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['newest', 'oldest', 'highest', 'lowest'] as const).map(sort => (
                <TouchableOpacity
                  key={sort}
                  onPress={() => setReviewSort(sort)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: reviewSort === sort ? PRIMARY_COLOR + '20' : 'transparent',
                  }}
                >
                  <Text style={{ color: reviewSort === sort ? PRIMARY_COLOR : TEXT_MUTED, fontSize: 12, fontWeight: reviewSort === sort ? '700' : '500' }}>
                    {sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : sort === 'highest' ? 'Highest' : 'Lowest'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Reviews List */}
      {reviewsLoading ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={{ color: TEXT_MUTED, marginTop: 16 }}>Loading reviews...</Text>
        </View>
      ) : filteredAndSortedReviews.length === 0 ? (
        <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 32, alignItems: 'center' }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 16 }}>
            {reviewSearch ? 'No reviews match your search' : 'No reviews yet'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {filteredAndSortedReviews.map((review) => {
            const reviewDate = new Date(review.created_at);
            const daysAgo = Math.floor((Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
            const timeAgo = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : daysAgo < 7 ? `${daysAgo} days ago` : daysAgo < 30 ? `${Math.floor(daysAgo / 7)} weeks ago` : `${Math.floor(daysAgo / 30)} months ago`;

            return (
              <View key={review.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY_COLOR + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{review.user_name?.[0]?.toUpperCase() || 'A'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '700' }}>{review.user_name || 'Anonymous'}</Text>
                        <View style={{ flexDirection: 'row', marginTop: 4 }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text key={star} style={{ fontSize: 16, color: star <= review.rating ? '#FBBF24' : '#D1D5DB' }}>★</Text>
                          ))}
                        </View>
                      </View>
                      <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>{timeAgo}</Text>
                    </View>
                    {review.comment && (
                      <Text style={{ color: TEXT_DARK, fontSize: 14, lineHeight: 20 }}>"{review.comment}"</Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                      <TouchableOpacity>
                        <Text style={{ color: PRIMARY_COLOR, fontSize: 14, fontWeight: '700' }}>Reply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity>
                        <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Report</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  const PayoutsTab = (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <PayoutSettings
        onStatusChange={async (nextStatus) => {
          setPayoutsEnabled(Boolean(nextStatus?.payouts_enabled || nextStatus?.charges_enabled));
          if (typeof nextStatus?.charges_enabled === 'boolean') {
            setChargesEnabled(nextStatus.charges_enabled);
          }
          if (nextStatus?.accountId) {
            setStripeAccountId(nextStatus.accountId);
          }
        }}
      />
    </View>
  );

  const ProfileTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 24, paddingBottom: 120 }}>
      {msg && (
        <View style={{ backgroundColor: PRIMARY_COLOR + '20', borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, padding: 12, borderRadius: 8 }}>
          <Text style={{ color: TEXT_DARK, fontWeight: '700' }}>{msg}</Text>
        </View>
      )}
      {err && (
        <View style={{ backgroundColor: '#ef444420', borderLeftWidth: 4, borderLeftColor: '#ef4444', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>{err}</Text>
        </View>
      )}

      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>Profile Settings</Text>

      <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Image source={{ uri: photo || 'https://placehold.co/128x128?text=Avatar' }} style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: BORDER_LIGHT, backgroundColor: '#EEE' }} />
          <FilePicker label="Upload avatar" onFile={handleAvatarPick} accept="image/*" />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>Display Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Chef Amira"
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>Short Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Your cooking story…"
            placeholderTextColor={TEXT_MUTED}
            multiline
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 96 }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>Location</Text>
          <LocationPicker
            value={location}
            onChange={setLocation}
            placeholder="Search for your location..."
          />
          <Text style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Select your location from the dropdown</Text>
        </View>

        <TouchableOpacity
          onPress={saveProfile}
          disabled={saving}
          style={{ backgroundColor: saving ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, padding: 12, borderRadius: 8, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontFamily: theme.typography.fontFamily.body }}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Screen style={{ backgroundColor: BG_PAGE }}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        {Sidebar}
        <View style={styles.content}>
          {activeTab === 'dashboard' && DashboardTab}
          {activeTab === 'menu' && MenuTab}
          {activeTab === 'orders' && OrdersTab}
          {activeTab === 'reviews' && ReviewsTab}
          {activeTab === 'payouts' && PayoutsTab}
          {activeTab === 'profile' && ProfileTab}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: BG_LIGHT,
    minHeight: '100%',
  },
  sidebar: {
    width: 260,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: BORDER_LIGHT,
    backgroundColor: BG_LIGHT,
  },
  sidebarInner: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sidebarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  sidebarIcon: {
    fontSize: 24,
  },
  sidebarAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  sidebarTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: theme.typography.fontFamily.display,
  },
  sidebarSection: {
    marginBottom: 24,
  },
  sidebarSectionFooter: {
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: PRIMARY_COLOR + '20',
  },
  navItemPressed: {
    opacity: 0.85,
  },
  navIconWrap: {
    width: 22,
    height: 22,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    flexShrink: 1,
    fontSize: 16,
    color: TEXT_MUTED,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  navLabelActive: {
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    backgroundColor: BG_PAGE,
  },
  // Mobile Styles
  pageMobile: {
    flexDirection: 'column',
  },
  sidebarMobile: {
    width: '100%',
    height: 'auto',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  sidebarSectionMobile: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  navItemMobile: {
    marginRight: 8,
    marginBottom: 0,
  },
});

// Dish form components
function NewDishForm({ onCreate, saving }: { onCreate: (d: { name: string; price: number; description?: string; ingredients?: string; file?: File | null; preview?: string }) => void; saving: boolean }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const valid = name.trim().length > 0 && Number(price) > 0;

  return (
    <View style={{ backgroundColor: BG_LIGHT, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
      <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Add a new dish</Text>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
          <View style={{ flex: isMobile ? undefined : 2, minWidth: isMobile ? undefined : 200 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Chicken Biryani"
              placeholderTextColor={TEXT_MUTED}
              style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
            />
          </View>
          <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Price</Text>
            <View style={{ position: 'relative' }}>
              <Text style={{ position: 'absolute', left: 12, top: 12, color: TEXT_MUTED, zIndex: 1 }}>$</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="19.99"
                placeholderTextColor={TEXT_MUTED}
                style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, paddingLeft: 28, minHeight: 40 }}
              />
            </View>
          </View>
          <View style={{ minWidth: isMobile ? undefined : 200, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Photo</Text>
            {preview ? (
              <View style={{ gap: 8 }}>
                <Image 
                  source={{ uri: preview }} 
                  style={{ width: isMobile ? '100%' : 192, height: 192, borderRadius: 8, backgroundColor: '#EEE', marginBottom: 8 }} 
                />
                <FilePicker 
                  label="Replace Image" 
                  onFile={(f) => { 
                    if (preview) URL.revokeObjectURL(preview);
                    setFile(f); 
                    setPreview(URL.createObjectURL(f)); 
                  }} 
                  accept="image/*" 
                />
              </View>
            ) : (
              <FilePicker 
                label="Choose Image" 
                onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} 
                accept="image/*" 
              />
            )}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Aromatic rice with tender chicken…"
            placeholderTextColor={TEXT_MUTED}
            multiline
            numberOfLines={3}
            style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>Ingredients & Allergens</Text>
          <TextInput
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Contains peanuts, dairy, gluten..."
            placeholderTextColor={TEXT_MUTED}
            multiline
            numberOfLines={2}
            style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableOpacity
            onPress={() => {
              onCreate({ name: name.trim(), price: Number(price), description: description.trim(), ingredients: ingredients.trim(), file, preview });
              setName('');
              setPrice('');
              setDescription('');
              setIngredients('');
              setFile(null);
              setPreview(null);
            }}
            disabled={!valid || saving}
            style={{ 
              backgroundColor: (!valid || saving) ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, 
              paddingVertical: 10, 
              paddingHorizontal: 24, 
              borderRadius: 8,
              opacity: (!valid || saving) ? 0.6 : 1
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>{saving ? 'Saving…' : 'Add Dish'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function DishEditor({ dish, onSave, onDelete, saving }: { dish: DishRow; onSave: (p: { id: number; name?: string; price?: number | string; description?: string; ingredients?: string; file?: File | null; preview?: string }) => void; onDelete: (id: number) => void; saving: boolean }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [name, setName] = useState(dish.name || '');
  const [price, setPrice] = useState(String(dish.price ?? ''));
  const [description, setDescription] = useState(dish.description || '');
  const [ingredients, setIngredients] = useState(dish.ingredients || '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(dish.image || dish.thumbnail || '');

  return (
    <View style={{ backgroundColor: BG_LIGHT, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 24 }}>
        <Image 
          source={{ uri: preview || 'https://placehold.co/192x192?text=Dish' }} 
          style={{ 
            width: isMobile ? '100%' : 192, 
            height: 192, 
            borderRadius: 8, 
            backgroundColor: '#EEE',
            maxWidth: isMobile ? '100%' : 192
          }} 
        />
        <View style={{ flex: 1, gap: 16 }}>
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
            <View style={{ flex: isMobile ? undefined : 2, minWidth: isMobile ? undefined : 200 }}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Dish name"
                placeholderTextColor={TEXT_MUTED}
                style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
              />
            </View>
            <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Price</Text>
              <View style={{ position: 'relative' }}>
                <Text style={{ position: 'absolute', left: 12, top: 12, color: TEXT_MUTED, zIndex: 1 }}>$</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={TEXT_MUTED}
                  style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, paddingLeft: 28, minHeight: 40 }}
                />
              </View>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the dish"
              placeholderTextColor={TEXT_MUTED}
              multiline
              numberOfLines={2}
              style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>Ingredients & Allergens</Text>
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="List ingredients and allergens"
              placeholderTextColor={TEXT_MUTED}
              multiline
              numberOfLines={2}
              style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ 
            flexDirection: isMobile ? 'column' : 'row', 
            gap: 16, 
            alignItems: isMobile ? 'stretch' : 'center',
            width: '100%'
          }}>
            <View>
              <FilePicker 
                label="Replace Photo" 
                onFile={(f) => { 
                  if (preview && preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                  }
                  setFile(f); 
                  setPreview(URL.createObjectURL(f)); 
                }} 
                accept="image/*" 
              />
            </View>
            {!isMobile && <View style={{ flex: 1 }} />}
            <View style={{ 
              flexDirection: 'row', 
              gap: 8
            }}>
              <TouchableOpacity
                onPress={() => onSave({ id: dish.id, name: name.trim(), price: price, description: description.trim(), ingredients: ingredients.trim(), file, preview })}
                disabled={saving}
                style={{ 
                  backgroundColor: saving ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, 
                  paddingVertical: 10, 
                  paddingHorizontal: 24, 
                  borderRadius: 8,
                  opacity: saving ? 0.6 : 1
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(dish.id)}
                disabled={saving}
                style={{ 
                  backgroundColor: BG_LIGHT, 
                  borderWidth: 1, 
                  borderColor: '#d1d5db', 
                  paddingVertical: 10, 
                  paddingHorizontal: 16, 
                  borderRadius: 8,
                  opacity: saving ? 0.6 : 1
                }}
              >
                <Text style={{ color: TEXT_DARK, fontWeight: '700', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
