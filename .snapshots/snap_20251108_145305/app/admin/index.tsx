'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import AdminGuard from '../../components/AdminGuard';
import { Tabs } from '../../components/Tabs';
import { theme } from '../../constants/theme';

type Chef = { id: number; name?: string | null; location?: string | null; active?: boolean | null; phone?: string | null; };
type Order = { id: number; user_id?: string | null; chef_id?: number | null; status?: string | null; total?: number | null; created_at?: string | null; };
type AppUser = { id: string; email?: string | null; name?: string | null; is_chef?: boolean | null; };

const ITEMS_PER_PAGE = 20;

export default function AdminPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: chefRows }, { data: orderRows }, { data: userRows }] = await Promise.all([
        supabase.from('chefs').select('id,name,location,phone,active').order('id', { ascending: true }).limit(500),
        supabase.from('orders').select('id,user_id,chef_id,status,total,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('users').select('id,email,name,is_chef').limit(1000),
      ]);
      setChefs((chefRows as any[]) || []);
      setOrders((orderRows as any[]) || []);
      setUsers((userRows as any[]) || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function toggleChefActive(id: number, next: boolean) {
    try {
      const { error } = await supabase.from('chefs').update({ active: next }).eq('id', id);
      if (error) throw error;
      setChefs(cs => cs.map(c => c.id === id ? { ...c, active: next } : c));
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  async function updateOrderStatus(id: number, newStatus: string) {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setOrders(os => os.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  const currentOrders = useMemo(() => orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s === 'current' || s === 'in_progress' || s === 'pending';
  }), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => (o.status || '').toLowerCase() === 'completed'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s === 'cancelled' || s === 'canceled';
  }), [orders]);
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

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  const ChefsTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Chefs</Text>
      {loading && chefs.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : chefs.length === 0 ? (
        <Text style={{ color: theme.colors.muted }}>No chefs found.</Text>
      ) : (
        chefs.map(c => (
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
                <Text style={{ color: theme.colors.muted, fontSize: 14 }}>
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
              onPress={() => toggleChefActive(c.id, !c.active)}
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
        ))
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
          placeholderTextColor={theme.colors.muted}
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
        <Text style={{ color: theme.colors.muted }}>
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
              <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{u.email || 'No email'}</Text>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>ID: {u.id}</Text>
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
              <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>
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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Orders</Text>
      
      <View>
        <Text style={{ color: '#eab308', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>Current</Text>
        {currentOrders.length === 0 ? (
          <Text style={{ color: theme.colors.muted }}>No current orders.</Text>
        ) : (
          currentOrders.map(o => (
            <OrderCard key={`cur_${o.id}`} order={o} onStatusUpdate={updateOrderStatus} />
          ))
        )}
      </View>

      <View>
        <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>Completed</Text>
        {completedOrders.length === 0 ? (
          <Text style={{ color: theme.colors.muted }}>No completed orders.</Text>
        ) : (
          completedOrders.map(o => (
            <OrderCard key={`cmp_${o.id}`} order={o} onStatusUpdate={updateOrderStatus} />
          ))
        )}
      </View>

      <View>
        <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>Cancelled</Text>
        {cancelledOrders.length === 0 ? (
          <Text style={{ color: theme.colors.muted }}>No cancelled orders.</Text>
        ) : (
          cancelledOrders.map(o => (
            <OrderCard key={`can_${o.id}`} order={o} onStatusUpdate={updateOrderStatus} />
          ))
        )}
      </View>
    </ScrollView>
  );

  function OrderCard({ order, onStatusUpdate }: { order: Order; onStatusUpdate: (id: number, status: string) => void }) {
    const statusOptions = ['current', 'in_progress', 'completed', 'cancelled'];
    const currentStatus = (order.status || '').toLowerCase();

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
            <Text style={{ color: theme.colors.muted, fontSize: 14 }}>
              Chef: {order.chef_id ?? '—'} · User: {order.user_id ? order.user_id.substring(0, 8) + '...' : '—'}
            </Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '900', fontSize: 16, marginTop: 4 }}>
              ${(order.total || 0).toFixed(2)}
            </Text>
            {order.created_at && (
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>
                {new Date(order.created_at).toLocaleString()}
              </Text>
            )}
          </View>
          <View style={{
            backgroundColor: currentStatus === 'completed' ? 'rgba(34, 197, 94, 0.2)' :
                           currentStatus === 'cancelled' || currentStatus === 'canceled' ? 'rgba(239, 68, 68, 0.2)' :
                           'rgba(234, 179, 8, 0.2)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}>
            <Text style={{
              color: currentStatus === 'completed' ? '#22c55e' :
                     currentStatus === 'cancelled' || currentStatus === 'canceled' ? '#ef4444' :
                     '#eab308',
              fontWeight: '700',
              fontSize: 12,
            }}>
              {order.status || 'Unknown'}
            </Text>
          </View>
        </View>

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
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 20 }}>
      <AdminGuard>{content}</AdminGuard>
    </ScrollView>
  );
}

