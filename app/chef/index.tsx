'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { uploadToBucket } from '../../lib/upload';
import FilePicker from '../../components/FilePicker';
import { theme } from '../../lib/theme';
import { Tabs } from '../../components/Tabs';
import { Screen } from '../../components/Screen';
import { formatLocal } from '../../lib/datetime';
import { updateOrderStatus } from '../../lib/orders';

// Colors matching homepage
const PRIMARY_COLOR = '#2C4E4B';
const ACCENT_COLOR = '#FFA500';
const BG_LIGHT = '#FFFFFF';
const BG_GRAY = '#F4F4F4';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#555555';
const BORDER_LIGHT = '#EAECF0';

type ChefRow = { id: number; name: string; email?: string | null; bio?: string | null; photo?: string | null; location?: string | null };
type DishRow = { id: number; chef_id: number | null; name: string; price: number; description?: string | null; image?: string | null; thumbnail?: string | null; chef?: string | null };
type OrderRow = { id: number; user_id: string; status: string; total_cents: number; created_at: string; pickup_at: string | null; user_email?: string; order_items?: Array<{ id: number; dish_id: number; dish_name?: string; quantity: number; unit_price_cents: number }> };

export default function ChefDashboard() {
  const router = useRouter();
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

        // Load dishes
        const d = await supabase.from('dishes').select('*').eq('chef_id', me.id).order('id', { ascending: true });
        if (d.error) throw d.error;
        setDishes((d.data || []) as DishRow[]);

        await refreshOrdersForChef(me.id);

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

  async function saveProfile() {
    if (!chef) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { error } = await supabase.from('chefs').update({ name: name || chef.name, bio: bio ?? null, photo: photo ?? null }).eq('id', chef.id);
      if (error) throw error;
      setChef({ ...chef, name: name || chef.name, bio: bio ?? null, photo: photo ?? null });
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

  async function createDish(d: { name: string; price: number; description?: string; file?: File | null; preview?: string }) {
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
        description: d.description || null
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

  async function updateDish(p: { id: number; name?: string; price?: number | string; description?: string; file?: File | null; preview?: string }) {
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
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id,user_id,status,total_cents,created_at,pickup_at,chef_id')
        .eq('chef_id', chefId)
        .order('created_at', { ascending: false });

      if (error || !ordersData) {
        if (error) console.error('load chef orders error', error);
        setOrders([]);
        return;
      }

      const orderIds = ordersData.map(o => o.id);
      const userIds = [...new Set(ordersData.map(o => o.user_id))];

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
        ? await supabase.from('profiles').select('id,email').in('id', userIds)
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

      const mapped = ordersData.map(order => ({
        id: order.id,
        user_id: order.user_id,
        status: order.status,
        total_cents: order.total_cents ?? 0,
        created_at: order.created_at,
        pickup_at: order.pickup_at ?? null,
        user_email: emailMap.get(order.user_id) ?? undefined,
        order_items: itemsByOrderId.get(order.id) ?? [],
      }));

      setOrders(mapped);
    } catch (error) {
      console.error('refreshOrdersForChef error', error);
      setOrders([]);
    }
  }

  // Calculate analytics
  const weeklyEarnings = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return orders
      .filter(o => new Date(o.created_at) >= weekAgo && o.status === 'completed')
      .reduce((sum, o) => sum + (o.total_cents || 0), 0) / 100;
  }, [orders]);

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

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

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
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '700' }}>Chef profile not found</Text>
          <TouchableOpacity
            onPress={() => router.replace('/auth')}
            style={{ marginTop: 16, backgroundColor: PRIMARY_COLOR, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const Sidebar = (
    <View style={{ width: 256, backgroundColor: BG_LIGHT, borderRightWidth: 1, borderRightColor: BORDER_LIGHT, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32, padding: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: PRIMARY_COLOR + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24 }}>🍽️</Text>
        </View>
        <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '900' }}>ChefDash</Text>
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        {[
          { key: 'dashboard' as const, label: 'Dashboard', icon: '📊' },
          { key: 'menu' as const, label: 'Menu Management', icon: '📖' },
          { key: 'orders' as const, label: 'Order History', icon: '📋' },
          { key: 'reviews' as const, label: 'My Reviews', icon: '⭐' },
          { key: 'payouts' as const, label: 'Payout Settings', icon: '💳' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setActiveTab(item.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              backgroundColor: activeTab === item.key ? PRIMARY_COLOR + '20' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            <Text style={{ color: activeTab === item.key ? PRIMARY_COLOR : TEXT_MUTED, fontWeight: activeTab === item.key ? '800' : '600', fontSize: 14 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER_LIGHT }}>
        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 8,
            backgroundColor: activeTab === 'profile' ? PRIMARY_COLOR + '20' : 'transparent',
          }}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
          <Text style={{ color: activeTab === 'profile' ? PRIMARY_COLOR : TEXT_MUTED, fontWeight: activeTab === 'profile' ? '800' : '600', fontSize: 14 }}>
            Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/auth');
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 20 }}>🚪</Text>
          <Text style={{ color: TEXT_MUTED, fontWeight: '600', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const DashboardTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, gap: 24 }}>
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
        <Text style={{ color: TEXT_DARK, fontSize: 28, fontWeight: '900' }}>Welcome back, {chef.name}!</Text>
        <Text style={{ color: TEXT_MUTED, fontSize: 16, marginTop: 4 }}>Here's a summary of your business today.</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        {/* Weekly Earnings Card */}
        <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900' }}>Weekly Earnings</Text>
            <View style={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4 }}>
              <TouchableOpacity style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700' }}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6, backgroundColor: BG_LIGHT }}>
                <Text style={{ color: TEXT_DARK, fontSize: 12, fontWeight: '700' }}>This Month</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 200, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <View key={day} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                <View style={{ width: '100%', height: `${60 + (i * 10)}%`, backgroundColor: i === 2 ? PRIMARY_COLOR : PRIMARY_COLOR + '30', borderRadius: 4 }} />
                <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>{day}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', marginTop: 16 }}>${weeklyEarnings.toFixed(2)}</Text>
        </View>

        {/* Top Dishes Card */}
        <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
          <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', marginBottom: 16 }}>Top Performing Dishes</Text>
          <View style={{ gap: 16 }}>
            {topDishes.length > 0 ? (
              topDishes.map(({ dish, count }, idx) => (
                <View key={dish.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: TEXT_DARK, fontSize: 14, fontWeight: '700' }}>{dish.name}</Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>{count} sold</Text>
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
        <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', marginBottom: 16 }}>Order Management</Text>
        <View style={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4, marginBottom: 16 }}>
          {(['requested', 'pending', 'ready', 'paid', 'completed', 'cancelled', 'rejected'] as const).map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => setOrderStatusFilter(status)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: orderStatusFilter === status ? BG_LIGHT : 'transparent',
              }}
            >
              <Text style={{ color: orderStatusFilter === status ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                {status.charAt(0).toUpperCase() + status.slice(1)} Orders
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal>
          <View style={{ minWidth: '100%' }}>
            {filteredOrders.length > 0 ? (
              filteredOrders.slice(0, 10).map(order => (
                <View key={order.id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: TEXT_DARK, fontSize: 14, fontWeight: '700' }}>#{order.id}</Text>
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>{order.user_email || 'Customer'}</Text>
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
                      {order.order_items?.map((item: any) => `${item.quantity}x ${item.dishes?.name || 'Item'}`).join(', ') || 'No items'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {order.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => updateOrderStatus(order.id, 'paid')}
                        style={{ backgroundColor: PRIMARY_COLOR, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Accept</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: TEXT_MUTED, fontSize: 14, padding: 16, textAlign: 'center' }}>No {orderStatusFilter} orders</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );

  const MenuTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, gap: 24 }}>
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

      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900' }}>Menu Management</Text>

      <NewDishForm onCreate={createDish} saving={saving} />

      <View style={{ gap: 16 }}>
        {dishes.length === 0 ? (
          <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>No dishes yet. Add your first dish above.</Text>
        ) : (
          dishes.map(d => <DishEditor key={d.id} dish={d} onSave={updateDish} onDelete={deleteDish} saving={saving} />)
        )}
      </View>
    </ScrollView>
  );

  const OrdersTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, gap: 16 }}>
      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900' }}>Order History</Text>
      <View style={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4 }}>
        {(['requested', 'pending', 'ready', 'paid', 'completed', 'cancelled', 'rejected'] as const).map(status => (
          <TouchableOpacity
            key={status}
            onPress={() => setOrderStatusFilter(status)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              backgroundColor: orderStatusFilter === status ? BG_LIGHT : 'transparent',
            }}
          >
            <Text style={{ color: orderStatusFilter === status ? TEXT_DARK : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {filteredOrders.map(order => (
        <View key={order.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '900' }}>Order #{order.id}</Text>
            <Text style={{ color: PRIMARY_COLOR, fontSize: 16, fontWeight: '900' }}>${((order.total_cents || 0) / 100).toFixed(2)}</Text>
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
                <TouchableOpacity
                  onPress={() => handleOrderStatus(order.id, 'pending')}
                  style={{ backgroundColor: PRIMARY_COLOR, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOrderStatus(order.id, 'rejected')}
                  style={{ backgroundColor: '#FEE2E2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                >
                  <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Reject</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {order.status === 'pending' ? (
              <TouchableOpacity
                onPress={() => handleOrderStatus(order.id, 'ready')}
                style={{ backgroundColor: PRIMARY_COLOR, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Mark Ready</Text>
              </TouchableOpacity>
            ) : null}
            {order.status === 'ready' ? (
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
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>My Reviews</Text>
      <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Reviews feature coming soon</Text>
    </ScrollView>
  );

  const PayoutsTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>Payout Settings</Text>
      <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Payout settings coming soon</Text>
    </ScrollView>
  );

  const ProfileTab = (
    <ScrollView style={{ flex: 1, backgroundColor: BG_LIGHT }} contentContainerStyle={{ padding: 32, gap: 24 }}>
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

      <Text style={{ color: TEXT_DARK, fontSize: 24, fontWeight: '900' }}>Profile Settings</Text>

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

        <TouchableOpacity
          onPress={saveProfile}
          disabled={saving}
          style={{ backgroundColor: saving ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, padding: 12, borderRadius: 8, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: BG_LIGHT }}>
      {Sidebar}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && DashboardTab}
        {activeTab === 'menu' && MenuTab}
        {activeTab === 'orders' && OrdersTab}
        {activeTab === 'reviews' && ReviewsTab}
        {activeTab === 'payouts' && PayoutsTab}
        {activeTab === 'profile' && ProfileTab}
      </View>
    </View>
  );
}

// Dish form components
function NewDishForm({ onCreate, saving }: { onCreate: (d: { name: string; price: number; description?: string; file?: File | null; preview?: string }) => void; saving: boolean }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const valid = name.trim().length > 0 && Number(price) > 0;

  return (
    <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16, gap: 12 }}>
      <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900' }}>Add a new dish</Text>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Chicken Biryani"
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 }}
          />
        </View>
        <View style={{ width: 140 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="19.99"
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 }}
          />
        </View>
        <View style={{ minWidth: 200, alignItems: 'flex-start' }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Photo</Text>
          <FilePicker label="Choose image" onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} accept="image/*" />
        </View>
      </View>
      {preview && <Image source={{ uri: preview }} style={{ width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, marginTop: 6 }} />}
      <View style={{ gap: 8 }}>
        <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Aromatic rice with tender chicken…"
          placeholderTextColor={TEXT_MUTED}
          multiline
          style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 96 }}
        />
      </View>
      <TouchableOpacity
        onPress={() => {
          onCreate({ name: name.trim(), price: Number(price), description: description.trim(), file, preview });
          setName('');
          setPrice('');
          setDescription('');
          setFile(null);
          setPreview(null);
        }}
        disabled={!valid || saving}
        style={{ backgroundColor: (!valid || saving) ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, padding: 12, borderRadius: 8, alignSelf: 'flex-start' }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{saving ? 'Saving…' : 'Add Dish'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DishEditor({ dish, onSave, onDelete, saving }: { dish: DishRow; onSave: (p: { id: number; name?: string; price?: number | string; description?: string; file?: File | null; preview?: string }) => void; onDelete: (id: number) => void; saving: boolean }) {
  const [name, setName] = useState(dish.name || '');
  const [price, setPrice] = useState(String(dish.price ?? ''));
  const [description, setDescription] = useState(dish.description || '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(dish.image || dish.thumbnail || '');

  return (
    <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Image source={{ uri: preview || 'https://placehold.co/96x96?text=Dish' }} style={{ width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, backgroundColor: '#EEE' }} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Dish name"
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 }}
          />
        </View>
        <View style={{ width: 120 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={TEXT_MUTED}
            style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48 }}
          />
        </View>
        <View style={{ minWidth: 200, alignItems: 'flex-start' }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>Replace photo</Text>
          <FilePicker label="Choose image" onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} accept="image/*" />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '700' }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the dish"
          placeholderTextColor={TEXT_MUTED}
          multiline
          style={{ backgroundColor: BG_GRAY, color: TEXT_DARK, borderColor: BORDER_LIGHT, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 96 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={() => onSave({ id: dish.id, name: name.trim(), price: price, description: description.trim(), file, preview })}
          disabled={saving}
          style={{ backgroundColor: saving ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(dish.id)}
          disabled={saving}
          style={{ backgroundColor: '#7a1d1d', padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
