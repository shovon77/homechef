'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import FilePicker from '../../components/FilePicker';
import { toggleChefActive, toggleChefFeatured, updateOrderStatus, approveChefApplication, rejectChefApplication, updateUserProfile } from '../../lib/adminActions';
import { Tabs } from '../../components/Tabs';
import { Screen } from '../../components/Screen';
import { getChefsPaginated, getOrders } from '../../lib/db';
import type { Chef, OrderWithItems, Profile } from '../../lib/types';
import { callFn } from '../../lib/fn';

const ITEMS_PER_PAGE = 25;

const palette = {
  background: '#F2F0EF',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#33393A',
  muted: '#64748B',
  primary: '#FE734C',
  primaryDark: '#D9583B',
  successBg: '#E7F6EC',
  successText: '#1E794F',
  warningBg: '#FEF3C7',
  warningText: '#B45309',
  dangerBg: '#FEE2E2',
  dangerText: '#B91C1C',
  neutralBg: '#E2E8F0',
  neutralText: '#475569',
};

export default function AdminPage() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const tabKeys = ['overview', 'chef-requests', 'chefs', 'users', 'orders', 'issues'];
  const initialTabIdx = tabKeys.indexOf(tab || 'overview');
  const safeInitial = initialTabIdx >= 0 ? initialTabIdx : 0;
  const { isAdmin, loading: adminLoading, user, profile } = useRole();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [chefPage, setChefPage] = useState(1);
  const [chefSearch, setChefSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState('');
  const [chefRequests, setChefRequests] = useState<any[]>([]);
  const [chefReqSearch, setChefReqSearch] = useState('');
  const [autoRejecting, setAutoRejecting] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [issueSearch, setIssueSearch] = useState('');
  const [issuePage, setIssuePage] = useState(1);
  const [expandedSections, setExpandedSections] = useState<{ [chefId: number]: { [section: string]: boolean } }>({});
  const [bannerUrl, setBannerUrl] = useState('');
  const [originalBannerUrl, setOriginalBannerUrl] = useState('');
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function fetchChefRequests() {
    // Fetch pending chefs that have a profile record (linked via user_id)
    // First, get all pending chefs with user_id
    const { data: pendingChefs, error: chefsError } = await supabase
      .from('chefs')
      .select('id, name, email, phone, location, bio, cuisine, status, created_at, user_id, pickup_availability')
      .eq('status', 'pending')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (chefsError) {
      console.error('fetchChefRequests - chefs query', chefsError);
      return [];
    }
    
    if (!pendingChefs || pendingChefs.length === 0) {
      return [];
    }
    
    // Get all user_ids from pending chefs
    const userIds = pendingChefs.map(c => c.user_id).filter(Boolean) as string[];
    
    if (userIds.length === 0) {
      return [];
    }
    
    // Check which user_ids have profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', userIds);
    
    if (profilesError) {
      console.error('fetchChefRequests - profiles query', profilesError);
      return [];
    }
    
    // Create a set of user_ids that have profiles
    const profileUserIds = new Set((profiles || []).map(p => p.id));
    
    // Filter chefs to only include those with profiles
    const chefsWithProfiles = pendingChefs.filter(chef => chef.user_id && profileUserIds.has(chef.user_id));
    
    // Fetch dishes for each chef
    const chefIds = chefsWithProfiles.map(c => c.id);
    if (chefIds.length > 0) {
      const { data: dishesData } = await supabase
        .from('dishes')
        .select('id, chef_id, name, price, portion, description, ingredients, image, thumbnail')
        .in('chef_id', chefIds);
      
      // Group dishes by chef_id
      const dishesByChef = new Map<number, any[]>();
      (dishesData || []).forEach(dish => {
        if (dish.chef_id) {
          if (!dishesByChef.has(dish.chef_id)) {
            dishesByChef.set(dish.chef_id, []);
          }
          dishesByChef.get(dish.chef_id)!.push(dish);
        }
      });
      
      // Add dishes to each chef
      return chefsWithProfiles.map(chef => ({
        ...chef,
        dishes: dishesByChef.get(chef.id) || []
      }));
    }
    
    return chefsWithProfiles.map(chef => ({ ...chef, dishes: [] }));
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
      
      // Load banner setting
      const { data: bannerData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'banner_url')
        .single();
      
      if (bannerData?.value) {
        setBannerUrl(bannerData.value);
        setOriginalBannerUrl(bannerData.value);
      }

      // Load order issues with related data
      const { data: issuesData } = await supabase
        .from('order_issues')
        .select(`
          *,
          orders!order_issues_order_id_fkey (id, total_cents, created_at, user_id),
          chefs!order_issues_chef_id_fkey (id, name, email)
        `)
        .order('created_at', { ascending: false });
      
      // Fetch images for each issue
      const issuesWithImages = await Promise.all(
        (issuesData || []).map(async (issue: any) => {
          const { data: images } = await supabase
            .from('order_issue_images')
            .select('*')
            .eq('issue_id', issue.id);
          
          // Fetch user email
          let userEmail = '';
          if (issue.user_id) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', issue.user_id)
              .single();
            userEmail = userData?.email || '';
          }
          
          return { ...issue, images: images || [], user_email: userEmail };
        })
      );

      setChefs(chefRows);
      setOrders(orderRows);
      setUsers((userRows as any[]) || []);
      setApplications((applicationRows as any[]) || []);
      setIssues(issuesWithImages);
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

  async function handleToggleChefFeatured(id: number, featured: boolean) {
    const result = await toggleChefFeatured(id, featured);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, featured } : c));
    } else {
      setErr(result.error || 'Failed to update chef featured status');
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

  async function approveChefRequest(id: number) {
    // Activate the chef (change status from 'pending' to 'active')
    const result = await toggleChefActive(id, true);
    if (result.ok) {
      Alert.alert('Success', 'Chef activated');
      setChefRequests(prev => prev.filter(r => r.id !== id));
      loadAll(); // Reload to show updated chef
    } else {
      Alert.alert('Error', result.error || 'Failed to activate chef');
    }
  }

  async function rejectChefRequest(id: number) {
    Alert.alert(
      'Reject Chef',
      'Are you sure you want to reject this chef? This will remove them from the pending list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            // Delete the chef record or set status to rejected
            const { error } = await supabase
              .from('chefs')
              .delete()
              .eq('id', id);
            
            if (error) {
              Alert.alert('Error', error.message || 'Failed to reject chef');
            } else {
              Alert.alert('Success', 'Chef rejected');
              setChefRequests(prev => prev.filter(r => r.id !== id));
              loadAll();
            }
          }
        }
      ]
    );
  }

  async function handleDeactivateUser(id: string) {
    Alert.alert('Deactivate User', 'Are you sure you want to deactivate this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        const result = await updateUserProfile(id, { role: 'banned' });
        if (result.ok) {
          setUsers(us => us.map(u => u.id === id ? { ...u, role: 'banned' } : u));
          Alert.alert('Success', 'User deactivated');
        } else {
          setErr(result.error || 'Failed to deactivate user');
        }
      }}
    ]);
  }

  async function runAutoReject() {
    if (autoRejecting) return;
    try {
      setAutoRejecting(true);
      const result = await callFn<{ checked?: number; rejected?: number }>('auto-reject-expired');
      Alert.alert(
        'Auto-reject executed',
        `Checked ${result?.checked ?? 0} orders; rejected ${result?.rejected ?? 0}.`
      );
      await loadAll();
    } catch (error: any) {
      Alert.alert('Auto-reject failed', error?.message || 'Unable to run auto-reject.');
    } finally {
      setAutoRejecting(false);
    }
  }

  async function updateBanner() {
    if (!bannerUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    setSavingBanner(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'banner_url', value: bannerUrl.trim() });
      
      if (error) throw error;
      setOriginalBannerUrl(bannerUrl);
      Alert.alert('Success', 'Banner updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update banner. Make sure app_settings table exists.');
    } finally {
      setSavingBanner(false);
    }
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'png';
      const fileName = `banner_${Date.now()}.${fileExt || 'png'}`;
      const filePath = `${fileName}`;

      console.log('Starting upload...', { fileName, filePath });

      // Try 'public-assets' bucket first (user specified)
      let bucket = 'public-assets';
      
      let { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.warn(`Upload to '${bucket}' failed:`, uploadError);
        
        // Try fallback buckets
        const fallbacks = ['public', 'assets', 'images', 'common'];
        for (const b of fallbacks) {
          console.log(`Retrying upload to '${b}'...`);
          const res = await supabase.storage.from(b).upload(filePath, file, { upsert: true });
          if (!res.error) {
            bucket = b;
            uploadError = null;
            data = res.data;
            console.log(`Upload to '${b}' succeeded`);
            break;
          } else {
            console.warn(`Upload to '${b}' failed:`, res.error);
          }
        }
        
        if (uploadError) {
          throw uploadError;
        }
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        console.log('Public URL generated:', urlData.publicUrl);
        setBannerUrl(urlData.publicUrl);
      }
    } catch (error: any) {
      console.error('Upload error details:', error);
      const msg = error.message || 'Unknown upload error';
      if (msg.includes('400') || msg.includes('row-level security')) {
         Alert.alert('Upload Failed', `Storage Error (${msg}).\n\nPlease ensure a public storage bucket named 'public' exists in Supabase and has proper RLS policies allowing uploads.`);
      } else {
         Alert.alert('Upload Failed', `Could not upload file: ${msg}`);
      }
    } finally {
      setUploading(false);
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
      (r.bio ?? '').toLowerCase().includes(q) ||
      (r.cuisine ?? '').toLowerCase().includes(q) ||
      String(r.id).toLowerCase().includes(q)
    );
  }, [chefRequests, chefReqSearch]);

  const filteredIssues = useMemo(() => {
    if (!Array.isArray(issues)) return [];
    const q = (issueSearch ?? '').toLowerCase().trim();
    if (!q) return issues;
    return issues.filter(i =>
      String(i.order_id).includes(q) ||
      (i.issue_type ?? '').toLowerCase().includes(q) ||
      (i.status ?? '').toLowerCase().includes(q) ||
      (i.additional_details ?? '').toLowerCase().includes(q) ||
      (i.user_email ?? '').toLowerCase().includes(q) ||
      (i.chefs?.name ?? '').toLowerCase().includes(q)
    );
  }, [issues, issueSearch]);

  useEffect(() => {
    setIssuePage(1);
  }, [issueSearch]);

  const paginatedIssues = useMemo(() => {
    const start = (issuePage - 1) * ITEMS_PER_PAGE;
    return filteredIssues.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIssues, issuePage]);

  const totalIssuePages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);

  async function handleUpdateIssueStatus(issueId: number, newStatus: string) {
    const { error } = await supabase
      .from('order_issues')
      .update({ 
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', issueId);
    
    if (error) {
      Alert.alert('Error', error.message || 'Failed to update issue status');
    } else {
      setIssues(prev => prev.map(i => 
        i.id === issueId 
          ? { ...i, status: newStatus, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }
          : i
      ));
      Alert.alert('Success', 'Issue status updated');
    }
  }

  const chefStatusStyles = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
        return { container: [styles.statusPill, styles.statusSuccess], text: styles.statusTextSuccess };
      case 'pending':
        return { container: [styles.statusPill, styles.statusPending], text: styles.statusTextPending };
      default:
        return { container: [styles.statusPill, styles.statusNeutral], text: styles.statusTextNeutral };
    }
  };

  const chefStatusText = (status?: string) => {
    if (!status) return 'Pending';
    const normalized = status.toLowerCase();
    if (normalized === 'active') return 'Active';
    if (normalized === 'pending') return 'Pending';
    return 'Inactive';
  };

  const orderStatusStyles = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return { container: [styles.statusPill, styles.statusSuccess], text: styles.statusTextSuccess };
      case 'cancelled':
      case 'rejected':
        return { container: [styles.statusPill, styles.statusDanger], text: styles.statusTextDanger };
      case 'paid':
      case 'ready':
        return { container: [styles.statusPill, styles.statusAccent], text: styles.statusTextAccent };
      default:
        return { container: [styles.statusPill, styles.statusPending], text: styles.statusTextPending };
    }
  };

  const orderStatusLabel = (status?: string) => status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';

  const issueStatusStyles = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'resolved':
        return { container: [styles.statusPill, styles.statusSuccess], text: styles.statusTextSuccess };
      case 'reviewing':
        return { container: [styles.statusPill, styles.statusAccent], text: styles.statusTextAccent };
      case 'dismissed':
        return { container: [styles.statusPill, styles.statusNeutral], text: styles.statusTextNeutral };
      default:
        return { container: [styles.statusPill, styles.statusPending], text: styles.statusTextPending };
    }
  };

  const issueTypeLabel = (type?: string) => {
    switch (type) {
      case 'chef_unresponsive': return 'Chef Unresponsive';
      case 'pickup_location_unclear': return 'Pickup Location Unclear';
      case 'chef_running_late': return "Chef Running Late";
      case 'food_unavailable': return 'Food Unavailable';
      case 'other': return 'Other';
      default: return type || 'Unknown';
    }
  };

  const overviewStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);

    let weeklyCents = 0;
    let monthlyCents = 0;
    let totalCents = 0;
    let orderCount = 0;

    (orders || []).forEach((order) => {
      if (!order || typeof order.total_cents !== 'number') return;
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      totalCents += order.total_cents ?? 0;
      orderCount += 1;
      
      // Only count platform fees for orders where payment has been captured
      // Platform fees are collected when payment is captured (indicated by stripe_transfer_id)
      const platformFee = order.platform_fee_cents ?? 0;
      const hasTransfer = Boolean((order as any).stripe_transfer_id);
      
      // Count fees only if payment was captured (transfer exists) and fee is positive
      if (createdAt && hasTransfer && platformFee > 0) {
        if (createdAt >= monthAgo) {
          monthlyCents += platformFee;
        }
        if (createdAt >= weekAgo) {
          weeklyCents += platformFee;
        }
      }
    });

    const totalUsers = Array.isArray(users) ? users.length : 0;
    const totalChefs = Array.isArray(chefs) ? chefs.length : 0;

    return {
      weeklyCents,
      monthlyCents,
      totalCents,
      orderCount,
      totalUsers,
      totalChefs,
    };
  }, [orders, users, chefs]);

  const formatCad = (value: number) => (value / 100).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  });

  const ChefRequestsTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Chef Requests ({filteredChefRequests.length} pending)</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          value={chefReqSearch}
          onChangeText={setChefReqSearch}
          placeholder="Search by name, email, phone, location, or ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading && chefRequests.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : filteredChefRequests.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{chefReqSearch ? 'No requests found matching your search.' : 'No pending requests.'}</Text></View>
      ) : (
        filteredChefRequests.map((req) => {
          const isExpanded = (section: string) => expandedSections[req.id]?.[section] ?? false;
          const toggleSection = (section: string) => {
            setExpandedSections(prev => ({
              ...prev,
              [req.id]: {
                ...prev[req.id],
                [section]: !isExpanded(section)
              }
            }));
          };

          // Group pickup slots by day for display
          const slotsByDay: { [day: string]: string[] } = {};
          if (req.pickup_availability && Array.isArray(req.pickup_availability)) {
            req.pickup_availability.forEach((slot: any) => {
              if (!slotsByDay[slot.day]) {
                slotsByDay[slot.day] = [];
              }
              slotsByDay[slot.day].push(slot.timeWindow);
            });
          }

          return (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{req.name || 'Unnamed Request'}</Text>
                  {req.created_at ? (
                    <Text style={styles.cardTimestamp}>Submitted: {new Date(req.created_at).toLocaleString()}</Text>
                  ) : null}
                  <Text style={styles.cardId}>ID: {String(req.id)}</Text>
                </View>
                <View style={[styles.statusPill, styles.statusPending]}>
                  <Text style={[styles.statusPillText, styles.statusTextPending]}>Pending</Text>
                </View>
              </View>

              {/* Chef profile basics - Collapsible */}
              <View style={styles.reviewSection}>
                <TouchableOpacity 
                  style={styles.reviewSectionHeader}
                  onPress={() => toggleSection('basics')}
                >
                  <Text style={styles.reviewSectionTitle}>Chef profile basics</Text>
                  <Text style={styles.expandIcon}>{isExpanded('basics') ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                {isExpanded('basics') && (
                  <View style={styles.reviewSectionContent}>
                    <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Email:</Text> {req.email || 'Not set'}</Text>
                    {req.phone ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Phone:</Text> {req.phone}</Text> : null}
                    {req.location ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Address:</Text> {req.location}</Text> : null}
                    {req.bio ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Brief Description:</Text> {req.bio}</Text> : null}
                    {req.cuisine ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Cuisine Type:</Text> {req.cuisine}</Text> : null}
                  </View>
                )}
              </View>

              {/* Availability & pickup - Collapsible */}
              {req.pickup_availability && Array.isArray(req.pickup_availability) && req.pickup_availability.length > 0 ? (
                <View style={styles.reviewSection}>
                  <TouchableOpacity 
                    style={styles.reviewSectionHeader}
                    onPress={() => toggleSection('availability')}
                  >
                    <Text style={styles.reviewSectionTitle}>Availability & pickup</Text>
                    <Text style={styles.expandIcon}>{isExpanded('availability') ? '▼' : '▶'}</Text>
                  </TouchableOpacity>
                  {isExpanded('availability') && (
                    <View style={styles.reviewSectionContent}>
                      {Object.entries(slotsByDay).map(([day, timeWindows]) => (
                        <Text key={day} style={styles.reviewItem}>
                          <Text style={styles.reviewLabel}>{day}:</Text> {timeWindows.join(', ')}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {/* Dishes - Collapsible */}
              {req.dishes && req.dishes.length > 0 ? (
                <View style={styles.reviewSection}>
                  <TouchableOpacity 
                    style={styles.reviewSectionHeader}
                    onPress={() => toggleSection('dishes')}
                  >
                    <Text style={styles.reviewSectionTitle}>Dishes ({req.dishes.length})</Text>
                    <Text style={styles.expandIcon}>{isExpanded('dishes') ? '▼' : '▶'}</Text>
                  </TouchableOpacity>
                  {isExpanded('dishes') && (
                    <View style={styles.reviewSectionContent}>
                      {req.dishes.map((dish: any) => (
                        <View key={dish.id} style={styles.dishItem}>
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                            {(dish.image || dish.thumbnail) && (
                              <Image 
                                source={{ uri: dish.image || dish.thumbnail }} 
                                style={styles.dishImage}
                                resizeMode="cover"
                              />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.reviewItem, { fontWeight: '700', marginBottom: 4 }]}>{dish.name}</Text>
                              <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Price:</Text> ${Number(dish.price).toFixed(2)}</Text>
                              {dish.portion ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Portion:</Text> {dish.portion}</Text> : null}
                            </View>
                          </View>
                          {dish.description ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Description:</Text> {dish.description}</Text> : null}
                          {dish.ingredients ? <Text style={styles.reviewItem}><Text style={styles.reviewLabel}>Ingredients:</Text> {dish.ingredients}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.cardActionsRow}>
                <TouchableOpacity style={[styles.chipButton, styles.approveButton]} onPress={() => approveChefRequest(req.id)}>
                  <Text style={[styles.chipButtonText, styles.approveButtonText]}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chipButton, styles.rejectButton]} onPress={() => rejectChefRequest(req.id)}>
                  <Text style={[styles.chipButtonText, styles.rejectButtonText]}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const OverviewTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Platform earnings</Text>
          <Text style={styles.chartSubtitle}>Rolling totals, last 7 vs 30 days</Text>
        </View>
        <View style={styles.earningsChartRow}>
          {[
            { label: 'This week', value: overviewStats.weeklyCents },
            { label: 'This month', value: overviewStats.monthlyCents },
          ].map(({ label, value }) => {
            const max = Math.max(overviewStats.weeklyCents, overviewStats.monthlyCents, 1);
            const height = Math.round((value / (max || 1)) * 140);
            return (
              <View key={label} style={styles.earningsBarWrapper}>
                <View style={[styles.earningsBar, { height: Math.max(height, 8) }]} />
                <Text style={styles.earningsValue}>{formatCad(value)}</Text>
                <Text style={styles.earningsLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Marketplace snapshot</Text>
          <Text style={styles.chartSubtitle}>Live counts across the platform</Text>
        </View>
        <View style={styles.metricsList}>
          {[
            { label: 'Users', value: overviewStats.totalUsers, formatted: overviewStats.totalUsers.toLocaleString() },
            { label: 'Chefs', value: overviewStats.totalChefs, formatted: overviewStats.totalChefs.toLocaleString() },
            { label: 'Orders', value: overviewStats.orderCount, formatted: overviewStats.orderCount.toLocaleString() },
            { label: 'Order volume (CAD)', value: overviewStats.totalCents / 100, formatted: formatCad(overviewStats.totalCents) },
          ].map((metric) => {
            const maxValue = Math.max(
              overviewStats.totalUsers,
              overviewStats.totalChefs,
              overviewStats.orderCount,
              overviewStats.totalCents / 100,
              1,
            );
            const widthPercent = `${Math.min(100, (metric.value / (maxValue || 1)) * 100)}%`;
            return (
              <View key={metric.label} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <View style={styles.metricBarTrack}>
                  <View style={[styles.metricBarFill, { width: widthPercent }]} />
                </View>
                <Text style={styles.metricValue}>{metric.formatted}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Homepage Banner</Text>
          <Text style={styles.chartSubtitle}>Update the main hero image</Text>
        </View>
        <View style={styles.searchWrapper}>
          {bannerUrl ? (
            <View style={styles.bannerPreviewContainer}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} resizeMode="cover" />
            </View>
          ) : null}
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <FilePicker 
              label={uploading ? "Uploading..." : "Upload New Image"} 
              onFile={handleUpload} 
            />
            {uploading && <ActivityIndicator size="small" color={palette.primary} />}
          </View>

          <Text style={styles.helperText}>
            Recommended dimensions: Desktop 1920x600px, Mobile 800x600px.
          </Text>

          {bannerUrl !== originalBannerUrl && (
            <TouchableOpacity
              onPress={updateBanner}
              disabled={savingBanner || uploading}
              style={[styles.primaryButton, (savingBanner || uploading) && styles.disabledButton, { marginTop: 8 }]}
            >
              <Text style={styles.primaryButtonText}>{savingBanner ? 'Publishing...' : 'Publish Changes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const ChefsTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Chefs ({filteredChefs.length} total)</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          value={chefSearch}
          onChangeText={setChefSearch}
          placeholder="Search by name, location, email, or ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>
      {loading && chefs.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedChefs.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{chefSearch ? 'No chefs found matching your search.' : 'No chefs found.'}</Text></View>
      ) : (
        <>
          {paginatedChefs.map((c) => {
            const statusStyles = chefStatusStyles(c.status);
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.name || `Chef #${c.id}`}</Text>
                    <Text style={styles.cardMeta}>
                      {c.location || 'No location'}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </Text>
                  </View>
                  <View style={statusStyles.container}>
                    <Text style={[styles.statusPillText, statusStyles.text]}>{chefStatusText(c.status)}</Text>
                  </View>
                </View>
                {c.bio ? <Text style={styles.cardBodyMuted}>{c.bio.length > 140 ? `${c.bio.slice(0, 140)}…` : c.bio}</Text> : null}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleToggleChefActive(c.id, c.status !== 'active')}
                    style={c.status === 'active'
                      ? [styles.dangerOutlineButton, styles.cardActionButton]
                      : [styles.primaryButton, styles.cardActionButton]}
                  >
                    <Text style={c.status === 'active' ? styles.dangerOutlineButtonText : styles.primaryButtonText}>
                      {c.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggleChefFeatured(c.id, !(c as any).featured)}
                    style={(c as any).featured
                      ? [styles.successOutlineButton, styles.cardActionButton]
                      : [styles.neutralOutlineButton, styles.cardActionButton]}
                  >
                    <Text style={(c as any).featured ? styles.successOutlineButtonText : styles.neutralOutlineButtonText}>
                      {(c as any).featured ? '★ Featured' : '☆ Feature'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {totalChefPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                onPress={() => setChefPage((p) => Math.max(1, p - 1))}
                disabled={chefPage === 1}
                style={[styles.paginationButton, chefPage === 1 && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, chefPage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationStatus}>Page {chefPage} of {totalChefPages}</Text>
              <TouchableOpacity
                onPress={() => setChefPage((p) => Math.min(totalChefPages, p + 1))}
                disabled={chefPage === totalChefPages}
                style={[styles.paginationButton, chefPage === totalChefPages && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, chefPage === totalChefPages && styles.paginationButtonTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const UsersTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Users (non-chefs)</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          value={userSearch}
          onChangeText={setUserSearch}
          placeholder="Search by email, name, or ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedUsers.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{userSearch ? 'No users found matching your search.' : 'No non-chef users found.'}</Text></View>
      ) : (
        <>
          {paginatedUsers.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{u.name || u.email || u.id}</Text>
              <Text style={styles.cardMeta}>{u.email || 'No email'}</Text>
              <Text style={styles.cardId}>ID: {u.id}</Text>
                  {u.role === 'banned' && <Text style={{ color: palette.dangerText, fontWeight: '700', marginTop: 4 }}>Banned</Text>}
                </View>
                {u.role !== 'banned' && (
                  <TouchableOpacity
                    onPress={() => handleDeactivateUser(u.id)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Deactivate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {totalUserPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                onPress={() => setUserPage((p) => Math.max(1, p - 1))}
                disabled={userPage === 1}
                style={[styles.paginationButton, userPage === 1 && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, userPage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationStatus}>Page {userPage} of {totalUserPages} ({filteredUsers.length} total)</Text>
              <TouchableOpacity
                onPress={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                disabled={userPage === totalUserPages}
                style={[styles.paginationButton, userPage === totalUserPages && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, userPage === totalUserPages && styles.paginationButtonTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const OrdersTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Orders ({filteredOrders.length} total)</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          value={orderSearch}
          onChangeText={setOrderSearch}
          placeholder="Search by status, email, or order ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedOrders.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{orderSearch ? 'No orders found matching your search.' : 'No orders found.'}</Text></View>
      ) : (
        <>
          {paginatedOrders.map((o) => (
            <OrderCard key={o.id} order={o} onStatusUpdate={handleUpdateOrderStatus} />
          ))}
          {totalOrderPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                onPress={() => setOrderPage((p) => Math.max(1, p - 1))}
                disabled={orderPage === 1}
                style={[styles.paginationButton, orderPage === 1 && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, orderPage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationStatus}>Page {orderPage} of {totalOrderPages} ({filteredOrders.length} total)</Text>
              <TouchableOpacity
                onPress={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                disabled={orderPage === totalOrderPages}
                style={[styles.paginationButton, orderPage === totalOrderPages && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, orderPage === totalOrderPages && styles.paginationButtonTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const IssuesTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Order Issues ({filteredIssues.length} total)</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          value={issueSearch}
          onChangeText={setIssueSearch}
          placeholder="Search by order ID, issue type, status, or chef name..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading && issues.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedIssues.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{issueSearch ? 'No issues found matching your search.' : 'No issues reported.'}</Text></View>
      ) : (
        <>
          {paginatedIssues.map((issue) => {
            const statusStyles = issueStatusStyles(issue.status);
            const statusOptions = ['pending', 'reviewing', 'resolved', 'dismissed'];
            const currentStatus = (issue.status || '').toLowerCase();
            
            return (
              <View key={issue.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Issue #{issue.id}</Text>
                    <Text style={styles.cardMeta}>Order #{issue.order_id}</Text>
                    <Text style={styles.cardMeta}>Chef: {issue.chefs?.name || 'Unknown'}</Text>
                    <Text style={styles.cardMeta}>Customer: {issue.user_email || 'Unknown'}</Text>
                    {issue.created_at && (
                      <Text style={styles.cardTimestamp}>
                        Reported: {new Date(issue.created_at).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <View style={statusStyles.container}>
                    <Text style={[styles.statusPillText, statusStyles.text]}>
                      {issue.status ? issue.status.charAt(0).toUpperCase() + issue.status.slice(1) : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={styles.dividerSection}>
                  <Text style={styles.sectionLabel}>Issue Type</Text>
                  <View style={[styles.statusPill, styles.statusPending, { alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[styles.statusPillText, styles.statusTextPending]}>{issueTypeLabel(issue.issue_type)}</Text>
                  </View>
                </View>

                {issue.additional_details && (
                  <View style={styles.dividerSection}>
                    <Text style={styles.sectionLabel}>Additional Details</Text>
                    <Text style={styles.cardBodyMuted}>{issue.additional_details}</Text>
                  </View>
                )}

                {issue.images && issue.images.length > 0 && (
                  <View style={styles.dividerSection}>
                    <Text style={styles.sectionLabel}>Attached Images ({issue.images.length})</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {issue.images.map((img: any) => (
                        <Image
                          key={img.id}
                          source={{ uri: img.image_url }}
                          style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: palette.border }}
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  </View>
                )}

                {issue.reviewed_at && (
                  <View style={styles.dividerSection}>
                    <Text style={styles.sectionLabel}>Review Info</Text>
                    <Text style={styles.cardMeta}>
                      Reviewed: {new Date(issue.reviewed_at).toLocaleString()}
                    </Text>
                    {issue.resolution_notes && (
                      <Text style={styles.cardBodyMuted}>{issue.resolution_notes}</Text>
                    )}
                  </View>
                )}

                <View style={styles.segmentRow}>
                  {statusOptions.map((status) => {
                    const active = currentStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        onPress={() => handleUpdateIssueStatus(issue.id, status)}
                        disabled={active}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {totalIssuePages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                onPress={() => setIssuePage((p) => Math.max(1, p - 1))}
                disabled={issuePage === 1}
                style={[styles.paginationButton, issuePage === 1 && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, issuePage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationStatus}>Page {issuePage} of {totalIssuePages} ({filteredIssues.length} total)</Text>
              <TouchableOpacity
                onPress={() => setIssuePage((p) => Math.min(totalIssuePages, p + 1))}
                disabled={issuePage === totalIssuePages}
                style={[styles.paginationButton, issuePage === totalIssuePages && styles.paginationButtonDisabled]}
              >
                <Text style={[styles.paginationButtonText, issuePage === totalIssuePages && styles.paginationButtonTextDisabled]}>Next</Text>
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
    const totalDollars = formatCad(order.total_cents || 0);
    const badgeStyles = orderStatusStyles(order.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Order #{order.id}</Text>
            <Text style={styles.cardMeta}>
              User: {order.user_email || (order.user_id ? `${order.user_id.substring(0, 8)}…` : '—')}
            </Text>
            <Text style={styles.cardTotal}>{totalDollars}</Text>
            {order.created_at ? <Text style={styles.cardTimestamp}>{new Date(order.created_at).toLocaleString()}</Text> : null}
          </View>
          <View style={badgeStyles.container}>
            <Text style={[styles.statusPillText, badgeStyles.text]}>{orderStatusLabel(order.status)}</Text>
          </View>
        </View>

        {order.order_items && order.order_items.length > 0 ? (
          <View style={styles.dividerSection}>
            <Text style={styles.sectionLabel}>Items</Text>
            {order.order_items.map((item) => {
              const itemTotal = formatCad(item.unit_price_cents * item.quantity);
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.dish_name || `Dish #${item.dish_id}`}</Text>
                    <Text style={styles.itemMeta}>
                      Qty: {item.quantity} × {formatCad(item.unit_price_cents || 0)}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{itemTotal}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.segmentRow}>
          {statusOptions.map((status) => {
            const active = currentStatus === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => onStatusUpdate(order.id, status)}
                disabled={active}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
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
      <Screen style={{ backgroundColor: palette.background }}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Checking admin access…</Text>
        </View>
      </Screen>
    );
  }
 
   if (!isAdmin) {
     return (
      <Screen style={{ backgroundColor: palette.background }}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Admin access required</Text>
          <Text style={styles.accessDeniedSubtitle}>
            Signed in as: {user?.email || '— not signed in —'}
          </Text>
          <TouchableOpacity onPress={() => router.replace('/')} style={[styles.primaryButton, styles.accessDeniedButton]}>
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
   }
 
   const content = (
    <View style={styles.wrapper}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Welcome, {profile?.name ? profile.name.split(' ')[0] : 'Admin'}!</Text>
            <Text style={styles.headerSubtitle}>Monitor requests, chefs, users, and orders at a glance.</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                loadAll();
                fetchChefRequests().then(setChefRequests);
              }}
              disabled={loading}
              style={[styles.actionButton, styles.primaryButton, loading && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {err ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{err}</Text>
          </View>
        ) : null}
        <Tabs
          activeColor={palette.primary}
          initial={safeInitial}
          onTabChange={(key) => router.setParams({ tab: key })}
          tabs={[
            { key: 'overview', title: 'Overview', content: OverviewTab },
            { key: 'chef-requests', title: 'Chef Requests', content: ChefRequestsTab },
            { key: 'chefs', title: 'Chefs', content: ChefsTab },
            { key: 'users', title: 'Users', content: UsersTab },
            { key: 'orders', title: 'Orders', content: OrdersTab },
            { key: 'issues', title: 'Issues', content: IssuesTab },
          ]}
        />
      </View>
    </View>
  );
 
   return (
    <Screen style={{ backgroundColor: palette.background }} contentStyle={styles.screenContent}>
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  wrapper: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: palette.muted,
    fontSize: 15,
    marginTop: 4,
    maxWidth: 360,
  },
  headerActions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    marginLeft: 12,
  },
  firstActionButton: {
    marginLeft: 0,
  },
  actionButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  warningButton: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  errorBanner: {
    backgroundColor: palette.dangerBg,
    borderColor: palette.dangerText,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: palette.dangerText,
    fontWeight: '700',
  },
  tabScroll: {
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchWrapper: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: palette.text,
    fontSize: 14,
  },
  loadingState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 14,
    marginBottom: 2,
  },
  cardTimestamp: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  cardId: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
  },
  cardBodyMuted: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardTotal: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  statusPending: {
    backgroundColor: '#FFF5F2',
  },
  statusSuccess: {
    backgroundColor: palette.successBg,
  },
  statusNeutral: {
    backgroundColor: palette.neutralBg,
  },
  statusDanger: {
    backgroundColor: palette.dangerBg,
  },
  statusAccent: {
    backgroundColor: '#DBEAFE',
  },
  statusTextPending: {
    color: palette.primary,
  },
  statusTextSuccess: {
    color: palette.successText,
  },
  statusTextNeutral: {
    color: palette.neutralText,
  },
  statusTextDanger: {
    color: palette.dangerText,
  },
  statusTextAccent: {
    color: '#1D4ED8',
  },
  dividerSection: {
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  sectionLabel: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  sectionLabelInline: {
    fontWeight: '700',
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginRight: -12,
  },
  chipButton: {
    flexGrow: 1,
    minWidth: 140,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#F8FBF8',
    marginRight: 12,
    marginBottom: 12,
  },
  chipButtonText: {
    fontWeight: '700',
    textAlign: 'center',
    color: palette.text,
  },
  approveButton: {
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  approveButtonText: {
    color: palette.primary,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  rejectButtonText: {
    color: palette.primary,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 12,
  },
  paginationButton: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: palette.muted,
  },
  paginationStatus: {
    color: palette.muted,
    fontWeight: '600',
  },
  cardActionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 12,
    marginTop: 8,
  },
  dangerOutlineButton: {
    borderColor: palette.dangerText,
    borderWidth: 1,
    backgroundColor: '#FFF5F5',
  },
  dangerOutlineButtonText: {
    color: palette.dangerText,
    fontWeight: '700',
    textAlign: 'center',
  },
  successOutlineButton: {
    borderColor: palette.successText,
    borderWidth: 1,
    backgroundColor: palette.successBg,
  },
  successOutlineButtonText: {
    color: palette.successText,
    fontWeight: '700',
    textAlign: 'center',
  },
  neutralOutlineButton: {
    borderColor: palette.border,
    borderWidth: 1,
    backgroundColor: palette.surface,
  },
  neutralOutlineButtonText: {
    color: palette.muted,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginRight: -8,
  },
  segmentButton: {
    backgroundColor: '#F8FAFC',
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  segmentButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  segmentButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 12,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitle: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  itemMeta: {
    color: palette.muted,
    fontSize: 12,
  },
  itemPrice: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 14,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: palette.muted,
    marginTop: 16,
  },
  accessDenied: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessDeniedTitle: {
    color: palette.dangerText,
    fontWeight: '800',
    fontSize: 20,
    marginBottom: 8,
  },
  accessDeniedSubtitle: {
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  accessDeniedButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  placeholderCard: {
    backgroundColor: '#F0F9EB',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: palette.surface,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
  },
  expandIcon: {
    fontSize: 12,
    color: palette.primary,
  },
  reviewSectionContent: {
    padding: 16,
    gap: 8,
  },
  reviewItem: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  reviewLabel: {
    fontWeight: '700',
    color: palette.text,
  },
  dishItem: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  dishImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: palette.border,
  },
  chartCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.02,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
  chartSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  earningsChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  earningsBarWrapper: {
    alignItems: 'center',
    width: '45%',
  },
  earningsBar: {
    width: '100%',
    maxWidth: 120,
    borderRadius: 12,
    backgroundColor: palette.primary,
    marginBottom: 12,
  },
  earningsValue: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  earningsLabel: {
    color: palette.muted,
    fontSize: 13,
  },
  metricsList: {
    paddingHorizontal: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  metricBarTrack: {
    flex: 2,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E9F0EB',
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 999,
  },
  metricValue: {
    minWidth: 90,
    textAlign: 'right',
    color: palette.text,
    fontWeight: '600',
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  bannerPreviewContainer: {
    marginBottom: 16,
  },
  bannerPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
});

