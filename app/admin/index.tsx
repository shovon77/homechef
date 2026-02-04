'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet, Image, Platform, useWindowDimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../hooks/useRole';
import FilePicker from '../../components/FilePicker';
import { toggleChefActive, toggleChefFeatured, updateOrderStatus, approveChefApplication, rejectChefApplication, updateUserProfile, suspendChef, reinstateChef } from '../../lib/adminActions';
import { Tabs } from '../../components/Tabs';
import { Screen } from '../../components/Screen';
import { getChefsPaginated, getOrders } from '../../lib/db';
import type { Chef, OrderWithItems, Profile } from '../../lib/types';
import { callFn } from '../../lib/fn';
import { formatEst } from '../../lib/datetime';
import { cents } from '../../lib/money';
import { theme } from '../../lib/theme';
import { createNotification } from '../../lib/notifications';

const ITEMS_PER_PAGE = 25;
const ISSUES_PER_PAGE = 10;
const ORDERS_PER_PAGE = 10;
const CHEFS_PER_PAGE = 10;

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

// Use theme fonts like rest of app - display for bold/headings, body for regular text

export default function AdminPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  
  // Ensure fixed elements are not rendered on mobile
  const shouldShowFixedElements = !isMobile;
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const tabKeys = ['overview', 'orders', 'chefs', 'users', 'finance', 'issues', 'notifications', 'app-settings'];
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
  const [orderSortBy, setOrderSortBy] = useState<'created' | 'status' | 'total'>('created');
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('desc');
  const [ordersWithChefs, setOrdersWithChefs] = useState<any[]>([]);
  const [chefsWithStats, setChefsWithStats] = useState<any[]>([]);
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
  const [aboutUsBannerUrl, setAboutUsBannerUrl] = useState('');
  const [originalAboutUsBannerUrl, setOriginalAboutUsBannerUrl] = useState('');
  const [savingAboutUsBanner, setSavingAboutUsBanner] = useState(false);
  const [uploadingAboutUsBanner, setUploadingAboutUsBanner] = useState(false);
  const [chefOnboardingBannerUrl, setChefOnboardingBannerUrl] = useState('');
  const [originalChefOnboardingBannerUrl, setOriginalChefOnboardingBannerUrl] = useState('');
  const [savingChefOnboardingBanner, setSavingChefOnboardingBanner] = useState(false);
  const [uploadingChefOnboardingBanner, setUploadingChefOnboardingBanner] = useState(false);
  const [searchPlaceholders, setSearchPlaceholders] = useState<string[]>(['', '', '', '', '']);
  const [originalSearchPlaceholders, setOriginalSearchPlaceholders] = useState<string[]>(['', '', '', '', '']);
  const [savingPlaceholders, setSavingPlaceholders] = useState(false);
  const [issueActions, setIssueActions] = useState<{ [issueId: number]: string }>({});
  const [pendingIssuesCount, setPendingIssuesCount] = useState(0);
  const [pendingChefApplicationsCount, setPendingChefApplicationsCount] = useState(0);
  const [dailyActiveUsers, setDailyActiveUsers] = useState(0);
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState(0);
  const [snapshotDateFilter, setSnapshotDateFilter] = useState<'today' | 'last7days' | 'last15days' | 'last30days' | 'last3months' | 'last6months' | 'alltime'>('alltime');
  const [financeDateFilter, setFinanceDateFilter] = useState<'today' | 'last7days' | 'last15days' | 'last30days' | 'last3months' | 'last6months' | 'alltime'>('alltime');
  const [showSnapshotDropdown, setShowSnapshotDropdown] = useState(false);
  const [showFinanceDropdown, setShowFinanceDropdown] = useState(false);
  const [financeOrderSearch, setFinanceOrderSearch] = useState('');
  const [notificationRecipientFilter, setNotificationRecipientFilter] = useState<string>('all');
  const [showNotificationRecipientDropdown, setShowNotificationRecipientDropdown] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<Array<{
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    created_at: string;
    user_name: string | null;
  }>>([]);

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
  const [openActionDropdownOrderId, setOpenActionDropdownOrderId] = useState<number | null>(null);
  const [issueDetailModalId, setIssueDetailModalId] = useState<number | null>(null);
  const [orderDetailModalId, setOrderDetailModalId] = useState<number | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundModalMessage, setRefundModalMessage] = useState('');
  const [refundModalType, setRefundModalType] = useState<'confirm' | 'success' | 'error'>('confirm');
  const [pendingRefund, setPendingRefund] = useState<{ issueId: number; orderId: number } | null>(null);
  const [chefApplicationModalId, setChefApplicationModalId] = useState<number | null>(null);
  const [chefApplicationData, setChefApplicationData] = useState<any>(null);
  const [chefApplicationPage, setChefApplicationPage] = useState(1);
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
      
      // Enhance orders with chef names
      const chefIds = [...new Set(orderRows.map(o => o.chef_id).filter((id): id is number => id !== null))];
      const { data: chefsData } = chefIds.length > 0
        ? await supabase.from('chefs').select('id, name').in('id', chefIds)
        : { data: [] };
      
      const chefMap = new Map();
      (chefsData || []).forEach((c: any) => chefMap.set(c.id, c));
      
      const ordersWithChefNames = orderRows.map((o: any) => ({
        ...o,
        chef: o.chef_id ? chefMap.get(o.chef_id) || null : null,
      }));
      
      // Load users from profiles table
      const { data: userRows } = await supabase
        .from('profiles')
        .select('id,email,is_chef,name,is_admin,role')
        .order('id', { ascending: true });
      
      // Enhance users with order statistics
      const userIds = (userRows || []).map((u: any) => u.id);
      const { data: userOrders } = userIds.length > 0
        ? await supabase
            .from('orders')
            .select('user_id, total_cents')
            .in('user_id', userIds)
        : { data: [] };
      
      // Calculate order count and total spend per user
      const userStats = new Map();
      (userOrders || []).forEach((order: any) => {
        const userId = order.user_id;
        if (!userStats.has(userId)) {
          userStats.set(userId, { orderCount: 0, totalSpend: 0 });
        }
        const stats = userStats.get(userId);
        stats.orderCount += 1;
        stats.totalSpend += order.total_cents || 0;
      });
      
      const usersWithStats = (userRows || []).map((u: any) => {
        const stats = userStats.get(u.id) || { orderCount: 0, totalSpend: 0 };
        return {
          ...u,
          orderCount: stats.orderCount,
          totalSpend: stats.totalSpend,
        };
      });
      
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

      // Load About Us banner
      const { data: aboutUsBannerData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'about_us_banner_url')
        .single();
      
      if (aboutUsBannerData?.value) {
        setAboutUsBannerUrl(aboutUsBannerData.value);
        setOriginalAboutUsBannerUrl(aboutUsBannerData.value);
      }

      // Load Chef Onboarding banner
      const { data: chefOnboardingBannerData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'chef_onboarding_banner_url')
        .single();
      
      if (chefOnboardingBannerData?.value) {
        setChefOnboardingBannerUrl(chefOnboardingBannerData.value);
        setOriginalChefOnboardingBannerUrl(chefOnboardingBannerData.value);
      }

      // Load search placeholder texts
      const { data: placeholdersData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'search_placeholders')
        .single();
      
      if (placeholdersData?.value) {
        try {
          const parsed = JSON.parse(placeholdersData.value);
          if (Array.isArray(parsed) && parsed.length === 5) {
            setSearchPlaceholders(parsed);
            setOriginalSearchPlaceholders(parsed);
          }
        } catch (e) {
          console.warn('Failed to parse search placeholders:', e);
        }
      } else {
        // Default placeholders if not set
        const defaults = [
          "Craving spicy mutton biryani?",
          "Or maybe a classic chicken pulao?",
          "No wait, let's get a quick fuchka?",
          "Jhalmuri & shingara like school days?",
          "Find the taste of home here!"
        ];
        setSearchPlaceholders(defaults);
        setOriginalSearchPlaceholders(defaults);
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

      // Filter chefs to only show those with a corresponding profile
      const chefUserIds = chefRows.map((c: any) => c.user_id).filter(Boolean) as string[];
      let chefsWithProfiles = chefRows;
      
      if (chefUserIds.length > 0) {
        // Check which user_ids have profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id')
          .in('id', chefUserIds);
        
        const profileUserIds = new Set((profilesData || []).map((p: any) => p.id));
        chefsWithProfiles = chefRows.filter((chef: any) => 
          chef.user_id && profileUserIds.has(chef.user_id)
        );
      } else {
        // If no chefs have user_id, show empty list
        chefsWithProfiles = [];
      }

      // Enhance chefs with sales and complaints
      // Calculate sales per chef from orders
      const chefSales = new Map();
      orderRows.forEach((order: any) => {
        if (order.chef_id) {
          if (!chefSales.has(order.chef_id)) {
            chefSales.set(order.chef_id, 0);
          }
          chefSales.set(order.chef_id, chefSales.get(order.chef_id) + (order.total_cents || 0));
        }
      });
      
      // Calculate complaints per chef from order_issues
      const chefComplaints = new Map();
      (issuesData || []).forEach((issue: any) => {
        if (issue.chef_id) {
          if (!chefComplaints.has(issue.chef_id)) {
            chefComplaints.set(issue.chef_id, 0);
          }
          chefComplaints.set(issue.chef_id, chefComplaints.get(issue.chef_id) + 1);
        }
      });
      
      const chefsWithStatsData = chefsWithProfiles.map((chef: any) => ({
        ...chef,
        sales: chefSales.get(chef.id) || 0,
        complaints: chefComplaints.get(chef.id) || 0,
      }));

      setChefs(chefRows);
      setChefsWithStats(chefsWithStatsData);
      setOrders(orderRows);
      setOrdersWithChefs(ordersWithChefNames);
      setUsers(usersWithStats || []);
      setApplications((applicationRows as any[]) || []);
      setIssues(issuesWithImages);

      // Load all notifications for admin log (requires admin RLS policy)
      const { data: notificationsData } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (notificationsData && notificationsData.length > 0) {
        const userIds = [...new Set(notificationsData.map((n: any) => n.user_id).filter(Boolean))];
        const { data: profilesData } = userIds.length > 0
          ? await supabase.from('profiles').select('id, name, email').in('id', userIds)
          : { data: [] };
        const nameMap = new Map((profilesData || []).map((p: any) => [p.id, (p.name || p.email || 'Unknown').trim() || 'Unknown']));
        setAdminNotifications(notificationsData.map((n: any) => ({
          ...n,
          user_name: nameMap.get(n.user_id) ?? 'Unknown',
        })));
      } else {
        setAdminNotifications([]);
      }
      
      // Fetch actionable counts
      // Count issues pending review (status is 'pending' or 'reviewing')
      const { count: pendingIssues } = await supabase
        .from('order_issues')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'reviewing']);
      
      setPendingIssuesCount(pendingIssues || 0);
      
      // Count pending chef applications (status is 'submitted' or 'pending')
      // Also check chefs table for pending status
      const { count: pendingApplications } = await supabase
        .from('chef_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['submitted', 'pending']);
      
      // Also count chefs with pending status that don't have applications
      const { count: pendingChefs } = await supabase
        .from('chefs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      setPendingChefApplicationsCount((pendingApplications || 0) + (pendingChefs || 0));
      
      // Fetch engagement metrics - unique active users based on login time
      // Use RPC function to access auth.users.last_sign_in_at
      try {
        const { data: loginStats, error: rpcError } = await supabase
          .rpc('get_user_login_stats');
        
        if (rpcError) {
          console.warn('Failed to fetch login stats:', rpcError);
          setDailyActiveUsers(0);
          setMonthlyActiveUsers(0);
        } else if (loginStats && loginStats.length > 0) {
          setDailyActiveUsers(loginStats[0].daily_active_users || 0);
          setMonthlyActiveUsers(loginStats[0].monthly_active_users || 0);
        } else {
          setDailyActiveUsers(0);
          setMonthlyActiveUsers(0);
        }
      } catch (error) {
        console.warn('Failed to fetch engagement metrics:', error);
        setDailyActiveUsers(0);
        setMonthlyActiveUsers(0);
      }
      
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
      setChefsWithStats(cs => cs.map(c => c.id === id ? { ...c, status: next ? 'active' : 'pending' } : c));
    } else {
      setErr(result.error || 'Failed to update chef');
    }
  }

  async function handleToggleChefFeatured(id: number, featured: boolean) {
    const result = await toggleChefFeatured(id, featured);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, featured } : c));
      setChefsWithStats(cs => cs.map(c => c.id === id ? { ...c, featured } : c));
    } else {
      setErr(result.error || 'Failed to update chef featured status');
    }
  }

  async function handleSuspendChef(id: number) {
    const result = await suspendChef(id);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, status: 'suspended' } : c));
      setChefsWithStats(cs => cs.map(c => c.id === id ? { ...c, status: 'suspended' } : c));
      Alert.alert('Success', 'Chef has been suspended');
    } else {
      setErr(result.error || 'Failed to suspend chef');
      Alert.alert('Error', result.error || 'Failed to suspend chef');
    }
  }

  async function handleReinstateChef(id: number) {
    const result = await reinstateChef(id);
    if (result.ok) {
      setChefs(cs => cs.map(c => c.id === id ? { ...c, status: 'active' } : c));
      setChefsWithStats(cs => cs.map(c => c.id === id ? { ...c, status: 'active' } : c));
      Alert.alert('Success', 'Chef has been reinstated');
    } else {
      setErr(result.error || 'Failed to reinstate chef');
      Alert.alert('Error', result.error || 'Failed to reinstate chef');
    }
  }

  async function handleViewApplication(chefId: number, userId: string | null) {
    console.log('handleViewApplication called:', { chefId, userId });
    
    if (!userId) {
      Alert.alert('Error', 'Chef user ID not found');
      return;
    }
    
    // Set modal ID immediately to show modal
    setChefApplicationModalId(chefId);
    setChefApplicationPage(1);
    setChefApplicationData(null); // Clear previous data
    
    try {
      // Fetch application data - first try chef_applications table
      const { data: application, error: appError } = await supabase
        .from('chef_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log('Application fetch result:', { application, appError });
      
      if (appError) {
        console.error('Error fetching application:', appError);
      }
      
      // If no application found, use chef data as application data
      if (!application) {
        const chef = chefsWithStats.find(c => c.id === chefId);
        console.log('No application found, using chef data:', chef);
        
        if (chef) {
          // Fetch dishes for this chef
          const { data: dishesData, error: dishesError } = await supabase
            .from('dishes')
            .select('*')
            .eq('chef_id', chefId);
          
          if (dishesError) {
            console.error('Error fetching dishes:', dishesError);
          }
          
          const applicationData = {
            ...chef,
            dishes: dishesData || [],
            status: chef.status === 'pending' ? 'submitted' : (chef.status === 'active' ? 'approved' : 'rejected'),
          };
          
          console.log('Setting application data:', applicationData);
          setChefApplicationData(applicationData);
        } else {
          Alert.alert('Error', 'Chef not found');
          setChefApplicationModalId(null);
        }
      } else {
        // Fetch dishes for this chef
        const { data: dishesData, error: dishesError } = await supabase
          .from('dishes')
          .select('*')
          .eq('chef_id', chefId);
        
        if (dishesError) {
          console.error('Error fetching dishes:', dishesError);
        }
        
        const applicationData = {
          ...application,
          dishes: dishesData || [],
        };
        
        console.log('Setting application data from application:', applicationData);
        setChefApplicationData(applicationData);
      }
    } catch (error: any) {
      console.error('Error in handleViewApplication:', error);
      Alert.alert('Error', error.message || 'Failed to load application');
      setChefApplicationModalId(null);
    }
  }

  async function handleApproveChefApplication(chefId: number, applicationId?: string) {
    try {
      let chefUserId: string | null = null;
      
      if (applicationId) {
        // Get application data to find user_id
        const { data: application } = await supabase
          .from('chef_applications')
          .select('user_id')
          .eq('id', applicationId)
          .single();
        
        chefUserId = application?.user_id || null;
        
        const result = await approveChefApplication(applicationId);
        if (result.ok) {
          // Activate the chef (approveChefApplication already sets status to 'active' in chefs table)
          setChefs(cs => cs.map(c => c.id === chefId ? { ...c, status: 'active' } : c));
          setChefsWithStats(cs => cs.map(c => c.id === chefId ? { ...c, status: 'active' } : c));
          setChefApplicationData((prev: any) => prev ? { ...prev, status: 'approved' } : null);
          Alert.alert('Success', 'Chef application approved and activated');
          
          // Create notification for chef
          if (chefUserId) {
            try {
              await createNotification(
                chefUserId,
                'chef_application_approved',
                'Chef Application Approved',
                'Congratulations! Your chef application has been approved. You can now start listing your dishes.'
              );
            } catch (notifError) {
              console.error('Error creating notification for chef:', notifError);
            }
          }
        } else {
          Alert.alert('Error', result.error || 'Failed to approve application');
          return;
        }
      } else {
        // No application record, get chef's user_id from chefs table
        const { data: chefData } = await supabase
          .from('chefs')
          .select('user_id')
          .eq('id', chefId)
          .single();
        
        chefUserId = chefData?.user_id || null;
        
        // No application record, just activate the chef
        const result = await toggleChefActive(chefId, true);
        if (result.ok) {
          setChefs(cs => cs.map(c => c.id === chefId ? { ...c, status: 'active' } : c));
          setChefsWithStats(cs => cs.map(c => c.id === chefId ? { ...c, status: 'active' } : c));
          setChefApplicationData((prev: any) => prev ? { ...prev, status: 'approved' } : null);
          Alert.alert('Success', 'Chef approved and activated');
          
          // Create notification for chef
          if (chefUserId) {
            try {
              await createNotification(
                chefUserId,
                'chef_application_approved',
                'Chef Application Approved',
                'Congratulations! Your chef application has been approved. You can now start listing your dishes.'
              );
            } catch (notifError) {
              console.error('Error creating notification for chef:', notifError);
            }
          }
        } else {
          Alert.alert('Error', result.error || 'Failed to approve chef');
          return;
        }
      }
      // Reload all data to ensure dishes are visible
      loadAll();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve application');
    }
  }

  async function handleRejectChefApplication(chefId: number, applicationId?: string) {
    try {
      let chefUserId: string | null = null;
      
      if (applicationId) {
        // Get application data to find user_id
        const { data: application } = await supabase
          .from('chef_applications')
          .select('user_id')
          .eq('id', applicationId)
          .single();
        
        chefUserId = application?.user_id || null;
        
        const result = await rejectChefApplication(applicationId);
        if (result.ok) {
          setChefs(cs => cs.map(c => c.id === chefId ? { ...c, status: 'rejected' } : c));
          setChefsWithStats(cs => cs.map(c => c.id === chefId ? { ...c, status: 'rejected' } : c));
          setChefApplicationData((prev: any) => prev ? { ...prev, status: 'rejected' } : null);
          Alert.alert('Success', 'Chef application rejected');
          
          // Create notification for chef
          if (chefUserId) {
            try {
              await createNotification(
                chefUserId,
                'chef_application_rejected',
                'Chef Application Status',
                'Your chef application has been reviewed. Please contact support for more information.'
              );
            } catch (notifError) {
              console.error('Error creating notification for chef:', notifError);
            }
          }
        } else {
          Alert.alert('Error', result.error || 'Failed to reject application');
          return;
        }
      } else {
        // No application record, get chef's user_id from chefs table
        const { data: chefData } = await supabase
          .from('chefs')
          .select('user_id')
          .eq('id', chefId)
          .single();
        
        chefUserId = chefData?.user_id || null;
        
        // No application record, update chef status to rejected
        const { error } = await supabase
          .from('chefs')
          .update({ status: 'rejected' })
          .eq('id', chefId);
        
        if (error) {
          Alert.alert('Error', error.message || 'Failed to reject chef');
          return;
        } else {
          setChefs(cs => cs.map(c => c.id === chefId ? { ...c, status: 'rejected' } : c));
          setChefsWithStats(cs => cs.map(c => c.id === chefId ? { ...c, status: 'rejected' } : c));
          setChefApplicationData((prev: any) => prev ? { ...prev, status: 'rejected' } : null);
          Alert.alert('Success', 'Chef application rejected');
          
          // Create notification for chef
          if (chefUserId) {
            try {
              await createNotification(
                chefUserId,
                'chef_application_rejected',
                'Chef Application Status',
                'Your chef application has been reviewed. Please contact support for more information.'
              );
            } catch (notifError) {
              console.error('Error creating notification for chef:', notifError);
            }
          }
        }
      }
      // Reload all data to ensure consistency
      loadAll();
    } catch (error: any) {
      console.error('Error in handleRejectChefApplication:', error);
      Alert.alert('Error', error.message || 'Failed to reject application');
    }
  }

  async function handleUpdateOrderStatus(id: number, newStatus: string) {
    const result = await updateOrderStatus(id, newStatus);
    if (result.ok) {
      setOrders(os => os.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setOrdersWithChefs(os => os.map((o: any) => o.id === id ? { ...o, status: newStatus } : o));
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

  async function updateAboutUsBanner() {
    if (!aboutUsBannerUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    setSavingAboutUsBanner(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'about_us_banner_url', value: aboutUsBannerUrl.trim() });
      
      if (error) throw error;
      setOriginalAboutUsBannerUrl(aboutUsBannerUrl);
      Alert.alert('Success', 'About Us banner updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update About Us banner. Make sure app_settings table exists.');
    } finally {
      setSavingAboutUsBanner(false);
    }
  }

  async function updateChefOnboardingBanner() {
    if (!chefOnboardingBannerUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    setSavingChefOnboardingBanner(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'chef_onboarding_banner_url', value: chefOnboardingBannerUrl.trim() });
      
      if (error) throw error;
      setOriginalChefOnboardingBannerUrl(chefOnboardingBannerUrl);
      Alert.alert('Success', 'Chef onboarding banner updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update chef onboarding banner. Make sure app_settings table exists.');
    } finally {
      setSavingChefOnboardingBanner(false);
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

  async function handleUploadAboutUsBanner(file: File) {
    if (!file) return;
    setUploadingAboutUsBanner(true);
    try {
      const fileExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'png';
      const fileName = `about_us_banner_${Date.now()}.${fileExt || 'png'}`;
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
        setAboutUsBannerUrl(urlData.publicUrl);
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
      setUploadingAboutUsBanner(false);
    }
  }

  async function handleUploadChefOnboardingBanner(file: File) {
    if (!file) return;
    setUploadingChefOnboardingBanner(true);
    try {
      const fileExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'png';
      const fileName = `chef_onboarding_banner_${Date.now()}.${fileExt || 'png'}`;
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
        setChefOnboardingBannerUrl(urlData.publicUrl);
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
      setUploadingChefOnboardingBanner(false);
    }
  }
  
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    const q = (userSearch ?? '').toLowerCase().trim();
    if (!q) return users;
    return users.filter((u: any) => 
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      String(u.id).toLowerCase().includes(q)
    );
  }, [users, userSearch]);

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
    if (!Array.isArray(ordersWithChefs)) return [];
    const q = (orderSearch ?? '').toLowerCase().trim();
    if (!q) return ordersWithChefs;
    return ordersWithChefs.filter((o: any) =>
      String(o.id).includes(q) ||
      (o.status ?? '').toLowerCase().includes(q) ||
      (o.user_email ?? '').toLowerCase().includes(q) ||
      (o.chef?.name ?? '').toLowerCase().includes(q)
    );
  }, [ordersWithChefs, orderSearch]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a: any, b: any) => {
      const idA = Number(a.id ?? 0);
      const idB = Number(b.id ?? 0);
      const dir = orderSortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      if (orderSortBy === 'created') {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        cmp = ta - tb;
      } else if (orderSortBy === 'status') {
        const sa = (a.status ?? '').toLowerCase();
        const sb = (b.status ?? '').toLowerCase();
        cmp = sa.localeCompare(sb);
      } else if (orderSortBy === 'total') {
        cmp = (a.total_cents ?? 0) - (b.total_cents ?? 0);
      }
      if (cmp !== 0) return dir * cmp;
      return idB - idA; // always secondary: order id descending
    });
  }, [filteredOrders, orderSortBy, orderSortDir]);

  function toggleOrderSort(col: 'created' | 'status' | 'total') {
    if (orderSortBy === col) {
      setOrderSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderSortBy(col);
      setOrderSortDir('desc');
    }
    setOrderPage(1);
  }

  // Reset pagination when search changes
  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch]);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ORDERS_PER_PAGE;
    return sortedOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [sortedOrders, orderPage]);

  const totalOrderPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);

  const filteredChefs = useMemo(() => {
    if (!Array.isArray(chefsWithStats)) return [];
    const q = (chefSearch ?? '').toLowerCase().trim();
    if (!q) return chefsWithStats;
    return chefsWithStats.filter(c =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.location ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
  }, [chefsWithStats, chefSearch]);

  useEffect(() => {
    setChefPage(1);
  }, [chefSearch]);

  const paginatedChefs = useMemo(() => {
    const start = (chefPage - 1) * CHEFS_PER_PAGE;
    return filteredChefs.slice(start, start + CHEFS_PER_PAGE);
  }, [filteredChefs, chefPage]);

  const totalChefPages = Math.ceil(filteredChefs.length / CHEFS_PER_PAGE);

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
  const orderPageScrollRef = React.useRef<ScrollView>(null);
  const userPageScrollRef = React.useRef<ScrollView>(null);
  const chefPageScrollRef = React.useRef<ScrollView>(null);

  async function handleUpdateIssueStatus(issueId: number, newStatus: string, silent: boolean = false) {
    // Get issue data before updating to fetch related information
    // First try to get from local state (issues array), otherwise fetch from DB
    let issueData: any = issues.find(i => i.id === issueId);
    
    if (!issueData || !issueData.orders) {
      // Fetch from database if not in local state
      const { data: fetchedIssue } = await supabase
        .from('order_issues')
        .select(`
          *,
          orders!order_issues_order_id_fkey (id, user_id),
          chefs!order_issues_chef_id_fkey (id, name)
        `)
        .eq('id', issueId)
        .single();
      issueData = fetchedIssue;
    }

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

      // Create notification for the user about the issue update
      if (issueData && issueData.orders) {
        try {
          const orderId = issueData.orders.id;
          const userId = issueData.orders.user_id;
          const chefName = issueData.chefs?.name || 'Chef';
          const issueNumber = issueId;
          const statusLabel = issueStatusStyles(newStatus).label;

          // Create notification for user
          await createNotification(
            userId,
            'order_issue_updated',
            'Order Issue Updated',
            `Issue #${issueNumber} for Order #${orderId} with ${chefName} has been updated to: ${statusLabel}.`,
            orderId,
            'order'
          );
        } catch (notifError) {
          // Don't block the status update if notification creation fails
          console.error('Error creating notification for user:', notifError);
        }
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
      case 'suspended':
        return { container: [styles.statusPill, styles.statusDanger], text: styles.statusTextDanger };
      default:
        return { container: [styles.statusPill, styles.statusNeutral], text: styles.statusTextNeutral };
    }
  };

  const chefStatusText = (status?: string) => {
    if (!status) return 'Pending';
    const normalized = status.toLowerCase();
    if (normalized === 'active') return 'Active';
    if (normalized === 'pending') return 'Pending';
    if (normalized === 'suspended') return 'Suspended';
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
    
    // Date filter setup (same as snapshotStats)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(now.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Filter orders based on snapshot date filter
    let filteredOrders = orders || [];
    if (snapshotDateFilter === 'today') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= todayStart;
      });
    } else if (snapshotDateFilter === 'last7days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last15days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last30days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (snapshotDateFilter === 'last3months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (snapshotDateFilter === 'last6months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }
    // 'alltime' uses all orders, no filtering needed

    let weeklyCents = 0;
    let monthlyCents = 0;
    let totalCents = 0;
    let orderCount = 0;
    let grossSalesCents = 0;
    let taxesCents = 0;
    let totalPlatformFeesCents = 0;
    let totalStripeFeesCents = 0;
    const uniqueCustomerIds = new Set<string>();

    filteredOrders.forEach((order) => {
      if (!order || typeof order.total_cents !== 'number') return;
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      totalCents += order.total_cents ?? 0;
      orderCount += 1;
      
      // Gross sales: sum of all order totals (before fees)
      grossSalesCents += order.total_cents ?? 0;
      
      // Track unique customers
      if (order.user_id) {
        uniqueCustomerIds.add(order.user_id);
      }
      
      // Calculate taxes (13% of subtotal)
      // Use subtotal_cents directly if available, otherwise calculate from total_cents
      // total_cents = subtotal + platform_fee + tax, where tax = subtotal * 0.13
      // So: total_cents = subtotal + platform_fee + (subtotal * 0.13)
      //     total_cents = subtotal * 1.13 + platform_fee
      //     subtotal = (total_cents - platform_fee) / 1.13
      const platformFee = order.platform_fee_cents ?? 0;
      const subtotalCents = (order as any).subtotal_cents ?? 
        Math.round(((order.total_cents ?? 0) - platformFee) / 1.13);
      const orderTaxes = Math.round(subtotalCents * 0.13);
      taxesCents += orderTaxes;
      
      // Platform fees: sum of all platform fees
      totalPlatformFeesCents += platformFee;
      
      // Refunds will be calculated separately from order_issues table
      
      // Stripe fees: typically 2.9% + $0.30 per transaction
      // For simplicity, calculate as 2.9% of total_cents + $0.30 per order
      if (order.stripe_payment_intent_id) {
        const stripeFee = Math.round((order.total_cents ?? 0) * 0.029) + 30; // 2.9% + $0.30
        totalStripeFeesCents += stripeFee;
      }
      
      // Only count platform fees for orders where payment has been captured
      // Platform fees are collected when payment is captured (indicated by stripe_transfer_id)
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
    
    // Active chefs: count unique chefs who have orders in the filtered date range
    const uniqueChefIds = new Set<string>();
    filteredOrders.forEach((order) => {
      if (order.chef_id) {
        uniqueChefIds.add(String(order.chef_id));
      }
    });
    const activeChefs = uniqueChefIds.size;
    
    // Active customers: count unique customers who have orders in the filtered date range
    const activeCustomers = uniqueCustomerIds.size;
    const averageOrderValue = orderCount > 0 ? grossSalesCents / orderCount : 0;
    
    // Filter issues based on date filter for refunds
    let filteredIssues = issues || [];
    if (snapshotDateFilter === 'today') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= todayStart;
      });
    } else if (snapshotDateFilter === 'last7days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last15days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last30days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (snapshotDateFilter === 'last3months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (snapshotDateFilter === 'last6months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }
    
    // Calculate refunds from filtered issues with refunded status
    let totalRefundsCents = 0;
    if (filteredIssues && Array.isArray(filteredIssues)) {
      filteredIssues.forEach((issue: any) => {
        if (issue.status === 'refunded' && issue.orders?.total_cents) {
          totalRefundsCents += issue.orders.total_cents;
        }
      });
    }
    
    // Calculate snapshot metrics
    const revenueCents = grossSalesCents;
    const commissionsCents = grossSalesCents - totalPlatformFeesCents; // Revenue minus platform fees = chef commissions
    const expensesCents = totalRefundsCents + totalStripeFeesCents; // Expenses = refunds + stripe fees
    const netProfitCents = revenueCents - expensesCents; // Net profit = revenue - expenses

    return {
      weeklyCents,
      monthlyCents,
      totalCents,
      orderCount,
      totalUsers,
      totalChefs,
      grossSalesCents,
      taxesCents,
      activeChefs,
      activeCustomers,
      averageOrderValue,
      revenueCents,
      commissionsCents,
      platformFeesCents: totalPlatformFeesCents,
      expensesCents,
      stripeFeesCents: totalStripeFeesCents,
      refundsCents: totalRefundsCents,
      netProfitCents,
    };
  }, [orders, users, chefs, issues, snapshotDateFilter]);

  // Snapshot stats with date filtering
  const snapshotStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(now.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Filter orders based on date filter
    let filteredOrders = orders || [];
    if (snapshotDateFilter === 'today') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= todayStart;
      });
    } else if (snapshotDateFilter === 'last7days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last15days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last30days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (snapshotDateFilter === 'last3months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (snapshotDateFilter === 'last6months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }
    // 'alltime' uses all orders, no filtering needed

    // Filter issues based on date filter for refunds
    let filteredIssues = issues || [];
    if (snapshotDateFilter === 'today') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= todayStart;
      });
    } else if (snapshotDateFilter === 'last7days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last15days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (snapshotDateFilter === 'last30days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (snapshotDateFilter === 'last3months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (snapshotDateFilter === 'last6months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }

    let grossSalesCents = 0;
    let taxesCents = 0;
    let totalPlatformFeesCents = 0;
    let totalStripeFeesCents = 0;

    filteredOrders.forEach((order) => {
      if (!order || typeof order.total_cents !== 'number') return;
      
      // Gross sales: sum of all order totals (before fees)
      grossSalesCents += order.total_cents ?? 0;
      
      // Calculate taxes (13% of subtotal)
      const platformFee = order.platform_fee_cents ?? 0;
      const subtotalCents = (order as any).subtotal_cents ?? 
        Math.round(((order.total_cents ?? 0) - platformFee) / 1.13);
      const orderTaxes = Math.round(subtotalCents * 0.13);
      taxesCents += orderTaxes;
      
      // Platform fees: sum of all platform fees
      totalPlatformFeesCents += platformFee;
      
      // Stripe fees: typically 2.9% + $0.30 per transaction
      if (order.stripe_payment_intent_id) {
        const stripeFee = Math.round((order.total_cents ?? 0) * 0.029) + 30; // 2.9% + $0.30
        totalStripeFeesCents += stripeFee;
      }
    });
    
    // Calculate refunds from filtered issues with refunded status
    let totalRefundsCents = 0;
    filteredIssues.forEach((issue: any) => {
      if (issue.status === 'refunded' && issue.orders?.total_cents) {
        totalRefundsCents += issue.orders.total_cents;
      }
    });
    
    // Calculate snapshot metrics
    const revenueCents = grossSalesCents;
    const commissionsCents = grossSalesCents - totalPlatformFeesCents; // Revenue minus platform fees = chef commissions
    const expensesCents = totalRefundsCents + totalStripeFeesCents; // Expenses = refunds + stripe fees
    const netProfitCents = revenueCents - expensesCents; // Net profit = revenue - expenses

    return {
      revenueCents,
      commissionsCents,
      platformFeesCents: totalPlatformFeesCents,
      expensesCents,
      stripeFeesCents: totalStripeFeesCents,
      refundsCents: totalRefundsCents,
      netProfitCents,
    };
  }, [orders, issues, snapshotDateFilter]);

  // Finance stats with date filtering
  const financeStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(now.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Filter orders based on date filter
    let filteredOrders = orders || [];
    if (financeDateFilter === 'today') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= todayStart;
      });
    } else if (financeDateFilter === 'last7days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (financeDateFilter === 'last15days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (financeDateFilter === 'last30days') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (financeDateFilter === 'last3months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (financeDateFilter === 'last6months') {
      filteredOrders = filteredOrders.filter(order => {
        if (!order.created_at) return false;
        const createdAt = new Date(order.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }
    // 'alltime' uses all orders, no filtering needed

    // Filter issues based on date filter for refunds
    let filteredIssues = issues || [];
    if (financeDateFilter === 'today') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= todayStart;
      });
    } else if (financeDateFilter === 'last7days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sevenDaysAgo;
      });
    } else if (financeDateFilter === 'last15days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= fifteenDaysAgo;
      });
    } else if (financeDateFilter === 'last30days') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= thirtyDaysAgo;
      });
    } else if (financeDateFilter === 'last3months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= threeMonthsAgo;
      });
    } else if (financeDateFilter === 'last6months') {
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const createdAt = new Date(issue.created_at);
        return createdAt >= sixMonthsAgo;
      });
    }

    let grossSalesCents = 0;
    let totalPlatformFeesCents = 0;
    let totalStripeFeesCents = 0;

    filteredOrders.forEach((order) => {
      if (!order || typeof order.total_cents !== 'number') return;
      
      // Gross sales: sum of all order totals (before fees)
      grossSalesCents += order.total_cents ?? 0;
      
      // Platform fees: sum of all platform fees
      const platformFee = order.platform_fee_cents ?? 0;
      totalPlatformFeesCents += platformFee;
      
      // Stripe fees: typically 2.9% + $0.30 per transaction
      if (order.stripe_payment_intent_id) {
        const stripeFee = Math.round((order.total_cents ?? 0) * 0.029) + 30; // 2.9% + $0.30
        totalStripeFeesCents += stripeFee;
      }
    });
    
    // Calculate refunds from filtered issues with refunded status
    let totalRefundsCents = 0;
    filteredIssues.forEach((issue: any) => {
      if (issue.status === 'refunded' && issue.orders?.total_cents) {
        totalRefundsCents += issue.orders.total_cents;
      }
    });
    
    // Calculate finance metrics
    const commissionsCents = grossSalesCents - totalPlatformFeesCents; // Revenue minus platform fees = chef commissions
    const expensesCents = totalRefundsCents + totalStripeFeesCents; // Expenses = refunds + stripe fees
    const revenueCents = grossSalesCents;
    const netProfitCents = revenueCents - expensesCents; // Net profit = revenue - expenses

    return {
      commissionsCents,
      platformFeesCents: totalPlatformFeesCents,
      stripeFeesCents: totalStripeFeesCents,
      refundsCents: totalRefundsCents,
      netProfitCents,
    };
  }, [orders, issues, financeDateFilter]);

  const formatCad = (value: number) => (value / 100).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  });

  const getDateFilterLabel = (filter: typeof snapshotDateFilter) => {
    const labels: Record<typeof filter, string> = {
      'today': 'Today',
      'last7days': 'Last 7 days',
      'last15days': 'Last 15 days',
      'last30days': 'Last 30 days',
      'last3months': 'Last 3 months',
      'last6months': 'Last 6 months',
      'alltime': 'All time',
    };
    return labels[filter];
  };

  const dateFilterOptions: Array<{ value: typeof snapshotDateFilter; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last15days', label: 'Last 15 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'last3months', label: 'Last 3 months' },
    { value: 'last6months', label: 'Last 6 months' },
    { value: 'alltime', label: 'All time' },
  ];

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
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Snapshot</Text>
          <View style={styles.dateFilterContainer}>
            <View style={styles.dateFilterDropdownWrapper}>
              <TouchableOpacity
                style={styles.dateFilterDropdownButton}
                onPress={() => {
                  setShowFinanceDropdown(false);
                  setShowSnapshotDropdown(!showSnapshotDropdown);
                }}
              >
                <Text style={styles.dateFilterDropdownButtonText}>{getDateFilterLabel(snapshotDateFilter)}</Text>
              </TouchableOpacity>
              {showSnapshotDropdown && (
                <>
                  {isMobile ? (
                    <Modal
                      visible={showSnapshotDropdown}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setShowSnapshotDropdown(false)}
                    >
                      <TouchableOpacity
                        style={styles.dateFilterModalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowSnapshotDropdown(false)}
                      >
                        <TouchableOpacity
                          activeOpacity={1}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <ScrollView
                            style={styles.dateFilterDropdownMenuMobile}
                            contentContainerStyle={{ paddingVertical: 4 }}
                            showsVerticalScrollIndicator={true}
                          >
                            {dateFilterOptions.map((option, index) => (
                              <TouchableOpacity
                                key={option.value}
                                style={[
                                  styles.dateFilterDropdownOption,
                                  snapshotDateFilter === option.value && styles.dateFilterDropdownOptionActive,
                                  index === dateFilterOptions.length - 1 && styles.dateFilterDropdownOptionLast
                                ]}
                                onPress={() => {
                                  setSnapshotDateFilter(option.value);
                                  setShowSnapshotDropdown(false);
                                }}
                              >
                                <Text style={[
                                  styles.dateFilterDropdownOptionText,
                                  snapshotDateFilter === option.value && styles.dateFilterDropdownOptionTextActive
                                ]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Modal>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateFilterDropdownOverlay}
                        activeOpacity={1}
                        onPress={() => setShowSnapshotDropdown(false)}
                      />
                      <View style={styles.dateFilterDropdownMenu}>
                        {dateFilterOptions.map((option, index) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.dateFilterDropdownOption,
                              snapshotDateFilter === option.value && styles.dateFilterDropdownOptionActive,
                              index === dateFilterOptions.length - 1 && styles.dateFilterDropdownOptionLast
                            ]}
                            onPress={() => {
                              setSnapshotDateFilter(option.value);
                              setShowSnapshotDropdown(false);
                            }}
                          >
                            <Text style={[
                              styles.dateFilterDropdownOptionText,
                              snapshotDateFilter === option.value && styles.dateFilterDropdownOptionTextActive
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
        </View>
                    </>
                  )}
                </>
              )}
              </View>
          </View>
        </View>
        <View style={styles.metricsList}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Revenue</Text>
            <Text style={[styles.metricValue, { color: '#FE734C' }]}>{formatCad(snapshotStats.revenueCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Commissions</Text>
            <Text style={styles.metricValue}>{formatCad(snapshotStats.commissionsCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Platform fees</Text>
            <Text style={styles.metricValue}>{formatCad(snapshotStats.platformFeesCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Expenses</Text>
            <Text style={[styles.metricValue, { color: '#B91C1C' }]}>{formatCad(snapshotStats.expensesCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Stripe fees</Text>
            <Text style={styles.metricValue}>{formatCad(snapshotStats.stripeFeesCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Refunds</Text>
            <Text style={styles.metricValue}>{formatCad(snapshotStats.refundsCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Net profit</Text>
            <Text style={[styles.metricValue, { color: '#1E794F' }]}>{formatCad(snapshotStats.netProfitCents)} CAD</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Marketplace</Text>
        </View>
        <View style={styles.metricsList}>
          {[
            // New metrics
            { label: 'Gross sales', value: overviewStats.grossSalesCents / 100, formatted: formatCad(overviewStats.grossSalesCents), isCurrency: true },
            { label: 'Total orders', value: overviewStats.orderCount, formatted: overviewStats.orderCount.toLocaleString(), isCurrency: false },
            { label: 'Taxes', value: overviewStats.taxesCents / 100, formatted: formatCad(overviewStats.taxesCents), isCurrency: true },
            { label: 'Active chefs', value: overviewStats.activeChefs, formatted: overviewStats.activeChefs.toLocaleString(), isCurrency: false },
            { label: 'Active customers', value: overviewStats.activeCustomers, formatted: overviewStats.activeCustomers.toLocaleString(), isCurrency: false },
            { label: 'Average order value', value: overviewStats.averageOrderValue / 100, formatted: formatCad(Math.round(overviewStats.averageOrderValue)), isCurrency: true },
          ].map((metric) => {
            return (
              <View key={metric.label} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.formatted}{metric.isCurrency ? ' CAD' : ''}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Engagement</Text>
        </View>
        <View style={styles.metricsList}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Daily active users</Text>
            <Text style={styles.metricValue}>{dailyActiveUsers.toLocaleString()}</Text>
            </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Monthly active users</Text>
            <Text style={styles.metricValue}>{monthlyActiveUsers.toLocaleString()}</Text>
          </View>
        </View>
          </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Actionables</Text>
        </View>
        <View style={styles.metricsList}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Issues pending review</Text>
            <Text style={styles.metricValue}>{pendingIssuesCount.toLocaleString()}</Text>
      </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Pending chef applications</Text>
            <Text style={styles.metricValue}>{pendingChefApplicationsCount.toLocaleString()}</Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );

  const ChefsTab = (
    <View style={styles.issuesTabWrapper}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.issuesTabScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={!isMobile}
      >
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={!isMobile}
          contentContainerStyle={styles.tabScroll}
        >
          <View style={styles.issuesTabInner}>
      <View style={styles.searchWrapper}>
        <TextInput
          value={chefSearch}
          onChangeText={setChefSearch}
          placeholder="Search by name, location, email, or ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

          {loading && chefsWithStats.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedChefs.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{chefSearch ? 'No chefs found matching your search.' : 'No chefs found.'}</Text></View>
      ) : (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, !isMobile && { minWidth: 1320 }]}>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Name</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Brand</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                  <Text style={styles.tableHeaderCellText}>Status</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>Onboarding</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                  <Text style={styles.tableHeaderCellText}>Sales</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }]}>
                  <Text style={styles.tableHeaderCellText}>Complaints</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Actions</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>Featured</Text>
                </View>
              </View>

              {/* Table Rows */}
              {paginatedChefs.map((c: any) => {
            const statusStyles = chefStatusStyles(c.status);
            return (
                  <View key={c.id} style={[styles.tableRow, !isMobile && { minWidth: 1320 }]}>
                    <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                      <Text style={{ fontWeight: '600', color: '#000000', fontFamily: theme.typography.fontFamily.body }} numberOfLines={1}>
                        {c.name || `Chef #${c.id}`}
                    </Text>
                      {c.id && (
                        <Link href={`/chef/${c.id}`} asChild>
                          <TouchableOpacity>
                            <Text style={styles.viewDetailsLink}>View details</Text>
                          </TouchableOpacity>
                        </Link>
                      )}
                  </View>
                    <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                      <Text numberOfLines={1}>{c.name || '—'}</Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                  <View style={statusStyles.container}>
                    <Text style={[styles.statusPillText, statusStyles.text]}>{chefStatusText(c.status)}</Text>
                  </View>
                </View>
                    <View style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]}>
                      {c.user_id ? (
                  <TouchableOpacity
                          onPress={() => {
                            console.log('View application clicked for chef:', c.id, 'user_id:', c.user_id);
                            handleViewApplication(c.id, c.user_id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.viewDetailsLink}>View application</Text>
                  </TouchableOpacity>
                      ) : (
                        <Text>{c.created_at ? formatEst(c.created_at) : '—'}</Text>
                      )}
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                      <Text>{cents(c.sales || 0)}</Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }]}>
                      <Text>{c.complaints || 0}</Text>
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 150, minWidth: 150 } : { flex: 1.5 }, { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }]}>
                      {c.status === 'suspended' ? (
                        <TouchableOpacity
                          onPress={() => handleReinstateChef(c.id)}
                          style={[styles.primaryButton, { paddingVertical: 6, paddingHorizontal: 8 }]}
                        >
                          <Text style={styles.primaryButtonText}>Reinstate</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSuspendChef(c.id)}
                          style={[styles.dangerOutlineButton, { paddingVertical: 6, paddingHorizontal: 8 }]}
                        >
                          <Text style={styles.dangerOutlineButtonText}>Suspend</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]}>
                  <TouchableOpacity
                    onPress={() => handleToggleChefFeatured(c.id, !(c as any).featured)}
                    style={(c as any).featured
                          ? [styles.successOutlineButton, { paddingVertical: 6, paddingHorizontal: 8 }]
                          : [styles.neutralOutlineButton, { paddingVertical: 6, paddingHorizontal: 8 }]}
                  >
                    <Text style={(c as any).featured ? styles.successOutlineButtonText : styles.neutralOutlineButtonText}>
                      {(c as any).featured ? '★ Featured' : '☆ Feature'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
            </View>
          )}
          </View>
        </ScrollView>
      </ScrollView>
      
      {/* Pagination - Outside ScrollViews */}
      {totalChefPages > 0 && (
        <View style={styles.issuesPaginationWrap}>
          {isMobile && (
            <View style={styles.issuesPaginationMobileInfo}>
              <Text style={styles.paginationStatus}>
                Page {chefPage} of {totalChefPages}
              </Text>
              <Text style={styles.issuesTotalText}>{filteredChefs.length} total</Text>
            </View>
          )}
          {totalChefPages > 1 && (
            <View style={[styles.paginationControlsContainer, isMobile && styles.paginationControlsContainerMobile]}>
              <TouchableOpacity
                onPress={() => setChefPage((p) => Math.max(1, p - 1))}
                disabled={chefPage === 1}
                style={[styles.paginationArrowButton, chefPage === 1 && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, chefPage === 1 && styles.paginationArrowTextDisabled]}>
                  ←
                </Text>
              </TouchableOpacity>
              <ScrollView
                ref={chefPageScrollRef}
                horizontal
                showsHorizontalScrollIndicator={!isMobile}
                contentContainerStyle={styles.issuesPageScrollContent}
                style={[styles.issuesPageScroll, isMobile && styles.issuesPageScrollMobile]}
                nestedScrollEnabled
                scrollEnabled
              >
                {Array.from({ length: totalChefPages }, (_, i) => i + 1).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setChefPage(p);
                    }}
                    activeOpacity={0.7}
                    style={[styles.issuesPageButton, chefPage === p && styles.issuesPageButtonActive]}
                  >
                    <Text style={[styles.issuesPageButtonText, chefPage === p && styles.issuesPageButtonTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setChefPage((p) => Math.min(totalChefPages, p + 1))}
                disabled={chefPage === totalChefPages}
                style={[styles.paginationArrowButton, chefPage === totalChefPages && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, chefPage === totalChefPages && styles.paginationArrowTextDisabled]}>
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* Fixed page number and total count in bottom of viewport - hidden on mobile */}
      {shouldShowFixedElements && totalChefPages > 0 && (
        <View style={styles.issuesPageNumberFixed}>
          <Text style={styles.paginationStatus}>
            Page {chefPage} of {totalChefPages}
          </Text>
        </View>
      )}
      {shouldShowFixedElements && (
        <View style={styles.issuesTotalFixed}>
          <Text style={styles.issuesTotalText}>{filteredChefs.length} total</Text>
        </View>
      )}
    </View>
  );

  const UsersTab = (
    <View style={styles.issuesTabWrapper}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.issuesTabScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={!isMobile}
      >
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={!isMobile}
          contentContainerStyle={styles.tabScroll}
        >
          <View style={styles.issuesTabInner}>
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
            <View style={styles.emptyState}><Text style={styles.emptyText}>{userSearch ? 'No users found matching your search.' : 'No users found.'}</Text></View>
          ) : (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, !isMobile && { minWidth: 1060 }]}>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Name</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 200, minWidth: 200 } : { flex: 2.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Email</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                  <Text style={styles.tableHeaderCellText}>Role</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 70, minWidth: 70 } : { flex: 1 }]}>
                  <Text style={styles.tableHeaderCellText}>Orders</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>Spend</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                  <Text style={styles.tableHeaderCellText}>Action</Text>
                </View>
              </View>

              {/* Table Rows */}
              {paginatedUsers.map((u: any) => (
                <View key={u.id} style={[styles.tableRow, !isMobile && { minWidth: 1060 }]}>
                  <View style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.5 }]}>
                    <Text style={{ fontWeight: '600', color: palette.text, fontFamily: theme.typography.fontFamily.body }} numberOfLines={1}>{u.name || 'Unknown'}</Text>
                  </View>
                  <Text style={[styles.tableCell, isMobile ? { width: 200, minWidth: 200 } : { flex: 2.5 }]} numberOfLines={1}>
                    {u.email || 'No email'}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                    {u.is_admin ? 'Admin' : u.is_chef ? 'Chef' : (u.role === 'banned' ? 'Banned' : 'User')}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 70, minWidth: 70 } : { flex: 1 }]}>
                    {u.orderCount || 0}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 1.2 }]}>
                    {cents(u.totalSpend || 0)}
                  </Text>
                  <View style={[styles.tableCell, isMobile ? { width: 100, minWidth: 100 } : { flex: 1 }]}>
                    {u.role !== 'banned' ? (
                      <TouchableOpacity
                        onPress={() => handleDeactivateUser(u.id)}
                        style={[styles.primaryButton, { paddingVertical: 8, paddingHorizontal: 8 }]}
                      >
                        <Text style={[styles.primaryButtonText, { fontSize: 12 }]}>Deactivate</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: palette.muted, fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>Banned</Text>
                    )}
                  </View>
            </View>
          ))}
            </View>
          )}
          </View>
        </ScrollView>
      </ScrollView>
      
      {/* Pagination - Outside ScrollViews */}
      {totalUserPages > 0 && (
        <View style={styles.issuesPaginationWrap}>
          {isMobile && (
            <View style={styles.issuesPaginationMobileInfo}>
              <Text style={styles.paginationStatus}>
                Page {userPage} of {totalUserPages}
              </Text>
              <Text style={styles.issuesTotalText}>{filteredUsers.length} total</Text>
            </View>
          )}
          {totalUserPages > 1 && (
            <View style={[styles.paginationControlsContainer, isMobile && styles.paginationControlsContainerMobile]}>
              <TouchableOpacity
                onPress={() => setUserPage((p) => Math.max(1, p - 1))}
                disabled={userPage === 1}
                style={[styles.paginationArrowButton, userPage === 1 && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, userPage === 1 && styles.paginationArrowTextDisabled]}>
                  ←
                </Text>
              </TouchableOpacity>
              <ScrollView
                ref={userPageScrollRef}
                horizontal
                showsHorizontalScrollIndicator={!isMobile}
                contentContainerStyle={styles.issuesPageScrollContent}
                style={[styles.issuesPageScroll, isMobile && styles.issuesPageScrollMobile]}
                nestedScrollEnabled
                scrollEnabled
              >
                {Array.from({ length: totalUserPages }, (_, i) => i + 1).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setUserPage(p);
                    }}
                    activeOpacity={0.7}
                    style={[styles.issuesPageButton, userPage === p && styles.issuesPageButtonActive]}
                  >
                    <Text style={[styles.issuesPageButtonText, userPage === p && styles.issuesPageButtonTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                disabled={userPage === totalUserPages}
                style={[styles.paginationArrowButton, userPage === totalUserPages && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, userPage === totalUserPages && styles.paginationArrowTextDisabled]}>
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* Fixed page number and total count in bottom of viewport - hidden on mobile */}
      {shouldShowFixedElements && totalUserPages > 0 && (
        <View style={styles.issuesPageNumberFixed}>
          <Text style={styles.paginationStatus}>
            Page {userPage} of {totalUserPages}
          </Text>
        </View>
      )}
      {shouldShowFixedElements && (
        <View style={styles.issuesTotalFixed}>
          <Text style={styles.issuesTotalText}>{filteredUsers.length} total</Text>
        </View>
      )}
    </View>
  );

  const OrdersTab = (
    <View style={styles.issuesTabWrapper}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.issuesTabScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={!isMobile}
      >
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={!isMobile}
          contentContainerStyle={styles.tabScroll}
        >
          <View style={styles.issuesTabInner}>
      <View style={styles.searchWrapper}>
        <TextInput
          value={orderSearch}
          onChangeText={setOrderSearch}
            placeholder="Search by status, email, order ID, or chef name..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

        {loading && ordersWithChefs.length === 0 ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : paginatedOrders.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>{orderSearch ? 'No orders found matching your search.' : 'No orders found.'}</Text></View>
      ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.issueIdHeaderCell]}>
                <Text style={styles.tableHeaderCellText}>Order ID</Text>
              </View>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>
                <Text style={styles.tableHeaderCellText}>Chef</Text>
              </View>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 180, minWidth: 180 } : { flex: 2 }]}>
                <Text style={styles.tableHeaderCellText}>Customer</Text>
              </View>
              <TouchableOpacity
                style={[styles.tableHeaderCellSortable, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }]}
                onPress={() => toggleOrderSort('total')}
              >
                <Text style={styles.tableHeaderCellText}>Amount</Text>
                <Text style={[styles.sortIcon, { color: palette.primary }]}>
                  {orderSortBy === 'total' ? (orderSortDir === 'asc' ? '▲' : '▼') : '↕'}
                </Text>
              </TouchableOpacity>
              <View style={[styles.tableHeaderCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }]}>
                <Text style={styles.tableHeaderCellText}>Status</Text>
              </View>
              <TouchableOpacity
                style={[styles.tableHeaderCellSortable, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }, styles.createdHeaderCell]}
                onPress={() => toggleOrderSort('created')}
              >
                <Text style={styles.tableHeaderCellText}>Date</Text>
                <Text style={[styles.sortIcon, { color: palette.primary }]}>
                  {orderSortBy === 'created' ? (orderSortDir === 'asc' ? '▲' : '▼') : '↕'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Table Rows */}
            {paginatedOrders.map((order: any) => {
              const statusStyles = orderStatusStyles(order.status);
              
              return (
                <View key={order.id} style={styles.tableRow}>
                  <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.issueIdCell]}>
                    <Text>{order.id}</Text>
                    <TouchableOpacity onPress={() => setOrderDetailModalId(order.id)}>
                      <Text style={styles.viewDetailsLink}>View details</Text>
                    </TouchableOpacity>
                  </View>
                  {order.chef?.id ? (
                    <View style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }, styles.chefCell]}>
                      <Text style={styles.chefNameText}>{order.chef.name || 'Unknown'}</Text>
                      <Link href={`/chef/${order.chef.id}`} asChild>
                        <TouchableOpacity style={styles.chefLinkIcon}>
                          <Text style={styles.chefLinkIconText}>↗</Text>
                        </TouchableOpacity>
                      </Link>
                    </View>
                  ) : (
                    <Text style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.5 }]}>Unknown</Text>
                  )}
                  <Text style={[styles.tableCell, isMobile ? { width: 180, minWidth: 180 } : { flex: 2 }]} numberOfLines={1}>
                    {order.user_email || 'Unknown'}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }]}>
                    {cents(order.total_cents || 0)}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1 }, { color: statusStyles.text.color }]}>
                    {orderStatusLabel(order.status)}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }, styles.createdCell]}>
                    {formatEst(order.created_at)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        </View>
        </ScrollView>
      </ScrollView>
      
      {/* Pagination - Outside ScrollViews */}
      {totalOrderPages > 0 && (
        <View style={styles.issuesPaginationWrap}>
          {isMobile && (
            <View style={styles.issuesPaginationMobileInfo}>
              <Text style={styles.paginationStatus}>
                Page {orderPage} of {totalOrderPages}
              </Text>
              <Text style={styles.issuesTotalText}>{filteredOrders.length} total</Text>
            </View>
          )}
          {totalOrderPages > 1 && (
            <View style={[styles.paginationControlsContainer, isMobile && styles.paginationControlsContainerMobile]}>
              <TouchableOpacity
                onPress={() => setOrderPage((p) => Math.max(1, p - 1))}
                disabled={orderPage === 1}
                style={[styles.paginationArrowButton, orderPage === 1 && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, orderPage === 1 && styles.paginationArrowTextDisabled]}>
                  ←
                </Text>
              </TouchableOpacity>
              <ScrollView
                ref={orderPageScrollRef}
                horizontal
                showsHorizontalScrollIndicator={!isMobile}
                contentContainerStyle={styles.issuesPageScrollContent}
                style={[styles.issuesPageScroll, isMobile && styles.issuesPageScrollMobile]}
                nestedScrollEnabled
                scrollEnabled
              >
                {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setOrderPage(p);
                    }}
                    activeOpacity={0.7}
                    style={[styles.issuesPageButton, orderPage === p && styles.issuesPageButtonActive]}
                  >
                    <Text style={[styles.issuesPageButtonText, orderPage === p && styles.issuesPageButtonTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                disabled={orderPage === totalOrderPages}
                style={[styles.paginationArrowButton, orderPage === totalOrderPages && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, orderPage === totalOrderPages && styles.paginationArrowTextDisabled]}>
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {/* Fixed page number and total count in bottom of viewport - hidden on mobile */}
      {shouldShowFixedElements && totalOrderPages > 0 && (
        <View style={styles.issuesPageNumberFixed}>
          <Text style={styles.paginationStatus}>
            Page {orderPage} of {totalOrderPages}
          </Text>
        </View>
      )}
      {shouldShowFixedElements && (
        <View style={styles.issuesTotalFixed}>
          <Text style={styles.issuesTotalText}>{filteredOrders.length} total</Text>
        </View>
      )}

    </View>
  );

  async function updateSearchPlaceholders() {
    if (searchPlaceholders.some(p => !p.trim())) {
      Alert.alert('Error', 'All placeholder texts must be filled');
      return;
    }
    setSavingPlaceholders(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'search_placeholders', value: JSON.stringify(searchPlaceholders) });
      
      if (error) throw error;
      setOriginalSearchPlaceholders([...searchPlaceholders]);
      Alert.alert('Success', 'Search placeholder texts updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update search placeholders');
    } finally {
      setSavingPlaceholders(false);
    }
  }

  function formatNotificationType(type: string): string {
    return (type || '')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  const NotificationsTab = (
    <View style={styles.issuesTabWrapper}>
      <ScrollView contentContainerStyle={[styles.tabScroll, styles.issuesTabScrollContent]} horizontal>
        <View style={styles.issuesTabInner}>
          {loading && adminNotifications.length === 0 ? (
            <View style={styles.loadingState}><ActivityIndicator size="large" color={palette.primary} /></View>
          ) : adminNotifications.length === 0 ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No notifications sent yet.</Text></View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={[styles.tableHeader, !isMobile && { minWidth: 1100 }]}>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>User name</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>Notification time</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }]}>
                  <Text style={styles.tableHeaderCellText}>Notification type</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 280, minWidth: 280 } : { flex: 2 }]}>
                  <Text style={styles.tableHeaderCellText}>Notification text in app</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 160, minWidth: 160 } : { flex: 1.5 }]}>
                  <Text style={styles.tableHeaderCellText}>Notification text in SMS</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }]}>
                  <Text style={styles.tableHeaderCellText}>Email sent</Text>
                </View>
                <View style={[styles.tableHeaderCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }]}>
                  <Text style={styles.tableHeaderCellText}>SMS sent</Text>
                </View>
              </View>
              {adminNotifications.map((n) => (
                <View key={n.id} style={[styles.tableRow, !isMobile && { minWidth: 1100 }]}>
                  <Text style={[styles.tableCell, isMobile ? { width: 120, minWidth: 120 } : { flex: 1.2 }]} numberOfLines={1}>
                    {n.user_name ?? 'Unknown'}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }, styles.createdCell]}>
                    {formatEst(n.created_at)}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 140, minWidth: 140 } : { flex: 1.2 }]} numberOfLines={1}>
                    {formatNotificationType(n.type)}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 280, minWidth: 280 } : { flex: 2 }]}>
                    {n.title ? `${n.title}: ${n.message}` : n.message}
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 160, minWidth: 160 } : { flex: 1.5 }, { color: palette.muted }]}>
                    —
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }, { color: palette.muted }]}>
                    —
                  </Text>
                  <Text style={[styles.tableCell, isMobile ? { width: 90, minWidth: 90 } : { flex: 0.8 }, { color: palette.muted }]}>
                    —
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  const AppSettingsTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Homepage banner</Text>
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

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>About Us page banner</Text>
          <Text style={styles.chartSubtitle}>Update the banner image on the About Us page</Text>
        </View>
        <View style={styles.searchWrapper}>
          {(aboutUsBannerUrl || originalAboutUsBannerUrl) ? (
            <View style={styles.bannerPreviewContainer}>
              <Text style={styles.sectionLabel}>Current banner</Text>
              <Image 
                source={{ uri: aboutUsBannerUrl || originalAboutUsBannerUrl }} 
                style={styles.bannerPreview} 
                resizeMode="cover" 
              />
            </View>
          ) : (
            <View style={styles.bannerPreviewContainer}>
              <Text style={styles.sectionLabel}>Current banner</Text>
              <View style={[styles.bannerPreview, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: palette.muted, fontSize: 14 }}>No banner image set</Text>
              </View>
            </View>
          )}
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <FilePicker 
              label={uploadingAboutUsBanner ? "Uploading..." : "Upload New Image"} 
              onFile={handleUploadAboutUsBanner} 
            />
            {uploadingAboutUsBanner && <ActivityIndicator size="small" color={palette.primary} />}
          </View>

          <Text style={styles.helperText}>
            Recommended dimensions: Desktop 1920x600px, Mobile 800x600px.
          </Text>

          {aboutUsBannerUrl !== originalAboutUsBannerUrl && (
            <TouchableOpacity
              onPress={updateAboutUsBanner}
              disabled={savingAboutUsBanner || uploadingAboutUsBanner}
              style={[styles.primaryButton, (savingAboutUsBanner || uploadingAboutUsBanner) && styles.disabledButton, { marginTop: 8 }]}
            >
              <Text style={styles.primaryButtonText}>{savingAboutUsBanner ? 'Publishing...' : 'Publish Changes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Chef onboarding page banner</Text>
          <Text style={styles.chartSubtitle}>Update the banner image on the chef onboarding page</Text>
        </View>
        <View style={styles.searchWrapper}>
          {(chefOnboardingBannerUrl || originalChefOnboardingBannerUrl) ? (
            <View style={styles.bannerPreviewContainer}>
              <Text style={styles.sectionLabel}>Current banner</Text>
              <Image 
                source={{ uri: chefOnboardingBannerUrl || originalChefOnboardingBannerUrl }} 
                style={styles.bannerPreview} 
                resizeMode="cover" 
              />
            </View>
          ) : (
            <View style={styles.bannerPreviewContainer}>
              <Text style={styles.sectionLabel}>Current banner</Text>
              <View style={[styles.bannerPreview, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: palette.muted, fontSize: 14 }}>No banner image set</Text>
              </View>
            </View>
          )}
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <FilePicker 
              label={uploadingChefOnboardingBanner ? "Uploading..." : "Upload New Image"} 
              onFile={handleUploadChefOnboardingBanner} 
            />
            {uploadingChefOnboardingBanner && <ActivityIndicator size="small" color={palette.primary} />}
          </View>

          <Text style={styles.helperText}>
            Recommended dimensions: Desktop 1920x600px, Mobile 800x600px.
          </Text>

          {chefOnboardingBannerUrl !== originalChefOnboardingBannerUrl && (
            <TouchableOpacity
              onPress={updateChefOnboardingBanner}
              disabled={savingChefOnboardingBanner || uploadingChefOnboardingBanner}
              style={[styles.primaryButton, (savingChefOnboardingBanner || uploadingChefOnboardingBanner) && styles.disabledButton, { marginTop: 8 }]}
            >
              <Text style={styles.primaryButtonText}>{savingChefOnboardingBanner ? 'Publishing...' : 'Publish Changes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Search bar placeholders</Text>
          <Text style={styles.chartSubtitle}>Update the rotating placeholder texts on homepage and explore pages</Text>
        </View>
        <View style={styles.searchWrapper}>
          {searchPlaceholders.map((placeholder, index) => (
            <View key={index} style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 8, color: palette.text, fontFamily: theme.typography.fontFamily.body }}>
                Placeholder {index + 1}
              </Text>
              <TextInput
                value={placeholder}
                onChangeText={(text) => {
                  const updated = [...searchPlaceholders];
                  updated[index] = text;
                  setSearchPlaceholders(updated);
                }}
                placeholder={`Enter placeholder text ${index + 1}...`}
                placeholderTextColor="#94a3b8"
                style={[styles.searchInput, { minHeight: 44 }]}
                multiline
                spellCheck={true}
                autoCorrect={true}
                autoCapitalize="sentences"
              />
            </View>
          ))}
          
          {JSON.stringify(searchPlaceholders) !== JSON.stringify(originalSearchPlaceholders) && (
            <TouchableOpacity
              onPress={updateSearchPlaceholders}
              disabled={savingPlaceholders}
              style={[styles.primaryButton, savingPlaceholders && styles.disabledButton, { marginTop: 8 }]}
            >
              <Text style={styles.primaryButtonText}>
                {savingPlaceholders ? 'Publishing...' : 'Publish Changes'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Platform notifications reference */}
      {(() => {
        const notificationItems = [
          { type: 'welcome', title: 'Welcome', recipient: 'New user', scenario: 'When a user signs up or completes profile creation. Shown as a welcome message with platform intro.' },
          { type: 'order_placed', title: 'Order placed', recipient: 'Customer', scenario: 'When a customer completes checkout and payment succeeds. Confirms the order was placed and the chef will start preparing.' },
          { type: 'order_ready', title: 'Order ready for pickup', recipient: 'Customer', scenario: 'When the chef marks an order as "ready". Tells the customer to collect the order from the chef.' },
          { type: 'order_message', title: 'New message in order', recipient: 'Customer or chef', scenario: 'When a customer sends a message about an order (from order success or track page), the chef is notified. When a chef sends a message from the chef dashboard, the customer is notified.' },
          { type: 'order_issue_updated', title: 'Order issue updated', recipient: 'Customer', scenario: 'When an admin updates the status of a reported issue (e.g. refunded, in review). Notifies the customer of the update.' },
          { type: 'issue_reported', title: 'Issue reported', recipient: 'Admins', scenario: 'When a customer reports an issue with an order from the order tracking page. All admins are notified to review.' },
          { type: 'chef_request', title: 'New chef request', recipient: 'Admins', scenario: 'When a user submits a chef application (becomes a chef). All admins are notified to review the application.' },
          { type: 'chef_application_submitted', title: 'Chef application submitted', recipient: 'Applicant', scenario: 'When a user successfully submits their chef application. Confirms receipt and that it will be reviewed.' },
          { type: 'chef_application_approved', title: 'Chef application approved', recipient: 'Chef', scenario: 'When an admin approves a chef application. The applicant is notified they can start listing dishes.' },
          { type: 'chef_application_rejected', title: 'Chef application rejected', recipient: 'Chef', scenario: 'When an admin rejects a chef application. The applicant is notified of the decision.' },
          { type: 'new_order_request', title: 'New order request', recipient: 'Chef', scenario: 'When a customer places an order and payment succeeds. The chef is notified to review and respond to the order.' },
          { type: 'new_user_signup', title: 'New user signup', recipient: 'Admins', scenario: 'When a new user creates an account (database trigger on profiles insert). All admins are notified.' },
          { type: 'review_reply', title: 'Chef replied to your review', recipient: 'Customer', scenario: 'When a chef replies to a customer review on the chef dashboard. The reviewer is notified of the reply.' },
        ];
        const recipientOrder = [...new Set(notificationItems.map((i) => i.recipient))].sort((a, b) => a.localeCompare(b));
        const grouped = recipientOrder.reduce<{ [key: string]: typeof notificationItems }>((acc, r) => {
          acc[r] = notificationItems.filter((i) => i.recipient === r);
          return acc;
        }, {});
        const recipientOptions = [{ value: 'all', label: 'All' }, ...recipientOrder.map((r) => ({ value: r, label: r }))];
        const displayedRecipients = notificationRecipientFilter === 'all' ? recipientOrder : [notificationRecipientFilter];
        return (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Platform notifications</Text>
              <Text style={styles.chartSubtitle}>All notification types the platform triggers and when they fire</Text>
            </View>
            <View style={styles.searchWrapper}>
              <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, color: palette.muted, fontFamily: theme.typography.fontFamily.body }}>Recipient:</Text>
                <View style={[styles.dateFilterDropdownWrapper, { zIndex: 9999 }]}>
                  <TouchableOpacity
                    style={[styles.dateFilterDropdownButton, { minWidth: 160 }]}
                    onPress={() => setShowNotificationRecipientDropdown(!showNotificationRecipientDropdown)}
                  >
                    <Text style={styles.dateFilterDropdownButtonText}>
                      {notificationRecipientFilter === 'all' ? 'All' : notificationRecipientFilter}
                    </Text>
                  </TouchableOpacity>
                  {showNotificationRecipientDropdown && (
                    <>
                      {isMobile ? (
                        <Modal
                          visible={showNotificationRecipientDropdown}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setShowNotificationRecipientDropdown(false)}
                        >
                          <TouchableOpacity
                            style={styles.dateFilterModalOverlay}
                            activeOpacity={1}
                            onPress={() => setShowNotificationRecipientDropdown(false)}
                          >
                            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                              <ScrollView style={styles.dateFilterDropdownMenuMobile} contentContainerStyle={{ paddingVertical: 4 }}>
                                {recipientOptions.map((opt, idx) => (
                                  <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                      styles.dateFilterDropdownOption,
                                      idx === recipientOptions.length - 1 && styles.dateFilterDropdownOptionLast,
                                    ]}
                                    onPress={() => {
                                      setNotificationRecipientFilter(opt.value);
                                      setShowNotificationRecipientDropdown(false);
                                    }}
                                  >
                                    <Text style={[styles.dateFilterDropdownOptionText, notificationRecipientFilter === opt.value && { color: palette.primary, fontWeight: '700' }]}>
                                      {opt.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        </Modal>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.dateFilterDropdownOverlay}
                            activeOpacity={1}
                            onPress={() => setShowNotificationRecipientDropdown(false)}
                          />
                          <View style={styles.dateFilterDropdownMenu}>
                            {recipientOptions.map((opt, idx) => (
                              <TouchableOpacity
                                key={opt.value}
                                style={[
                                  styles.dateFilterDropdownOption,
                                  idx === recipientOptions.length - 1 && styles.dateFilterDropdownOptionLast,
                                ]}
                                onPress={() => {
                                  setNotificationRecipientFilter(opt.value);
                                  setShowNotificationRecipientDropdown(false);
                                }}
                              >
                                <Text style={[styles.dateFilterDropdownOptionText, notificationRecipientFilter === opt.value && { color: palette.primary, fontWeight: '700' }]}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              </View>
              <View style={{ gap: 24 }}>
                {displayedRecipients.map((recipient) => {
                  const items = grouped[recipient] || [];
                  if (items.length === 0) return null;
                  return (
                    <View key={recipient} style={{ gap: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: palette.text, fontFamily: theme.typography.fontFamily.body }}>
                        {recipient}
                      </Text>
                      <View style={{ gap: 12 }}>
                        {items.map((item) => (
                          <View
                            key={item.type}
                            style={{
                              padding: 12,
                              backgroundColor: '#F8FAFC',
                              borderRadius: 8,
                              borderLeftWidth: 4,
                              borderLeftColor: palette.primary,
                            }}
                          >
                            <Text style={{ fontWeight: '600', color: palette.text, marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>
                              {item.title}
                            </Text>
                            <Text style={{ fontSize: 14, color: palette.text, lineHeight: 20, fontFamily: theme.typography.fontFamily.body }}>
                              {item.scenario}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })()}
    </ScrollView>
  );

  // Calculate financial details for a specific order
  const getOrderFinancialDetails = useMemo(() => {
    if (!financeOrderSearch || !orders || orders.length === 0) {
      return null;
    }

    const orderId = parseInt(financeOrderSearch.trim());
    if (isNaN(orderId)) {
      return null;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return null;
    }

    // Calculate financial metrics for this order
    // Gross revenue = subtotal (dish prices only, before fees and tax)
    const platformFeeCents = order.platform_fee_cents ?? 0;
    const subtotalCents = (order as any).subtotal_cents ?? 
      Math.round(((order.total_cents ?? 0) - platformFeeCents) / 1.13);
    const grossRevenueCents = subtotalCents;
    
    // Platform commission = 10% of subtotal (what platform keeps from chef)
    const platformCommissionCents = (order as any).platform_commission_cents ?? 
      Math.round(subtotalCents * 0.10); // 10% commission
    // Commissions = platform commission (what platform keeps)
    const commissionsCents = platformCommissionCents;
    
    // Stripe fees: 2.9% + $0.30 per transaction (on total customer paid)
    let stripeFeesCents = 0;
    const totalCustomerPaid = order.total_cents ?? 0;
    if (order.stripe_payment_intent_id || (order as any).stripe_payment_intent_id) {
      stripeFeesCents = Math.round(totalCustomerPaid * 0.029) + 30;
    }

    // Check for refunds on this order
    let refundsCents = 0;
    if (issues && Array.isArray(issues)) {
      const orderIssue = issues.find((issue: any) => 
        issue.order_id === order.id && issue.status === 'refunded'
      );
      if (orderIssue && orderIssue.orders?.total_cents) {
        refundsCents = orderIssue.orders.total_cents;
      }
    }

    // Net profit = gross revenue + platform fees + commissions - stripe fees - refunds
    const netProfitCents = grossRevenueCents + platformFeeCents + commissionsCents - stripeFeesCents - refundsCents;

    return {
      orderId: order.id,
      grossRevenueCents,
      platformFeeCents,
      commissionsCents,
      stripeFeesCents,
      refundsCents,
      netProfitCents,
    };
  }, [financeOrderSearch, orders, issues]);

  const FinanceTab = (
    <ScrollView contentContainerStyle={styles.tabScroll}>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={[styles.dateFilterContainer, styles.dateFilterContainerFullWidth]}>
            <View style={[styles.dateFilterDropdownWrapper, styles.dateFilterDropdownWrapperFullWidth]}>
              <TouchableOpacity
                style={[styles.dateFilterDropdownButton, styles.dateFilterDropdownButtonFullWidth]}
                onPress={() => {
                  setShowSnapshotDropdown(false);
                  setShowFinanceDropdown(!showFinanceDropdown);
                }}
              >
                <Text style={styles.dateFilterDropdownButtonText}>{getDateFilterLabel(financeDateFilter)}</Text>
              </TouchableOpacity>
              {showFinanceDropdown && (
                <>
                  {isMobile ? (
                    <Modal
                      visible={showFinanceDropdown}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setShowFinanceDropdown(false)}
                    >
                      <TouchableOpacity
                        style={styles.dateFilterModalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowFinanceDropdown(false)}
                      >
                        <TouchableOpacity
                          activeOpacity={1}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <ScrollView
                            style={styles.dateFilterDropdownMenuMobile}
                            contentContainerStyle={{ paddingVertical: 4 }}
                            showsVerticalScrollIndicator={true}
                          >
                            {dateFilterOptions.map((option, index) => (
                              <TouchableOpacity
                                key={option.value}
                                style={[
                                  styles.dateFilterDropdownOption,
                                  financeDateFilter === option.value && styles.dateFilterDropdownOptionActive,
                                  index === dateFilterOptions.length - 1 && styles.dateFilterDropdownOptionLast
                                ]}
                                onPress={() => {
                                  setFinanceDateFilter(option.value);
                                  setShowFinanceDropdown(false);
                                }}
                              >
                                <Text style={[
                                  styles.dateFilterDropdownOptionText,
                                  financeDateFilter === option.value && styles.dateFilterDropdownOptionTextActive
                                ]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Modal>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateFilterDropdownOverlay}
                        activeOpacity={1}
                        onPress={() => setShowFinanceDropdown(false)}
                      />
                      <View style={styles.dateFilterDropdownMenu}>
                        {dateFilterOptions.map((option, index) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.dateFilterDropdownOption,
                              financeDateFilter === option.value && styles.dateFilterDropdownOptionActive,
                              index === dateFilterOptions.length - 1 && styles.dateFilterDropdownOptionLast
                            ]}
                            onPress={() => {
                              setFinanceDateFilter(option.value);
                              setShowFinanceDropdown(false);
                            }}
                          >
                            <Text style={[
                              styles.dateFilterDropdownOptionText,
                              financeDateFilter === option.value && styles.dateFilterDropdownOptionTextActive
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
        </>
      )}
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.metricsList}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Commissions</Text>
            <Text style={styles.metricValue}>{formatCad(financeStats.commissionsCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Platform fees</Text>
            <Text style={styles.metricValue}>{formatCad(financeStats.platformFeesCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Stripe fees</Text>
            <Text style={styles.metricValue}>{formatCad(financeStats.stripeFeesCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Refunds</Text>
            <Text style={styles.metricValue}>{formatCad(financeStats.refundsCents)} CAD</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Net profit</Text>
            <Text style={[styles.metricValue, { color: '#1E794F' }]}>{formatCad(financeStats.netProfitCents)} CAD</Text>
          </View>
        </View>
      </View>

      {/* Order Financial Details Table */}
      <View style={styles.chartCard}>
        <View style={styles.searchWrapper}>
          <TextInput
            value={financeOrderSearch}
            onChangeText={setFinanceOrderSearch}
            placeholder="Search by order number..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            keyboardType="numeric"
          />
        </View>
        {getOrderFinancialDetails ? (
          <View style={styles.metricsList}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Gross revenue</Text>
              <Text style={styles.metricValue}>{formatCad(getOrderFinancialDetails.grossRevenueCents)} CAD</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Platform fees</Text>
              <Text style={styles.metricValue}>{formatCad(getOrderFinancialDetails.platformFeeCents)} CAD</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Commissions</Text>
              <Text style={styles.metricValue}>{formatCad(getOrderFinancialDetails.commissionsCents)} CAD</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Stripe fees</Text>
              <Text style={styles.metricValue}>{formatCad(getOrderFinancialDetails.stripeFeesCents)} CAD</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Refunds</Text>
              <Text style={styles.metricValue}>{formatCad(getOrderFinancialDetails.refundsCents)} CAD</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Net profit</Text>
              <Text style={[styles.metricValue, { color: '#1E794F' }]}>{formatCad(getOrderFinancialDetails.netProfitCents)} CAD</Text>
            </View>
            <View style={[styles.metricRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }]}>
              <Text style={[styles.metricLabel, { fontSize: 12, fontWeight: '400', color: palette.muted }]}>Order #{getOrderFinancialDetails.orderId}</Text>
            </View>
          </View>
        ) : financeOrderSearch ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Order not found. Please enter a valid order number.</Text>
          </View>
        ) : null}
      </View>
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
                        <Text style={{ marginTop: 16, color: palette.text, fontFamily: theme.typography.fontFamily.body }}>Loading order details...</Text>
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
      
      {/* Pagination - Outside horizontal ScrollView */}
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
            <View style={[styles.paginationControlsContainer, isMobile && styles.paginationControlsContainerMobile]}>
              <TouchableOpacity
                onPress={() => setIssuePage((p) => Math.max(1, p - 1))}
                disabled={issuePage === 1}
                style={[styles.paginationArrowButton, issuePage === 1 && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, issuePage === 1 && styles.paginationArrowTextDisabled]}>
                  ←
                </Text>
              </TouchableOpacity>
              <ScrollView
                ref={issuePageScrollRef}
                horizontal
                showsHorizontalScrollIndicator={!isMobile}
                contentContainerStyle={styles.issuesPageScrollContent}
                style={[styles.issuesPageScroll, isMobile && styles.issuesPageScrollMobile]}
                nestedScrollEnabled
                scrollEnabled
              >
                {Array.from({ length: totalIssuePages }, (_, i) => i + 1).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setIssuePage(p);
                    }}
                    activeOpacity={0.7}
                    style={[styles.issuesPageButton, issuePage === p && styles.issuesPageButtonActive]}
                  >
                    <Text style={[styles.issuesPageButtonText, issuePage === p && styles.issuesPageButtonTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setIssuePage((p) => Math.min(totalIssuePages, p + 1))}
                disabled={issuePage === totalIssuePages}
                style={[styles.paginationArrowButton, issuePage === totalIssuePages && styles.paginationArrowButtonDisabled]}
              >
                <Text style={[styles.paginationArrowText, issuePage === totalIssuePages && styles.paginationArrowTextDisabled]}>
                  →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
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
            <Text style={styles.headerSubtitle}>Review marketplace operations now.</Text>
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
            { key: 'orders', title: 'Orders', content: OrdersTab },
            { key: 'chefs', title: 'Chefs', content: ChefsTab },
            { key: 'users', title: 'Users', content: UsersTab },
            { key: 'finance', title: 'Finance', content: FinanceTab },
            { key: 'issues', title: 'Issues', content: IssuesTab },
            { key: 'notifications', title: 'Notifications', content: NotificationsTab },
            { key: 'app-settings', title: 'App settings', content: AppSettingsTab },
          ]}
        />
      </View>
    </View>
  );
 
   return (
    <Screen style={{ backgroundColor: palette.background }} contentStyle={styles.screenContent}>
      {content}
      
      {/* Chef Application Modal - Root level so it works from any tab */}
      {chefApplicationModalId && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            setChefApplicationModalId(null);
            setChefApplicationData(null);
            setChefApplicationPage(1);
          }}
        >
          <TouchableOpacity
            style={styles.issueDetailOverlay}
            activeOpacity={1}
            onPress={() => {
              setChefApplicationModalId(null);
              setChefApplicationData(null);
              setChefApplicationPage(1);
            }}
          >
            <TouchableOpacity
              style={[styles.issueDetailContent, { maxHeight: '90%', width: isMobile ? '95%' : '80%', maxWidth: 800 }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
                    <View style={styles.issueDetailHeader}>
                      <Text style={styles.issueDetailTitle}>
                        Chef application{chefApplicationData?.name ? ` (${chefApplicationData.name})` : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setChefApplicationModalId(null);
                          setChefApplicationData(null);
                          setChefApplicationPage(1);
                        }}
                      >
                        <Text style={styles.issueDetailClose}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
                {!chefApplicationData ? (
                  <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <ActivityIndicator size="large" color={palette.primary} />
                          <Text style={{ marginTop: 16, color: palette.muted, fontFamily: theme.typography.fontFamily.body }}>Loading application</Text>
                  </View>
                ) : (
                  <>
                    {/* Page 1: Basic Information */}
                    {chefApplicationPage === 1 && (
                      <View style={{ padding: 16, gap: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, fontFamily: theme.typography.fontFamily.display }}>Basic information</Text>
                        <View style={{ gap: 12 }}>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Full name</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.name || chefApplicationData.fullName || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Brand name</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.brandName || chefApplicationData.name || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Email</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.email || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Phone</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.phone || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Location</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.location || chefApplicationData.address || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Brief description</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.short_bio || chefApplicationData.briefDescription || chefApplicationData.bio || '—'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Cuisine type</Text>
                            <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.cuisine_specialty || chefApplicationData.cuisine || '—'}</Text>
                          </View>
                          {chefApplicationData.experience && (
                            <View>
                              <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Experience</Text>
                              <Text style={{ fontFamily: theme.typography.fontFamily.body }}>{chefApplicationData.experience}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Page 2: Availability & Pickup */}
                    {chefApplicationPage === 2 && (
                      <View style={{ padding: 16, gap: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, fontFamily: theme.typography.fontFamily.display }}>Availability & pickup</Text>
                        {chefApplicationData.pickup_availability && Array.isArray(chefApplicationData.pickup_availability) && chefApplicationData.pickup_availability.length > 0 ? (
                          <View style={{ gap: 12 }}>
                            {Object.entries(
                              chefApplicationData.pickup_availability.reduce((acc: any, slot: any) => {
                                if (!acc[slot.day]) acc[slot.day] = [];
                                acc[slot.day].push(slot.timeWindow);
                                return acc;
                              }, {})
                            ).map(([day, timeWindows]: [string, any]) => (
                              <View key={day}>
                                <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>{day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()}</Text>
                                <Text>{timeWindows.join(', ')}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ fontFamily: theme.typography.fontFamily.body }}>No pickup availability set</Text>
                        )}
                      </View>
                    )}

                    {/* Page 3: Dishes */}
                    {chefApplicationPage === 3 && (
                      <View style={{ padding: 16, gap: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, fontFamily: theme.typography.fontFamily.display }}>Dishes ({chefApplicationData.dishes?.length || 0})</Text>
                        {chefApplicationData.dishes && chefApplicationData.dishes.length > 0 ? (
                          <View style={{ gap: 16 }}>
                            {chefApplicationData.dishes.map((dish: any, idx: number) => (
                              <View key={dish.id || idx} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 12, gap: 8 }}>
                                {dish.image && (
                                  <Image source={{ uri: dish.image }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" />
                                )}
                                <Text style={{ fontWeight: '700', fontSize: 16, fontFamily: theme.typography.fontFamily.display }}>{dish.name}</Text>
                                <Text style={{ fontWeight: '600', fontFamily: theme.typography.fontFamily.body }}>{cents((dish.price || 0) * 100)}</Text>
                                {dish.description && <Text>{dish.description}</Text>}
                                {dish.ingredients && (
                                  <View>
                                    <Text style={{ fontWeight: '600', marginBottom: 4, fontFamily: theme.typography.fontFamily.body }}>Ingredients</Text>
                                    <Text>{dish.ingredients}</Text>
                                  </View>
                                )}
                                {dish.portion && (
                                  <Text style={{ color: palette.muted, fontFamily: theme.typography.fontFamily.body }}>Portion: {dish.portion}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ fontFamily: theme.typography.fontFamily.body }}>No dishes added</Text>
                        )}
                        {/* Approve/Reject Buttons - Only on last page */}
                        {chefApplicationData && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.border }}>
                            {chefApplicationData.status === 'submitted' || chefApplicationData.status === 'pending' ? (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleApproveChefApplication(chefApplicationModalId, chefApplicationData.id)}
                                  style={styles.approveButton}
                                >
                                  <Text style={styles.approveButtonText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleRejectChefApplication(chefApplicationModalId, chefApplicationData.id)}
                                  style={styles.rejectButton}
                                >
                                  <Text style={styles.rejectButtonText}>Reject</Text>
                                </TouchableOpacity>
                              </>
                            ) : chefApplicationData.status === 'approved' ? (
                              <TouchableOpacity
                                style={[styles.approveButton, { opacity: 0.6 }]}
                                disabled
                              >
                                <Text style={styles.approveButtonText}>Approved</Text>
                              </TouchableOpacity>
                            ) : chefApplicationData.status === 'rejected' ? (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleApproveChefApplication(chefApplicationModalId, chefApplicationData.id)}
                                  style={styles.approveButton}
                                >
                                  <Text style={styles.approveButtonText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.rejectButton, { opacity: 0.6 }]}
                                  disabled
                                >
                                  <Text style={styles.rejectButtonText}>Rejected</Text>
                                </TouchableOpacity>
                              </>
                            ) : null}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              {/* Page Navigation */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: palette.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setChefApplicationPage(p => Math.max(1, p - 1))}
                    disabled={chefApplicationPage === 1}
                    style={[styles.paginationArrowButton, chefApplicationPage === 1 && styles.paginationArrowButtonDisabled]}
                  >
                    <Text style={[styles.paginationArrowText, chefApplicationPage === 1 && styles.paginationArrowTextDisabled]}>←</Text>
                  </TouchableOpacity>
                  <Text style={{ color: palette.muted, fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Page {chefApplicationPage} of 3</Text>
                  <TouchableOpacity
                    onPress={() => setChefApplicationPage(p => Math.min(3, p + 1))}
                    disabled={chefApplicationPage === 3}
                    style={[styles.paginationArrowButton, chefApplicationPage === 3 && styles.paginationArrowButtonDisabled]}
                  >
                    <Text style={[styles.paginationArrowText, chefApplicationPage === 3 && styles.paginationArrowTextDisabled]}>→</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
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
    paddingTop: 28,
    paddingBottom: 0,
    marginBottom: 100,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  headerSubtitle: {
    color: palette.muted,
    fontSize: 15,
    marginTop: 4,
    maxWidth: 360,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  warningButton: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  tabScroll: {
    paddingHorizontal: 4,
    paddingVertical: 16,
    ...Platform.select({
      web: {
        overflow: 'visible',
      },
    }),
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 12,
    fontFamily: theme.typography.fontFamily.display,
  },
  searchWrapper: {
    paddingHorizontal: 12,
    marginBottom: 16,
    paddingRight: 8,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  orderFinancialTable: {
    marginTop: 8,
  },
  orderFinancialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  orderFinancialCell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  orderFinancialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderFinancialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 4,
  },
  orderFinancialOrderId: {
    fontSize: 12,
    color: palette.muted,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 14,
    marginBottom: 2,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardTimestamp: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardId: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardBodyMuted: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardTotal: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.display,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontWeight: '700',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  sectionLabelInline: {
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  approveButton: {
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  approveButtonText: {
    color: palette.primary,
    fontFamily: theme.typography.fontFamily.body,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  rejectButtonText: {
    color: palette.primary,
    fontFamily: theme.typography.fontFamily.body,
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
  paginationButtonMobile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 70,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  paginationButtonTextDisabled: {
    color: palette.muted,
    fontFamily: theme.typography.fontFamily.body,
  },
  paginationArrowButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    zIndex: 10,
    flexShrink: 0,
    overflow: 'visible',
  },
  paginationArrowButtonDisabled: {
    opacity: 0.3,
  },
  paginationArrowText: {
    color: palette.primary,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily.body,
  },
  paginationArrowTextDisabled: {
    color: palette.muted,
    fontFamily: theme.typography.fontFamily.body,
  },
  paginationStatus: {
    color: palette.muted,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  issuesPaginationWrap: {
    marginTop: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 12,
    width: '100%',
    overflow: 'visible',
  },
  paginationControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'visible',
  },
  paginationControlsContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    width: '100%',
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
    flex: 1,
    marginHorizontal: 8,
  },
  issuesPageScrollMobile: {
    flex: 1,
    minWidth: 0,
  },
  issuesPageScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 0,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  issuesPageButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  issuesTabWrapper: {
    position: 'relative',
    flex: 1,
    overflow: 'visible',
  },
  issuesTabScrollContent: {
    paddingBottom: 60,
  },
  issuesTabInner: {
    paddingBottom: 0,
    paddingRight: 0,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  issueDetailClose: {
    padding: 4,
  },
  issueDetailCloseText: {
    fontSize: 18,
    color: palette.muted,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  issueDetailValue: {
    fontSize: 15,
    color: palette.text,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  orderItemPrice: {
    fontSize: 15,
    color: palette.text,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  summaryValue: {
    fontSize: 15,
    color: palette.text,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  expandIcon: {
    fontSize: 18,
    color: palette.text,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  approveButton: {
    backgroundColor: '#1E794F',
    borderColor: '#1E794F',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.display,
  },
  rejectButton: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.display,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  itemMeta: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  itemPrice: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  accessDeniedSubtitle: {
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  placeholderText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  expandIcon: {
    fontSize: 12,
    color: palette.primary,
    fontFamily: theme.typography.fontFamily.body,
  },
  reviewSectionContent: {
    padding: 16,
    gap: 8,
  },
  reviewItem: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  reviewLabel: {
    fontWeight: '700',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.display,
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
    ...Platform.select({
      web: {
        overflow: 'visible',
      },
      default: {
        overflow: 'visible',
      },
    }),
  },
  chartHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    ...Platform.select({
      web: {
        overflow: 'visible',
        position: 'relative' as any,
        zIndex: 1,
      },
      default: {
        overflow: 'visible',
      },
    }),
  },
  chartTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    ...Platform.select({
      web: {
        overflow: 'visible',
        position: 'relative' as any,
        zIndex: 1,
      },
    }),
  },
  dateFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: palette.neutralBg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  dateFilterButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  dateFilterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  dateFilterButtonTextActive: {
    color: '#FFFFFF',
  },
  dateFilterDropdownWrapper: {
    position: 'relative',
    zIndex: 99998,
    ...Platform.select({
      web: {
        zIndex: 99998,
        position: 'relative' as any,
      },
      ios: {
        zIndex: 99998,
      },
      android: {
        elevation: 999,
        zIndex: 99998,
      },
    }),
  },
  dateFilterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.primary,
    minWidth: 150,
  },
  dateFilterContainerFullWidth: {
    width: '100%',
  },
  dateFilterDropdownWrapperFullWidth: {
    width: '100%',
    flex: 1,
  },
  dateFilterDropdownButtonFullWidth: {
    width: '100%',
    minWidth: 'auto',
  },
  dateFilterDropdownButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.primary,
    fontFamily: theme.typography.fontFamily.body,
  },
  dateFilterDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 1000,
    zIndex: 99999,
    maxHeight: 200,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        zIndex: 99999,
        position: 'absolute' as any,
        backgroundColor: '#FFFFFF',
      },
      ios: {
        zIndex: 99999,
        backgroundColor: '#FFFFFF',
      },
      android: {
        elevation: 1000,
        zIndex: 99999,
        backgroundColor: '#FFFFFF',
      },
    }),
  },
  dateFilterDropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        backgroundColor: '#FFFFFF',
      },
      default: {
        backgroundColor: '#FFFFFF',
      },
    }),
  },
  dateFilterDropdownOptionActive: {
    backgroundColor: palette.primary,
    ...Platform.select({
      web: {
        backgroundColor: palette.primary,
      },
      default: {
        backgroundColor: palette.primary,
      },
    }),
  },
  dateFilterDropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dateFilterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterDropdownMenuMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    width: 180,
    maxHeight: 350,
  },
  dateFilterDropdownOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99998,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
      },
      default: {
        position: 'absolute',
      },
    }),
  },
  dateFilterDropdownOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  dateFilterDropdownOptionTextActive: {
    color: '#FFFFFF',
  },
  chartSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
    fontFamily: theme.typography.fontFamily.body,
  },
  actionablesList: {
    gap: 0,
  },
  actionableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  actionableLabel: {
    fontSize: 14,
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
  },
  actionableValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.display,
  },
  earningsLabel: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  metricsList: {
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        position: 'relative' as any,
        zIndex: 1,
      },
    }),
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamily.body,
  },
  tableContainer: {
    position: 'relative',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
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
    gap: 4,
  },
  tableHeaderCellText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
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
    paddingLeft: 12,
    paddingRight: 6,
  },
  tableCell: {
    color: palette.text,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlignVertical: 'center',
    overflow: 'hidden',
    fontFamily: theme.typography.fontFamily.body,
  },
  createdCell: {
    paddingHorizontal: 2,
  },
  createdHeaderCell: {
    paddingHorizontal: 2,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  chefCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  chefNameText: {
    color: palette.text,
    fontSize: 14,
    flexShrink: 1,
    fontFamily: theme.typography.fontFamily.body,
  },
  chefLinkIcon: {
    padding: 0,
    marginLeft: 2,
  },
  chefLinkIconText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtonReadOnly: {
    opacity: 0.6,
    borderColor: palette.muted,
  },
  actionButtonTextReadOnly: {
    color: palette.muted,
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
  },
  actionDropdownOptionTextSelected: {
    color: palette.primary,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  actionDropdownOptionTextReadOnly: {
    color: palette.muted,
    opacity: 0.6,
    fontFamily: theme.typography.fontFamily.body,
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

