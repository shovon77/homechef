'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet, Image, Platform, useWindowDimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import FilePicker from '../../components/FilePicker';
import { toggleChefActive, toggleChefFeatured, updateOrderStatus, approveChefApplication, rejectChefApplication, updateUserProfile } from '../../lib/adminActions';
import { Tabs } from '../../components/Tabs';
import { Screen } from '../../components/Screen';
import { getChefsPaginated, getOrders } from '../../lib/db';
import type { Chef, OrderWithItems, Profile } from '../../lib/types';
import { callFn } from '../../lib/fn';
import { formatEst } from '../../lib/datetime';
import { cents } from '../../lib/money';

const ITEMS_PER_PAGE = 25;
const ISSUES_PER_PAGE = 10;

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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  
  // Ensure fixed elements are not rendered on mobile
  const shouldShowFixedElements = !isMobile;
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
  const [issueActions, setIssueActions] = useState<{ [issueId: number]: string }>({});
  
  // Persist issueActions to localStorage whenever it changes
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('admin_issue_actions', JSON.stringify(issueActions));
      } catch (e) {
        console.warn('Failed to save issue actions to localStorage:', e);
      }
    }
  }, [issueActions]);
  const [openActionDropdownIssueId, setOpenActionDropdownIssueId] = useState<number | null>(null);
  const [issueDetailModalId, setIssueDetailModalId] = useState<number | null>(null);
  const [orderDetailModalId, setOrderDetailModalId] = useState<number | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundModalMessage, setRefundModalMessage] = useState('');
  const [refundModalType, setRefundModalType] = useState<'confirm' | 'success' | 'error'>('confirm');
  const [pendingRefund, setPendingRefund] = useState<{ issueId: number; orderId: number } | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    pickupAt: string | null;
    chefLocation: string | null;
    items: Array<{ id: number; dish_id: number | null; quantity: number; unit_price_cents: number; dish?: { id: number; name: string } | null }>;
    totalCents: number | null;
    platformFeeCents: number | null;
    chef: { id: number; name: string; photo?: string | null } | null;
  } | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [isPickupAddressExpanded, setIsPickupAddressExpanded] = useState(false);
  const [isPickupDateTimeExpanded, setIsPickupDateTimeExpanded] = useState(false);
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(false);
  const [issueSortBy, setIssueSortBy] = useState<'created' | 'status' | 'action' | null>(null);
  const [issueSortDir, setIssueSortDir] = useState<'asc' | 'desc'>('asc');

  function formatIssueType(type?: string) {
    switch ((type || '').toLowerCase()) {
      case 'chef_unresponsive': return 'Chef is unresponsive';
      case 'pickup_location_unclear': return 'Pickup location unclear';
      case 'chef_running_late': return "Chef's running late";
      case 'food_unavailable': return 'Food unavailable';
      case 'other': return 'Other';
      default: return type || 'Unknown';
    }
  }

  function formatPickupDateTime(pickupAt: string | null): string {
    if (!pickupAt) return 'Not available';
    try {
      const date = new Date(pickupAt);
      if (Number.isNaN(date.getTime())) return 'Not available';
      
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      const hour = date.getHours();
      const minute = date.getMinutes();
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const startTimeStr = `${hourStr}:${minuteStr}`;
      
      const endDate = new Date(date);
      endDate.setHours(endDate.getHours() + 1);
      const endHour = endDate.getHours();
      const endHour12 = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
      const endAmpm = endHour >= 12 ? 'PM' : 'AM';
      const endMinuteStr = endDate.getMinutes().toString().padStart(2, '0');
      const endTimeStr = `${endHour12}:${endMinuteStr}${endAmpm}`;
      
      return `${dateStr} - ${startTimeStr} - ${endTimeStr}`;
    } catch {
      return 'Not available';
    }
  }

  async function fetchOrderDetails(orderId: number) {
    setLoadingOrderDetails(true);
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('id, pickup_at, chef_id, total_cents, platform_fee_cents')
        .eq('id', orderId)
        .maybeSingle();
      
      if (!order) {
        Alert.alert('Error', 'Order not found');
        setOrderDetailModalId(null);
        return;
      }

      let chefLocation: string | null = null;
      let chef: { id: number; name: string; photo?: string | null } | null = null;

      if (order.chef_id) {
        const { data: chefData } = await supabase
          .from('chefs')
          .select('id, location, name, photo')
          .eq('id', order.chef_id)
          .maybeSingle();
        
        if (chefData) {
          chefLocation = chefData.location || null;
          chef = { id: chefData.id, name: chefData.name, photo: chefData.photo || null };
        }
      }

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      let items: Array<{ id: number; dish_id: number | null; quantity: number; unit_price_cents: number; dish?: { id: number; name: string } | null }> = [];
      
      if (orderItems && orderItems.length > 0) {
        const dishIds = orderItems.map(it => it.dish_id).filter((id): id is number => typeof id === 'number');
        const { data: dishes } = dishIds.length
          ? await supabase.from('dishes').select('id,name').in('id', dishIds)
          : { data: [] };
        
        const dishMap = new Map();
        (dishes || []).forEach((d: any) => dishMap.set(d.id, d));
        
        items = orderItems.map((it: any) => ({
          ...it,
          dish: it.dish_id ? dishMap.get(it.dish_id) || null : null
        }));
      }

      setOrderDetails({
        pickupAt: order.pickup_at,
        chefLocation,
        items,
        totalCents: order.total_cents,
        platformFeeCents: order.platform_fee_cents ?? null,
        chef,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to load order details');
      setOrderDetailModalId(null);
    } finally {
      setLoadingOrderDetails(false);
    }
  }

  useEffect(() => {
    if (orderDetailModalId) {
      fetchOrderDetails(orderDetailModalId);
      setIsPickupAddressExpanded(false);
      setIsPickupDateTimeExpanded(false);
      setIsOrderSummaryExpanded(false);
    } else {
      setOrderDetails(null);
    }
  }, [orderDetailModalId]);

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
          
          // Fetch user info (email and name)
          let userEmail = '';
          let userName = '';
          const userId = issue.orders?.user_id || issue.user_id;
          if (userId) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('email, name')
              .eq('id', userId)
              .single();
            userEmail = userData?.email || '';
            userName = userData?.name || '';
          }
          
          return { ...issue, images: images || [], user_email: userEmail, user_name: userName };
        })
      );

      setChefs(chefRows);
      setOrders(orderRows);
      setUsers((userRows as any[]) || []);
      setApplications((applicationRows as any[]) || []);
      setIssues(issuesWithImages);
      
      // Restore persisted issue actions from localStorage, filtering for existing issues
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('admin_issue_actions');
          if (saved) {
            const parsed = JSON.parse(saved);
            // Only restore actions for issues that still exist
            const validActions: { [issueId: number]: string } = {};
            issuesWithImages.forEach((issue: any) => {
              if (parsed[issue.id]) {
                validActions[issue.id] = parsed[issue.id];
              }
            });
            // Merge with existing actions (don't overwrite if user made changes before issues loaded)
            setIssueActions(prev => {
              const merged = { ...prev };
              Object.keys(validActions).forEach(issueId => {
                if (!merged[Number(issueId)]) {
                  merged[Number(issueId)] = validActions[Number(issueId)];
                }
              });
              return merged;
            });
          }
        } catch (e) {
          console.warn('Failed to load issue actions from localStorage:', e);
        }
      }
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

  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      const idA = Number(a.id ?? 0);
      const idB = Number(b.id ?? 0);
      const dir = issueSortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      if (issueSortBy === 'created') {
        const ta = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const tb = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        cmp = ta - tb;
      } else if (issueSortBy === 'status') {
        const sa = (a.status ?? '').toLowerCase();
        const sb = (b.status ?? '').toLowerCase();
        cmp = sa.localeCompare(sb);
      } else if (issueSortBy === 'action') {
        const aa = issueActions[a.id] ?? '';
        const ab = issueActions[b.id] ?? '';
        cmp = aa.localeCompare(ab);
      }
      if (cmp !== 0) return dir * cmp;
      return idB - idA; // always secondary: issue id descending
    });
  }, [filteredIssues, issueSortBy, issueSortDir, issueActions]);

  function toggleIssueSort(col: 'created' | 'status' | 'action') {
    if (issueSortBy === col) {
      setIssueSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setIssueSortBy(col);
      setIssueSortDir('asc');
    }
    setIssuePage(1);
  }

  useEffect(() => {
    setIssuePage(1);
  }, [issueSearch]);

  const paginatedIssues = useMemo(() => {
    const start = (issuePage - 1) * ISSUES_PER_PAGE;
    return sortedIssues.slice(start, start + ISSUES_PER_PAGE);
  }, [sortedIssues, issuePage]);

  const totalIssuePages = Math.ceil(filteredIssues.length / ISSUES_PER_PAGE);
  const issuePageScrollRef = React.useRef<ScrollView>(null);

  async function handleUpdateIssueStatus(issueId: number, newStatus: string, silent: boolean = false) {
    const { error } = await supabase
      .from('order_issues')
      .update({ 
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', issueId);
    
    if (error) {
      if (!silent) {
        Alert.alert('Error', error.message || 'Failed to update issue status');
      }
      throw error;
    } else {
      setIssues(prev => prev.map(i => 
        i.id === issueId 
          ? { ...i, status: newStatus, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }
          : i
      ));
      if (!silent) {
        Alert.alert('Success', 'Issue status updated');
      }
    }
  }

  async function handleIssueAction(issueId: number, action: string, issue?: any) {
    if (!action || action === '') return;

    if (action === 'Refund') {
      // Try multiple ways to get order_id
      const orderId = issue?.order_id ?? issue?.orders?.id ?? null;
      console.log('Refund clicked - issue:', issue, 'orderId:', orderId);
      if (!orderId || !Number.isFinite(orderId)) {
        console.error('Refund error: orderId not found', { issue, orderId });
        Alert.alert('Error', 'Cannot refund: order not found for this issue.');
        setOpenActionDropdownIssueId(null);
        return;
      }
      setOpenActionDropdownIssueId(null);
      
      // Show confirmation modal
      setPendingRefund({ issueId, orderId: Number(orderId) });
      setShowRefundModal(true);
      setRefundModalMessage('Are you sure you want to refund this order?');
      setRefundModalType('confirm');
      return;
    }

    setOpenActionDropdownIssueId(null);
    setIssueActions(prev => ({ ...prev, [issueId]: action }));

    if (action === 'Resolve') {
      await handleUpdateIssueStatus(issueId, 'resolved');
    } else if (action === 'Pending') {
      await handleUpdateIssueStatus(issueId, 'pending');
    } else if (action === 'Reviewing') {
      await handleUpdateIssueStatus(issueId, 'reviewing');
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
        return { color: palette.successText, label: 'Resolved' };
      case 'reviewing':
        return { color: palette.primary, label: 'In review' };
      case 'dismissed':
        return { color: palette.neutralText, label: 'Dismissed' };
      case 'refunded':
        return { color: palette.neutralText, label: 'Refunded' };
      default:
        return { color: palette.dangerText, label: 'Pending' };
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
    <View style={styles.issuesTabWrapper}>
      <ScrollView contentContainerStyle={[styles.tabScroll, styles.issuesTabScrollContent]} horizontal>
        <View style={styles.issuesTabInner}>
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
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <TouchableOpacity
                style={[styles.tableHeaderCellSortable, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.createdHeaderCell]}
                onPress={() => toggleIssueSort('created')}
              >
                <Text style={styles.tableHeaderCellText}>Created</Text>
                <Text style={[styles.sortIcon, { color: palette.primary }]}>
                  {issueSortBy === 'created' ? (issueSortDir === 'asc' ? '▲' : '▼') : '↕'}
                </Text>
              </TouchableOpacity>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.issueIdHeaderCell]}>
                <Text style={styles.tableHeaderCellText}>Issue ID</Text>
              </View>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 160, minWidth: 160 } : { flex: 1.5 }]}>
                <Text style={styles.tableHeaderCellText}>Order</Text>
              </View>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                <Text style={styles.tableHeaderCellText}>Chef</Text>
              </View>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                <Text style={styles.tableHeaderCellText}>User</Text>
              </View>
              <TouchableOpacity
                style={[styles.tableHeaderCellSortable, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }]}
                onPress={() => toggleIssueSort('status')}
              >
                <Text style={styles.tableHeaderCellText}>Status</Text>
                <Text style={[styles.sortIcon, { color: palette.primary }]}>
                  {issueSortBy === 'status' ? (issueSortDir === 'asc' ? '▲' : '▼') : '↕'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tableHeaderCellSortable, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }]}
                onPress={() => toggleIssueSort('action')}
              >
                <Text style={styles.tableHeaderCellText}>Action</Text>
                <Text style={[styles.sortIcon, { color: palette.primary }]}>
                  {issueSortBy === 'action' ? (issueSortDir === 'asc' ? '▲' : '▼') : '↕'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Table Rows */}
            {paginatedIssues.map((issue) => {
              const statusStyles = issueStatusStyles(issue.status);
              
              return (
                <View key={issue.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.createdCell]}>
                    {formatEst(issue.created_at)}
                  </Text>
                  <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.issueIdCell]}>
                    <Text>{issue.id}</Text>
                    <TouchableOpacity onPress={() => setIssueDetailModalId(issue.id)}>
                      <Text style={styles.viewDetailsLink}>View details</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.tableCell, isMobile ? { width: 160, minWidth: 160 } : { flex: 1.5 }, styles.orderIdCell]}>
                    <Text>{issue.order_id}</Text>
                    <TouchableOpacity onPress={() => setOrderDetailModalId(issue.order_id)}>
                      <Text style={styles.viewDetailsLink}>View details</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }, styles.chefCell]}>
                    <Text style={styles.chefNameText} numberOfLines={1}>{issue.chefs?.name || 'Unknown'}</Text>
                    {issue.chefs?.id && (
                      <Link href={`/chef/${issue.chefs.id}`} asChild>
                        <TouchableOpacity style={styles.chefLinkIcon}>
                          <Text style={styles.chefLinkIconText}>↗</Text>
                        </TouchableOpacity>
                      </Link>
                    )}
                  </View>
                  <Text style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]} numberOfLines={1}>
                    {(issue as any).user_name || 'Unknown'}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }, { color: statusStyles.color }]}>
                    {statusStyles.label}
                  </Text>
                  <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.actionCellWrapper]}>
                    <View style={styles.actionDropdownWrapper}>
                      {issue.status === 'refunded' || issueActions[issue.id] === 'Refund' ? (
                        <View style={[styles.actionButton, styles.actionButtonReadOnly]}>
                          <Text style={[styles.actionButtonText, styles.actionButtonTextReadOnly]}>Refund</Text>
                        </View>
                      ) : issueActions[issue.id] ? (
                        <>
                          <TouchableOpacity
                            style={styles.actionButtonSelected}
                            onPress={() => setOpenActionDropdownIssueId(prev => prev === issue.id ? null : issue.id)}
                          >
                            <Text style={styles.actionButtonTextSelected}>{issueActions[issue.id]}</Text>
                            <Text style={styles.actionDropdownIcon}>▼</Text>
                          </TouchableOpacity>
                          {!isMobile && openActionDropdownIssueId === issue.id && (
                            <View style={styles.actionDropdownMenu}>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Resolve', issue)}
                              >
                                <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Resolve' && styles.actionDropdownOptionTextSelected]}>Resolve</Text>
                              </TouchableOpacity>
                              {issueActions[issue.id] !== 'Refund' && (
                                <TouchableOpacity
                                  style={styles.actionDropdownOption}
                                  onPress={() => handleIssueAction(issue.id, 'Refund', issue)}
                                >
                                  <Text style={styles.actionDropdownOptionText}>Refund</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Pending', issue)}
                              >
                                <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Pending' && styles.actionDropdownOptionTextSelected]}>Pending</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Reviewing', issue)}
                              >
                                <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Reviewing' && styles.actionDropdownOptionTextSelected]}>Reviewing</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setOpenActionDropdownIssueId(prev => prev === issue.id ? null : issue.id)}
                          >
                            <Text style={styles.actionButtonText}>Select...</Text>
                            <Text style={styles.actionDropdownIcon}>▼</Text>
                          </TouchableOpacity>
                          {!isMobile && openActionDropdownIssueId === issue.id && (
                            <View style={styles.actionDropdownMenu}>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Resolve', issue)}
                              >
                                <Text style={styles.actionDropdownOptionText}>Resolve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Refund', issue)}
                              >
                                <Text style={styles.actionDropdownOptionText}>Refund</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Pending', issue)}
                              >
                                <Text style={styles.actionDropdownOptionText}>Pending</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionDropdownOption}
                                onPress={() => handleIssueAction(issue.id, 'Reviewing', issue)}
                              >
                                <Text style={styles.actionDropdownOptionText}>Reviewing</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {totalIssuePages > 0 && (
              <View style={styles.issuesPaginationWrap}>
                {isMobile && (
                  <View style={styles.issuesPaginationMobileInfo}>
                    <Text style={styles.paginationStatus}>
                      Page {issuePage} of {totalIssuePages}
                    </Text>
                    <Text style={styles.issuesTotalText}>{filteredIssues.length} total</Text>
                  </View>
                )}
                {totalIssuePages > 1 && (
                  <ScrollView
                    ref={issuePageScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator
                    contentContainerStyle={styles.issuesPageScrollContent}
                    style={styles.issuesPageScroll}
                  >
                    {Array.from({ length: totalIssuePages }, (_, i) => i + 1).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setIssuePage(p)}
                        style={[styles.issuesPageButton, issuePage === p && styles.issuesPageButtonActive]}
                      >
                        <Text style={[styles.issuesPageButtonText, issuePage === p && styles.issuesPageButtonTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {isMobile && openActionDropdownIssueId !== null && (() => {
              const issue = paginatedIssues.find((i: any) => i.id === openActionDropdownIssueId);
              if (!issue) return null;
              return (
                <Modal
                  visible
                  transparent
                  animationType="fade"
                  onRequestClose={() => setOpenActionDropdownIssueId(null)}
                >
                  <TouchableOpacity
                    style={styles.actionModalOverlay}
                    activeOpacity={1}
                    onPress={() => setOpenActionDropdownIssueId(null)}
                  >
                    <TouchableOpacity
                      style={styles.actionModalContent}
                      activeOpacity={1}
                      onPress={() => {}}
                    >
                      {issueActions[issue.id] === 'Refund' ? (
                        <View style={styles.actionDropdownOption}>
                          <Text style={[styles.actionDropdownOptionText, styles.actionDropdownOptionTextReadOnly]}>Refund</Text>
                        </View>
                      ) : issueActions[issue.id] ? (
                        <>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Resolve', issue)}
                          >
                            <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Resolve' && styles.actionDropdownOptionTextSelected]}>Resolve</Text>
                          </TouchableOpacity>
                          {issueActions[issue.id] !== 'Refund' && (
                            <TouchableOpacity
                              style={styles.actionDropdownOption}
                              onPress={() => handleIssueAction(issue.id, 'Refund', issue)}
                            >
                              <Text style={styles.actionDropdownOptionText}>Refund</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Pending', issue)}
                          >
                            <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Pending' && styles.actionDropdownOptionTextSelected]}>Pending</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Reviewing', issue)}
                          >
                            <Text style={[styles.actionDropdownOptionText, issueActions[issue.id] === 'Reviewing' && styles.actionDropdownOptionTextSelected]}>Reviewing</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Resolve', issue)}
                          >
                            <Text style={styles.actionDropdownOptionText}>Resolve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Refund', issue)}
                          >
                            <Text style={styles.actionDropdownOptionText}>Refund</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Pending', issue)}
                          >
                            <Text style={styles.actionDropdownOptionText}>Pending</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionDropdownOption}
                            onPress={() => handleIssueAction(issue.id, 'Reviewing', issue)}
                          >
                            <Text style={styles.actionDropdownOptionText}>Reviewing</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>
              );
            })()}

            {issueDetailModalId !== null && (() => {
              const issue = issues.find((i: any) => i.id === issueDetailModalId);
              if (!issue) return null;
              const imgs = (issue.images || []) as Array<{ id: number; image_url: string }>;
              return (
                <Modal
                  visible
                  transparent
                  animationType="fade"
                  onRequestClose={() => setIssueDetailModalId(null)}
                >
                  <TouchableOpacity
                    style={styles.issueDetailOverlay}
                    activeOpacity={1}
                    onPress={() => setIssueDetailModalId(null)}
                  >
                    <TouchableOpacity
                      style={styles.issueDetailContent}
                      activeOpacity={1}
                      onPress={() => {}}
                    >
                      <View style={styles.issueDetailHeader}>
                        <Text style={styles.issueDetailTitle}>Issue #{issue.id}</Text>
                        <TouchableOpacity
                          style={styles.issueDetailClose}
                          onPress={() => setIssueDetailModalId(null)}
                        >
                          <Text style={styles.issueDetailCloseText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        style={styles.issueDetailBody}
                        contentContainerStyle={styles.issueDetailBodyContent}
                        showsVerticalScrollIndicator
                      >
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>User</Text>
                          <Text style={styles.issueDetailValue}>{issue.user_email || '—'}</Text>
                        </View>
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>Chef</Text>
                          <Text style={styles.issueDetailValue}>{issue.chefs?.name || '—'}{issue.chefs?.email ? ` (${issue.chefs.email})` : ''}</Text>
                        </View>
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>Order</Text>
                          <Text style={styles.issueDetailValue}>{issue.order_id ?? '—'}</Text>
                        </View>
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>Issue type</Text>
                          <Text style={styles.issueDetailValue}>{formatIssueType(issue.issue_type)}</Text>
                        </View>
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>Status</Text>
                          <Text style={[styles.issueDetailValue, { color: issueStatusStyles(issue.status).color }]}>
                            {issueStatusStyles(issue.status).label}
                          </Text>
                        </View>
                        <View style={styles.issueDetailRow}>
                          <Text style={styles.issueDetailLabel}>Created</Text>
                          <Text style={styles.issueDetailValue}>{formatEst(issue.created_at)}</Text>
                        </View>
                        {(issue.additional_details?.trim() ?? '') !== '' && (
                          <View style={styles.issueDetailRow}>
                            <Text style={styles.issueDetailLabel}>Additional comments</Text>
                            <Text style={styles.issueDetailValue}>{issue.additional_details}</Text>
                          </View>
                        )}
                        {imgs.length > 0 && (
                          <View style={styles.issueDetailRow}>
                            <Text style={styles.issueDetailLabel}>Pictures</Text>
                            <View style={styles.issueDetailImages}>
                              {imgs.map((img) => (
                                <Image
                                  key={img.id}
                                  source={{ uri: img.image_url }}
                                  style={styles.issueDetailImage}
                                  resizeMode="cover"
                                />
                              ))}
                            </View>
                          </View>
                        )}
                      </ScrollView>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>
              );
            })()}

            {orderDetailModalId !== null && (() => {
              if (loadingOrderDetails) {
                return (
                  <Modal visible transparent animationType="fade" onRequestClose={() => setOrderDetailModalId(null)}>
                    <View style={styles.issueDetailOverlay}>
                      <View style={styles.issueDetailContent}>
                        <ActivityIndicator size="large" color={palette.primary} />
                        <Text style={{ marginTop: 16, color: palette.text }}>Loading order details...</Text>
                      </View>
                    </View>
                  </Modal>
                );
              }
              
              if (!orderDetails) return null;
              
              const subtotalCents = orderDetails.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
              const platformFeeCents = orderDetails.platformFeeCents !== null ? orderDetails.platformFeeCents : 150;
              const taxesCents = Math.round(subtotalCents * 0.13);
              const totalCents = orderDetails.totalCents !== null ? orderDetails.totalCents : subtotalCents + platformFeeCents + taxesCents;
              
              return (
                <Modal
                  visible
                  transparent
                  animationType="fade"
                  onRequestClose={() => setOrderDetailModalId(null)}
                >
                  <TouchableOpacity
                    style={styles.issueDetailOverlay}
                    activeOpacity={1}
                    onPress={() => setOrderDetailModalId(null)}
                  >
                    <TouchableOpacity
                      style={styles.issueDetailContent}
                      activeOpacity={1}
                      onPress={() => {}}
                    >
                      <View style={styles.issueDetailHeader}>
                        <Text style={styles.issueDetailTitle}>Order #{String(orderDetailModalId).padStart(5, '0')}</Text>
                        <TouchableOpacity
                          style={styles.issueDetailClose}
                          onPress={() => setOrderDetailModalId(null)}
                        >
                          <Text style={styles.issueDetailCloseText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        style={styles.issueDetailBody}
                        contentContainerStyle={styles.issueDetailBodyContent}
                        showsVerticalScrollIndicator
                      >
                        {orderDetails.chefLocation && (
                          <View style={styles.orderDetailSectionCard}>
                            <TouchableOpacity
                              style={styles.orderDetailSectionHeader}
                              onPress={() => setIsPickupAddressExpanded(!isPickupAddressExpanded)}
                            >
                              <Text style={styles.issueDetailLabel}>Pickup address</Text>
                              <Text style={styles.expandIcon}>{isPickupAddressExpanded ? '−' : '+'}</Text>
                            </TouchableOpacity>
                            {isPickupAddressExpanded && (
                              <View style={styles.orderDetailSectionContent}>
                                <Text style={styles.issueDetailValue}>{orderDetails.chefLocation}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {orderDetails.pickupAt && (
                          <View style={styles.orderDetailSectionCard}>
                            <TouchableOpacity
                              style={styles.orderDetailSectionHeader}
                              onPress={() => setIsPickupDateTimeExpanded(!isPickupDateTimeExpanded)}
                            >
                              <Text style={styles.issueDetailLabel}>Pickup date & time</Text>
                              <Text style={styles.expandIcon}>{isPickupDateTimeExpanded ? '−' : '+'}</Text>
                            </TouchableOpacity>
                            {isPickupDateTimeExpanded && (
                              <View style={styles.orderDetailSectionContent}>
                                <Text style={styles.issueDetailValue}>{formatPickupDateTime(orderDetails.pickupAt)}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {orderDetails.items.length > 0 && (
                          <View style={styles.orderDetailSectionCard}>
                            <TouchableOpacity
                              style={styles.orderDetailSectionHeader}
                              onPress={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
                            >
                              <Text style={styles.issueDetailLabel}>Order summary</Text>
                              <Text style={styles.expandIcon}>{isOrderSummaryExpanded ? '−' : '+'}</Text>
                            </TouchableOpacity>
                            {isOrderSummaryExpanded && (
                              <View style={styles.orderDetailSectionContent}>
                                {orderDetails.items.map(item => (
                                  <View key={item.id} style={styles.orderItemRow}>
                                    <View style={styles.orderItemInfo}>
                                      <Text style={styles.orderItemName}>
                                        {item.dish?.name ?? `Dish #${item.dish_id}`} {orderDetails.chef ? `(${orderDetails.chef.name})` : ''}
                                      </Text>
                                    </View>
                                    <View style={styles.orderItemQuantityPrice}>
                                      <Text style={styles.orderItemQuantity}>{item.quantity}</Text>
                                      <Text style={styles.orderItemPrice}>{cents(item.unit_price_cents * item.quantity)}</Text>
                                    </View>
                                  </View>
                                ))}
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryRow}>
                                  <Text style={styles.summaryLabel}>Subtotal</Text>
                                  <Text style={styles.summaryValue}>{cents(subtotalCents)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                  <Text style={styles.summaryLabel}>Platform service fee</Text>
                                  <Text style={styles.summaryValue}>{cents(platformFeeCents)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                  <Text style={styles.summaryLabel}>Taxes</Text>
                                  <Text style={styles.summaryValue}>{cents(taxesCents)}</Text>
                                </View>
                                <View style={[styles.summaryRow, { marginTop: 8 }]}>
                                  <Text style={[styles.summaryLabel, styles.summaryTotalLabel]}>Total</Text>
                                  <Text style={[styles.summaryValue, styles.summaryTotalValue]}>{cents(totalCents)}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </ScrollView>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>
              );
            })()}

            {showRefundModal && (
              <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={() => {
                  setShowRefundModal(false);
                  setPendingRefund(null);
                }}
              >
                <TouchableOpacity
                  style={styles.issueDetailOverlay}
                  activeOpacity={1}
                  onPress={() => {
                    if (refundModalType !== 'confirm') {
                      setShowRefundModal(false);
                      setPendingRefund(null);
                    }
                  }}
                >
                  <TouchableOpacity
                    style={styles.issueDetailContent}
                    activeOpacity={1}
                    onPress={() => {}}
                  >
                    <View style={styles.issueDetailHeader}>
                      <Text style={styles.issueDetailTitle}>
                        {refundModalType === 'confirm' ? 'Confirm Refund' : refundModalType === 'success' ? 'Success' : 'Error'}
                      </Text>
                      <TouchableOpacity
                        style={styles.issueDetailClose}
                        onPress={() => {
                          setShowRefundModal(false);
                          setPendingRefund(null);
                        }}
                      >
                        <Text style={styles.issueDetailCloseText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.issueDetailBody}>
                      <Text style={[styles.issueDetailValue, { marginBottom: 24, textAlign: 'center' }]}>
                        {refundModalMessage}
                      </Text>
                      {refundModalType === 'confirm' && pendingRefund && (
                        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                          <TouchableOpacity
                            style={[styles.primaryButton, { flex: 1 }]}
                            onPress={async () => {
                              setShowRefundModal(false);
                              setIssueActions(prev => ({ ...prev, [pendingRefund.issueId]: 'Refund' }));
                              try {
                                await callFn('cancel-payment', { orderId: pendingRefund.orderId, reason: 'chef_rejected' });
                                // Update issue status to refunded (silent mode to avoid duplicate alerts)
                                await handleUpdateIssueStatus(pendingRefund.issueId, 'refunded', true);
                                setRefundModalMessage('Refund has been initiated for the order.');
                                setRefundModalType('success');
                                setShowRefundModal(true);
                                setPendingRefund(null);
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : 'Failed to initiate refund. Please try again.';
                                setRefundModalMessage(msg);
                                setRefundModalType('error');
                                setShowRefundModal(true);
                                setPendingRefund(null);
                                // Remove Refund from actions if it failed
                                setIssueActions(prev => {
                                  const next = { ...prev };
                                  delete next[pendingRefund.issueId];
                                  return next;
                                });
                              }
                            }}
                          >
                            <Text style={styles.primaryButtonText}>Confirm</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.secondaryButton, { flex: 1 }]}
                            onPress={() => {
                              setShowRefundModal(false);
                              setPendingRefund(null);
                            }}
                          >
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {refundModalType !== 'confirm' && (
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={() => {
                            setShowRefundModal(false);
                            setPendingRefund(null);
                          }}
                        >
                          <Text style={styles.primaryButtonText}>OK</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            )}

          </View>
        )}
        </View>
      </ScrollView>
      {/* Fixed page number and total count in bottom of viewport - hidden on mobile */}
      {shouldShowFixedElements && totalIssuePages > 0 && (
        <View style={styles.issuesPageNumberFixed}>
          <Text style={styles.paginationStatus}>
            Page {issuePage} of {totalIssuePages}
          </Text>
        </View>
      )}
      {shouldShowFixedElements && (
        <View style={styles.issuesTotalFixed}>
          <Text style={styles.issuesTotalText}>{filteredIssues.length} total</Text>
        </View>
      )}
    </View>
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
          <Text style={styles.loadingText}>Loading</Text>
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 13,
    lineHeight: 20,
  },
  issuesPaginationWrap: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 0,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  issuesPaginationMobileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  issuesPageScroll: {
    maxHeight: 44,
  },
  issuesPageScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 16,
  },
  issuesPageButton: {
    minWidth: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issuesPageButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  issuesPageButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 14,
  },
  issuesPageButtonTextActive: {
    color: '#FFFFFF',
  },
  issuesTabWrapper: {
    position: 'relative',
    flex: 1,
  },
  issuesTabScrollContent: {
    paddingBottom: 60,
  },
  issuesTabInner: {
    paddingBottom: 0,
  },
  issuesPageNumberFixed: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingVertical: 0,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  issuesTotalFixed: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingVertical: 0,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  issuesTotalText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  issueDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  issueDetailContent: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
      default: {
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
    }),
  },
  issueDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  issueDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  issueDetailClose: {
    padding: 4,
  },
  issueDetailCloseText: {
    fontSize: 18,
    color: palette.muted,
    fontWeight: '600',
  },
  issueDetailBody: {
    flex: 1,
  },
  issueDetailBodyContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 16,
  },
  issueDetailRow: {
    gap: 6,
  },
  issueDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
  },
  issueDetailValue: {
    fontSize: 15,
    color: palette.text,
    lineHeight: 22,
  },
  issueDetailImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  issueDetailImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: palette.border,
  },
  orderDetailSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 12,
    marginBottom: 24,
  },
  orderDetailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
  },
  orderDetailSectionContent: {
    paddingTop: 12,
    paddingLeft: 24,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderItemName: {
    fontSize: 15,
    color: palette.text,
    lineHeight: 22,
  },
  orderItemQuantityPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderItemQuantity: {
    fontSize: 15,
    color: palette.text,
    minWidth: 24,
    textAlign: 'right',
  },
  orderItemPrice: {
    fontSize: 15,
    color: palette.text,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: palette.text,
  },
  summaryValue: {
    fontSize: 15,
    color: palette.text,
    fontWeight: '600',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  expandIcon: {
    fontSize: 18,
    color: palette.text,
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
  tableContainer: {
    position: 'relative',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    minWidth: 1060,
  },
  tableHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tableHeaderCellSortable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tableHeaderCellText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sortIcon: {
    fontSize: 16,
    marginLeft: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 1060,
  },
  tableCell: {
    color: palette.text,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  createdCell: {
    paddingRight: 4,
  },
  createdHeaderCell: {
    paddingRight: 4,
  },
  issueIdHeaderCell: {
    paddingLeft: 4,
  },
  issueIdCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingLeft: 4,
  },
  orderIdCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewDetailsLink: {
    color: palette.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  chefCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  chefNameText: {
    color: palette.text,
    fontSize: 14,
  },
  chefLinkIcon: {
    padding: 0,
    marginLeft: 2,
  },
  chefLinkIconText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionCellWrapper: {
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDropdownWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    position: 'relative',
    zIndex: 1,
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 120,
    width: '100%',
  },
  actionButtonText: {
    color: palette.text,
    fontSize: 14,
  },
  actionButtonReadOnly: {
    opacity: 0.6,
    borderColor: palette.muted,
  },
  actionButtonTextReadOnly: {
    color: palette.muted,
  },
  actionButtonSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 120,
    width: '100%',
  },
  actionButtonTextSelected: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionDropdownIcon: {
    color: palette.primary,
    fontSize: 12,
    marginLeft: 6,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContent: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 180,
    alignSelf: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  actionDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 120,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  actionDropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionDropdownOptionText: {
    color: palette.text,
    fontSize: 14,
  },
  actionDropdownOptionTextSelected: {
    color: palette.primary,
    fontWeight: '600',
  },
  actionDropdownOptionTextReadOnly: {
    color: palette.muted,
    opacity: 0.6,
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

