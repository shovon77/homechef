'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import { toggleChefActive, updateOrderStatus } from '../../lib/adminActions';
import { Tabs } from '../../components/Tabs';
import { theme } from '../../constants/theme';
import { getChefsPaginated, getOrders } from '../../lib/db';
import type { Chef, OrderWithItems, Profile } from '../../lib/types';

const ITEMS_PER_PAGE = 25;

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, loading: adminLoading, user, profile } = useRole();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [chefPage, setChefPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      // Load chefs using db helper
      const chefRows = await getChefsPaginated({ limit: 1000 });
      
      // Load orders using db helper (includes order_items and user_email)
      const orderRows = await getOrders({ limit: 1000 });
      
      // Load users from profiles table
      const { data: userRows } = await supabase
        .from('profiles')
        .select('id,email,is_chef')
        .order('id', { ascending: true });
      
      setChefs(chefRows);
      setOrders(orderRows);
      setUsers((userRows as any[]) || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleToggleChefActive(id: number, next: boolean) {
    const result = await toggleChefActive(id, next);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, active: next } : c));
    } else {
      setErr(result.error || 'Failed to update chef');
    }
  }

  async function handleUpdateOrderStatus(id: number, newStatus: string) {
    const result = await updateOrderStatus(id, newStatus);
    if (result.ok) {
      setOrders(os => os.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } else {
      setErr(result.error || 'Failed to update order');
    }
  }

  const nonChefs = useMemo(() => users.filter(u => !u.is_chef), [users]);
  
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return nonChefs;
    const search = userSearch.toLowerCase();
    return nonChefs.filter(u => 
      (u.email || '').toLowerCase().includes(search) ||
      (u.name || '').toLowerCase().includes(search) ||
      (u.id || '').toLowerCase().includes(search)
    );
  }, [nonChefs, userSearch]);

  // Reset pagination when search changes
  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const search = orderSearch.toLowerCase();
    return orders.filter(o => 
      (o.status || '').toLowerCase().includes(search) ||
      (o.user_email || '').toLowerCase().includes(search) ||
      String(o.id).includes(search)
    );
  }, [orders, orderSearch]);

  // Reset pagination when search changes
  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch]);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, orderPage]);

  const totalOrderPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedChefs = useMemo(() => {
    const start = (chefPage - 1) * ITEMS_PER_PAGE;
    return chefs.slice(start, start + ITEMS_PER_PAGE);
  }, [chefs, chefPage]);

  const totalChefPages = Math.ceil(chefs.length / ITEMS_PER_PAGE);

  const ChefsTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Chefs ({chefs.length} total)</Text>
      {loading && chefs.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : paginatedChefs.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>No chefs found.</Text>
      ) : (
        <>
          {paginatedChefs.map(c => (
            <View
              key={c.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 18, marginBottom: 4 }}>
                    {c.name || `Chef #${c.id}`}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                    {c.location || 'No location'}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: c.active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}>
                  <Text style={{ color: c.active ? '#22c55e' : '#6b7280', fontWeight: '700', fontSize: 12 }}>
                    {c.active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleToggleChefActive(c.id, !c.active)}
                style={{
                  backgroundColor: c.active ? 'rgba(239, 68, 68, 0.2)' : theme.colors.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.active ? 'rgba(239, 68, 68, 0.3)' : theme.colors.primary,
                }}
              >
                <Text style={{ color: theme.colors.white, fontWeight: '800', textAlign: 'center' }}>
                  {c.active ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          {totalChefPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setChefPage(p => Math.max(1, p - 1))}
                disabled={chefPage === 1}
                style={{
                  backgroundColor: chefPage === 1 ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: chefPage === 1 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>
                Page {chefPage} of {totalChefPages}
              </Text>
              <TouchableOpacity
                onPress={() => setChefPage(p => Math.min(totalChefPages, p + 1))}
                disabled={chefPage === totalChefPages}
                style={{
                  backgroundColor: chefPage === totalChefPages ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: chefPage === totalChefPages ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  const UsersTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Users (non-chefs)</Text>
      
      <View style={{ marginBottom: 8 }}>
        <TextInput
          value={userSearch}
          onChangeText={setUserSearch}
          placeholder="Search by email, name, or ID..."
          placeholderTextColor={theme.colors.textMuted}
          style={{
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: 12,
            color: theme.colors.text,
            fontSize: 14,
          }}
        />
      </View>

      {loading && users.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : paginatedUsers.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          {userSearch ? 'No users found matching your search.' : 'No non-chef users found.'}
        </Text>
      ) : (
        <>
          {paginatedUsers.map(u => (
            <View
              key={u.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 16, marginBottom: 4 }}>
                {u.name || u.email || u.id}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>{u.email || 'No email'}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>ID: {u.id}</Text>
            </View>
          ))}

          {totalUserPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage === 1}
                style={{
                  backgroundColor: userPage === 1 ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: userPage === 1 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>
                Page {userPage} of {totalUserPages} ({filteredUsers.length} total)
              </Text>
              <TouchableOpacity
                onPress={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                disabled={userPage === totalUserPages}
                style={{
                  backgroundColor: userPage === totalUserPages ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: userPage === totalUserPages ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  const OrdersTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Orders ({filteredOrders.length} total)</Text>
      
      <View style={{ marginBottom: 8 }}>
        <TextInput
          value={orderSearch}
          onChangeText={setOrderSearch}
          placeholder="Search by status, email, or order ID..."
          placeholderTextColor={theme.colors.textMuted}
          style={{
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: 12,
            color: theme.colors.text,
            fontSize: 14,
          }}
        />
      </View>

      {loading && orders.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : paginatedOrders.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          {orderSearch ? 'No orders found matching your search.' : 'No orders found.'}
        </Text>
      ) : (
        <>
          {paginatedOrders.map(o => (
            <OrderCard key={o.id} order={o} onStatusUpdate={handleUpdateOrderStatus} />
          ))}
          {totalOrderPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setOrderPage(p => Math.max(1, p - 1))}
                disabled={orderPage === 1}
                style={{
                  backgroundColor: orderPage === 1 ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: orderPage === 1 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>
                Page {orderPage} of {totalOrderPages} ({filteredOrders.length} total)
              </Text>
              <TouchableOpacity
                onPress={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))}
                disabled={orderPage === totalOrderPages}
                style={{
                  backgroundColor: orderPage === totalOrderPages ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: orderPage === totalOrderPages ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  function OrderCard({ order, onStatusUpdate }: { order: OrderWithItems; onStatusUpdate: (id: number, status: string) => void }) {
    const statusOptions = ['pending', 'paid', 'completed', 'cancelled'];
    const currentStatus = (order.status || '').toLowerCase();
    const totalDollars = ((order.total_cents || 0) / 100).toFixed(2);

    return (
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 18, marginBottom: 4 }}>
              Order #{order.id}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
              User: {order.user_email || (order.user_id ? order.user_id.substring(0, 8) + '...' : '—')}
            </Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '900', fontSize: 16, marginTop: 4 }}>
              ${totalDollars}
            </Text>
            {order.created_at && (
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {new Date(order.created_at).toLocaleString()}
              </Text>
            )}
          </View>
          <View style={{
            backgroundColor: currentStatus === 'completed' ? 'rgba(34, 197, 94, 0.2)' :
                           currentStatus === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' :
                           currentStatus === 'paid' ? 'rgba(59, 130, 246, 0.2)' :
                           'rgba(234, 179, 8, 0.2)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}>
            <Text style={{
              color: currentStatus === 'completed' ? '#22c55e' :
                     currentStatus === 'cancelled' ? '#ef4444' :
                     currentStatus === 'paid' ? '#3b82f6' :
                     '#eab308',
              fontWeight: '700',
              fontSize: 12,
            }}>
              {order.status || 'Unknown'}
            </Text>
          </View>
        </View>

        {order.order_items && order.order_items.length > 0 && (
          <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
            <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>Items:</Text>
            {order.order_items.map(item => {
              const itemTotal = ((item.unit_price_cents * item.quantity) / 100).toFixed(2);
              return (
                <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {item.dish_name || `Dish #${item.dish_id}`}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                      Qty: {item.quantity} × ${((item.unit_price_cents || 0) / 100).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '800' }}>
                    ${itemTotal}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {statusOptions.map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => onStatusUpdate(order.id, status)}
              disabled={currentStatus === status}
              style={{
                backgroundColor: currentStatus === status ? theme.colors.primary : theme.colors.surface,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: currentStatus === status ? theme.colors.primary : 'rgba(255,255,255,0.15)',
                opacity: currentStatus === status ? 1 : 0.8,
              }}
            >
              <Text style={{
                color: theme.colors.white,
                fontWeight: currentStatus === status ? '900' : '700',
                fontSize: 12,
              }}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Gate admin access with timeout
  useEffect(() => {
    if (adminLoading) {
      const timeout = setTimeout(() => {
        // If still loading after 10s, show error
        if (adminLoading) {
          console.error('Admin check timeout');
        }
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [adminLoading]);

  if (adminLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: 16 }}>Checking admin access…</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
        <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 20 }}>Admin access required</Text>
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
          Signed in as: {user?.email || '— not signed in —'}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={{
            backgroundColor: theme.colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 10,
            marginTop: 8,
          }}
        >
          <Text style={{ color: theme.colors.white, fontWeight: '800' }}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const content = (
    <View style={{ width: '100%', maxWidth: 1200, alignSelf: 'center' }}>
      <View style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        padding: 24,
        gap: 16,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 28 }}>Admin Dashboard</Text>
          <TouchableOpacity
            onPress={loadAll}
            disabled={loading}
            style={{
              backgroundColor: theme.colors.primary,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: '800' }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
        {err && (
          <View style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: 12,
          }}>
            <Text style={{ color: '#ef4444', fontWeight: '700' }}>{err}</Text>
          </View>
        )}
        <Tabs
          initial={0}
          tabs={[
            { key: 'chefs', title: 'Chefs', content: ChefsTab },
            { key: 'users', title: 'Users', content: UsersTab },
            { key: 'orders', title: 'Orders', content: OrdersTab },
          ]}
        />
      </View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }} contentContainerStyle={{ padding: 20 }}>
      {content}
    </ScrollView>
  );
}

