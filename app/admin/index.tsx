'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import { toggleChefActive, updateOrderStatus, approveChefApplication, rejectChefApplication } from '../../lib/adminActions';
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
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [chefPage, setChefPage] = useState(1);
  const [chefSearch, setChefSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState('');
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [chefRequests, setChefRequests] = useState<any[]>([]);
  const [chefReqSearch, setChefReqSearch] = useState('');

  async function fetchChefRequests() {
    const { data, error } = await supabase
      .from('chef_applications')
      .select('id, user_id, name, email, phone, location, short_bio, experience, cuisine_specialty, status, created_at')
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchChefRequests', error);
      return [];
    }
    return data ?? [];
  }

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
      
      // Load chef applications
      const { data: applicationRows } = await supabase
        .from('chef_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      setChefs(chefRows);
      setOrders(orderRows);
      setUsers((userRows as any[]) || []);
      setApplications((applicationRows as any[]) || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    loadAll();
    fetchChefRequests().then(setChefRequests);
  }, []);

  async function handleToggleChefActive(id: number, next: boolean) {
    const result = await toggleChefActive(id, next);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, status: next ? 'active' : 'pending' } : c));
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

  async function handleApproveApplication(id: string) {
    const result = await approveChefApplication(id);
    if (result.ok) {
      setApplications(apps => apps.filter(a => a.id !== id));
      // Reload chefs to show newly approved chef
      loadAll();
    } else {
      setErr(result.error || 'Failed to approve application');
    }
  }

  async function handleRejectApplication(id: string) {
    const result = await rejectChefApplication(id);
    if (result.ok) {
      setApplications(apps => apps.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
      setChefRequests(prev => prev.filter(r => r.id !== id));
    } else {
      setErr(result.error || 'Failed to reject application');
    }
  }

  async function approveChefRequest(id: string) {
    // Call the full approve function to set user as chef and create chef entry
    const result = await approveChefApplication(id);
    if (result.ok) {
      Alert.alert('Success', 'Application approved');
      setChefRequests(prev => prev.filter(r => r.id !== id));
      loadAll(); // Reload to show new chef
    } else {
      Alert.alert('Error', result.error || 'Failed to approve application');
    }
  }

  async function rejectChefRequest(id: string) {
    const result = await rejectChefApplication(id);
    if (result.ok) {
      Alert.alert('Success', 'Application rejected');
      setChefRequests(prev => prev.filter(r => r.id !== id));
    } else {
      Alert.alert('Error', result.error || 'Failed to reject application');
    }
  }

  const nonChefs = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter(u => !u.is_chef);
  }, [users]);
  
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(nonChefs)) return [];
    const q = (userSearch ?? '').toLowerCase().trim();
    if (!q) return nonChefs;
    return nonChefs.filter(u => 
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      String(u.id).toLowerCase().includes(q)
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
    if (!Array.isArray(orders)) return [];
    const q = (orderSearch ?? '').toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o =>
      String(o.id).includes(q) ||
      (o.status ?? '').toLowerCase().includes(q) ||
      (o.user_email ?? '').toLowerCase().includes(q)
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

  const filteredApplications = useMemo(() => {
    if (!Array.isArray(applications)) return [];
    const submitted = applications.filter(a => a.status === 'submitted');
    const q = (applicationSearch ?? '').toLowerCase().trim();
    if (!q) return submitted;
    return submitted.filter(a => 
      (a.name ?? '').toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q) ||
      (a.location ?? '').toLowerCase().includes(q) ||
      String(a.id).toLowerCase().includes(q)
    );
  }, [applications, applicationSearch]);

  useEffect(() => {
    setApplicationPage(1);
  }, [applicationSearch]);

  const paginatedApplications = useMemo(() => {
    const start = (applicationPage - 1) * ITEMS_PER_PAGE;
    return filteredApplications.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApplications, applicationPage]);

  const totalApplicationPages = Math.ceil(filteredApplications.length / ITEMS_PER_PAGE);

  const filteredChefs = useMemo(() => {
    if (!Array.isArray(chefs)) return [];
    const q = (chefSearch ?? '').toLowerCase().trim();
    if (!q) return chefs;
    return chefs.filter(c =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.location ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
  }, [chefs, chefSearch]);

  useEffect(() => {
    setChefPage(1);
  }, [chefSearch]);

  const paginatedChefs = useMemo(() => {
    const start = (chefPage - 1) * ITEMS_PER_PAGE;
    return filteredChefs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredChefs, chefPage]);

  const totalChefPages = Math.ceil(filteredChefs.length / ITEMS_PER_PAGE);

  const filteredChefRequests = useMemo(() => {
    if (!Array.isArray(chefRequests)) return [];
    const q = (chefReqSearch ?? '').toLowerCase().trim();
    if (!q) return chefRequests;
    return chefRequests.filter(r =>
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q) ||
      (r.phone ?? '').toLowerCase().includes(q) ||
      (r.location ?? '').toLowerCase().includes(q) ||
      String(r.id).toLowerCase().includes(q)
    );
  }, [chefRequests, chefReqSearch]);

  const ChefRequestsTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>
        Chef Requests ({filteredChefRequests.length} pending)
      </Text>
      
      <View style={{ marginBottom: 8 }}>
        <TextInput
          value={chefReqSearch}
          onChangeText={setChefReqSearch}
          placeholder="Search by name, email, phone, location, or ID..."
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

      {loading && chefRequests.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filteredChefRequests.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          {chefReqSearch ? 'No requests found matching your search.' : 'No pending requests.'}
        </Text>
      ) : (
        <>
          {filteredChefRequests.map(req => (
            <View
              key={req.id}
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
                    {req.name || 'Unnamed Request'}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                    {req.email || 'No email'}
                  </Text>
                  {req.phone && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                      📞 {req.phone}
                    </Text>
                  )}
                  {req.location && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                      📍 {req.location}
                    </Text>
                  )}
                  {req.created_at && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      Submitted: {new Date(req.created_at).toLocaleString()}
                    </Text>
                  )}
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                    ID: {String(req.id).substring(0, 8)}...
                  </Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}>
                  <Text style={{ color: '#eab308', fontWeight: '700', fontSize: 12 }}>
                    Pending
                  </Text>
                </View>
              </View>

              {req.short_bio && (
                <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Bio:</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                    {req.short_bio}
                  </Text>
                </View>
              )}

              {(req.experience || req.cuisine_specialty) && (
                <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
                  {req.experience && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 4 }}>
                      <Text style={{ fontWeight: '700' }}>Experience:</Text> {req.experience}
                    </Text>
                  )}
                  {req.cuisine_specialty && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                      <Text style={{ fontWeight: '700' }}>Specialties:</Text> {req.cuisine_specialty}
                    </Text>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => approveChefRequest(req.id)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <Text style={{ color: '#22c55e', fontWeight: '800', textAlign: 'center' }}>
                    ✓ Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => rejectChefRequest(req.id)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '800', textAlign: 'center' }}>
                    ✗ Reject
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  const ApplicationsTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>
        Chef Applications ({filteredApplications.length} pending)
      </Text>
      
      <View style={{ marginBottom: 8 }}>
        <TextInput
          value={applicationSearch}
          onChangeText={setApplicationSearch}
          placeholder="Search by name, email, location, or ID..."
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

      {loading && applications.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : paginatedApplications.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          {applicationSearch ? 'No applications found matching your search.' : 'No pending applications.'}
        </Text>
      ) : (
        <>
          {paginatedApplications.map(app => (
            <View
              key={app.id}
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
                    {app.name || 'Unnamed Application'}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                    {app.email || 'No email'}
                  </Text>
                  {app.location && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                      📍 {app.location}
                    </Text>
                  )}
                  {app.phone && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 2 }}>
                      📞 {app.phone}
                    </Text>
                  )}
                  {app.created_at && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      Submitted: {new Date(app.created_at).toLocaleString()}
                    </Text>
                  )}
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                    ID: {app.id.substring(0, 8)}...
                  </Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}>
                  <Text style={{ color: '#eab308', fontWeight: '700', fontSize: 12 }}>
                    Pending
                  </Text>
                </View>
              </View>

              {app.short_bio && (
                <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Bio:</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                    {app.short_bio}
                  </Text>
                </View>
              )}

              {(app.experience || app.cuisine_specialty) && (
                <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
                  {app.experience && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 4 }}>
                      <Text style={{ fontWeight: '700' }}>Experience:</Text> {app.experience}
                    </Text>
                  )}
                  {app.cuisine_specialty && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                      <Text style={{ fontWeight: '700' }}>Specialties:</Text> {app.cuisine_specialty}
                    </Text>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => handleApproveApplication(app.id)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <Text style={{ color: '#22c55e', fontWeight: '800', textAlign: 'center' }}>
                    ✓ Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRejectApplication(app.id)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '800', textAlign: 'center' }}>
                    ✗ Reject
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {totalApplicationPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setApplicationPage(p => Math.max(1, p - 1))}
                disabled={applicationPage === 1}
                style={{
                  backgroundColor: applicationPage === 1 ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: applicationPage === 1 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>
                Page {applicationPage} of {totalApplicationPages} ({filteredApplications.length} total)
              </Text>
              <TouchableOpacity
                onPress={() => setApplicationPage(p => Math.min(totalApplicationPages, p + 1))}
                disabled={applicationPage === totalApplicationPages}
                style={{
                  backgroundColor: applicationPage === totalApplicationPages ? 'rgba(255,255,255,0.05)' : theme.colors.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  opacity: applicationPage === totalApplicationPages ? 0.5 : 1,
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

  const ChefsTab = (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 22, marginBottom: 8 }}>Chefs ({filteredChefs.length} total)</Text>
      
      <View style={{ marginBottom: 8 }}>
        <TextInput
          value={chefSearch}
          onChangeText={setChefSearch}
          placeholder="Search by name, location, email, or ID..."
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
      {loading && chefs.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : paginatedChefs.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          {chefSearch ? 'No chefs found matching your search.' : 'No chefs found.'}
        </Text>
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
                  backgroundColor: c.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 
                                 c.status === 'pending' ? 'rgba(234, 179, 8, 0.2)' :
                                 'rgba(107, 114, 128, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}>
                  <Text style={{ 
                    color: c.status === 'active' ? '#22c55e' : 
                           c.status === 'pending' ? '#eab308' :
                           '#6b7280', 
                    fontWeight: '700', 
                    fontSize: 12 
                  }}>
                    {c.status === 'active' ? 'Active' : c.status === 'pending' ? 'Pending' : 'Inactive'}
                  </Text>
                </View>
              </View>
              {c.bio && (
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8, fontStyle: 'italic' }}>
                  {c.bio.length > 100 ? c.bio.substring(0, 100) + '...' : c.bio}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => handleToggleChefActive(c.id, c.status !== 'active')}
                style={{
                  backgroundColor: c.status === 'active' ? 'rgba(239, 68, 68, 0.2)' : theme.colors.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : theme.colors.primary,
                }}
              >
                <Text style={{ color: theme.colors.white, fontWeight: '800', textAlign: 'center' }}>
                  {c.status === 'active' ? 'Deactivate' : 'Activate'}
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
            onPress={() => {
              loadAll();
              fetchChefRequests().then(setChefRequests);
            }}
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
            { key: 'chef-requests', title: 'Chef Requests', content: ChefRequestsTab },
            { key: 'applications', title: 'Applications', content: ApplicationsTab },
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

