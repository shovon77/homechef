'use client';

// TypeScript declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert, Linking, Platform, StyleSheet, Pressable, useWindowDimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { uploadToBucket } from '../../lib/upload';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { formatLocal } from '../../lib/datetime';
import { updateOrderStatus } from '../../lib/orders';
import { callFn } from '../../lib/fn';
import PayoutSettings from '../../components/chef/PayoutSettings';
import { formatCad, cents } from '../../lib/money';
import { useRole } from '../../hooks/useRole';
import type { Profile, OrderStatus } from '../../lib/types';
import FilePicker from '../../components/FilePicker';

// Colors matching homepage
const PRIMARY_COLOR = '#FE734C';
const ACCENT_COLOR = '#FFA500';
const BG_LIGHT = '#FFFFFF';
const BG_PAGE = '#F2F0EF';
const BG_GRAY = '#F4F4F4';
const TEXT_DARK = '#33393A';
const TEXT_MUTED = '#555555';
const BORDER_LIGHT = '#EAECF0';

type ChefRow = { id: number; name: string; email?: string | null; bio?: string | null; photo?: string | null; location?: string | null };
type DishRow = { id: number; chef_id: number | null; name: string; price: number; description?: string | null; ingredients?: string | null; image?: string | null; thumbnail?: string | null; chef?: string | null };
type OrderRow = { id: number; user_id: string; status: string; total_cents: number; platform_fee_cents?: number | null; created_at: string; pickup_at: string | null; stripe_transfer_id?: string | null; order_items?: Array<{ id: number; dish_id: number; dish_name?: string; quantity: number; unit_price_cents: number }>; user_email?: string };

export default function ChefDashboard() {
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chef, setChef] = useState<ChefRow | null>(null);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  
  // Initialize activeTab from localStorage or default
  const getInitialTab = (): 'dashboard' | 'menu' | 'orders' | 'reviews' | 'payouts' => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('chef_dashboard_active_tab');
        if (saved && ['dashboard', 'menu', 'orders', 'reviews', 'payouts'].includes(saved)) {
          return saved as any;
        }
      }
    } catch {}
    // Default to dashboard
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'orders' | 'reviews' | 'payouts'>(getInitialTab());
  const tabBarScrollRef = useRef<ScrollView>(null);
  const tabPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const [tabLayoutReady, setTabLayoutReady] = useState(false);
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentScrollX = useRef<number>(0);
  const userInitiatedTabChange = useRef<boolean>(false);
  const hasScrolledOnLoad = useRef<boolean>(false);

  // Update tab from URL param if present (URL param takes precedence over localStorage)
  useEffect(() => {
    if (tab && typeof tab === 'string' && ['dashboard', 'menu', 'orders', 'reviews', 'payouts'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [tab]);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('chef_dashboard_active_tab', activeTab);
      }
    } catch {}
  }, [activeTab]);

  // Reset tabLayoutReady when activeTab changes to wait for new tab's layout
  useEffect(() => {
    setTabLayoutReady(false);
    hasScrolledOnLoad.current = false; // Reset so it can scroll on refresh
    // Clear any existing timeout when tab changes
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
    // Reset user-initiated flag after a short delay
    setTimeout(() => {
      userInitiatedTabChange.current = false;
    }, 100);
  }, [activeTab]);

  // Scroll to active tab on initial page load/refresh
  useEffect(() => {
    if (tabLayoutReady && tabBarScrollRef.current && tabPositions.current[activeTab] && !hasScrolledOnLoad.current) {
      const tabInfo = tabPositions.current[activeTab];
      if (tabInfo && tabInfo.x !== undefined && tabInfo.width > 0) {
        // Check if tab is already in view
        const tabLeft = tabInfo.x;
        const tabRight = tabInfo.x + tabInfo.width;
        const viewportLeft = currentScrollX.current;
        const viewportRight = currentScrollX.current + width;
        const margin = 20;
        const isTabVisible = tabLeft >= (viewportLeft - margin) && tabRight <= (viewportRight + margin);
        
        if (!isTabVisible) {
          // Scroll immediately on page load (no delay)
          const tabCenter = tabInfo.x + (tabInfo.width / 2);
          const scrollPosition = tabCenter - (width / 2);
          const maxScroll = Math.max(0, scrollPosition);
          tabBarScrollRef.current.scrollTo({
            x: maxScroll,
            animated: true,
          });
        }
        hasScrolledOnLoad.current = true;
      }
    }
  }, [tabLayoutReady, activeTab, width]);

  // Auto-scroll to active tab when it changes (with 3 second delay)
  // Only scroll if the tab change was NOT user-initiated (e.g., from URL param or programmatic change)
  useEffect(() => {
    // Clear any existing timeout
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }

    // Don't auto-scroll if user manually clicked the tab
    if (userInitiatedTabChange.current) {
      return;
    }

    if (tabLayoutReady && tabBarScrollRef.current && tabPositions.current[activeTab]) {
      const tabInfo = tabPositions.current[activeTab];
      // Only scroll if we have valid position data
      if (tabInfo && tabInfo.x !== undefined && tabInfo.width > 0) {
        // Set a 3 second delay before auto-scrolling
        autoScrollTimeoutRef.current = setTimeout(() => {
          // Re-check that the position still exists and is valid
          if (tabBarScrollRef.current && tabPositions.current[activeTab]) {
            const currentTabInfo = tabPositions.current[activeTab];
            if (currentTabInfo && currentTabInfo.x !== undefined && currentTabInfo.width > 0) {
              // Check if tab is already visible using current scroll position
              const tabLeft = currentTabInfo.x;
              const tabRight = currentTabInfo.x + currentTabInfo.width;
              const viewportLeft = currentScrollX.current;
              const viewportRight = currentScrollX.current + width;
              
              // Check if tab is already visible (with some margin for edge cases)
              const margin = 20;
              const isTabVisible = tabLeft >= (viewportLeft - margin) && tabRight <= (viewportRight + margin);
              
              if (!isTabVisible) {
                // Calculate scroll position to center the tab
                const tabCenter = currentTabInfo.x + (currentTabInfo.width / 2);
                const scrollPosition = tabCenter - (width / 2);
                // Ensure we don't scroll to negative position
                const maxScroll = Math.max(0, scrollPosition);
                tabBarScrollRef.current.scrollTo({
                  x: maxScroll,
                  animated: true,
                });
              }
            }
          }
        }, 3000);
      }
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, [activeTab, width, tabLayoutReady]);

  // Memoize the scroll handler to prevent recreation - must be called before any JSX
  const handleTabBarScroll = useCallback((event: any) => {
    // Update current scroll position
    const scrollX = event.nativeEvent.contentOffset.x;
    currentScrollX.current = scrollX;
    
    // Check if active tab is out of view and scroll it back into view (with 3 second delay)
    if (tabPositions.current[activeTab] && tabBarScrollRef.current) {
      const tabInfo = tabPositions.current[activeTab];
      const viewportWidth = width;
      const tabLeft = tabInfo.x;
      const tabRight = tabInfo.x + tabInfo.width;
      const viewportLeft = scrollX;
      const viewportRight = scrollX + viewportWidth;
      
      // Check if tab is completely out of view (with some margin)
      const margin = 10;
      const isTabOutOfView = tabRight < (viewportLeft - margin) || tabLeft > (viewportRight + margin);
      const isTabFullyInView = tabLeft >= (viewportLeft + margin) && tabRight <= (viewportRight - margin);
      
      // If tab is out of view, schedule auto-scroll after 3 seconds
      if (isTabOutOfView) {
        // Clear any existing timeout first to reset the 3-second timer
        if (autoScrollTimeoutRef.current) {
          clearTimeout(autoScrollTimeoutRef.current);
        }
        
        // Set a 3 second delay before auto-scrolling
        autoScrollTimeoutRef.current = setTimeout(() => {
          // Re-check conditions before scrolling
          if (tabBarScrollRef.current && tabPositions.current[activeTab]) {
            const currentTabInfo = tabPositions.current[activeTab];
            if (currentTabInfo && currentTabInfo.x !== undefined && currentTabInfo.width > 0) {
              // Check current scroll position
              const currentScroll = currentScrollX.current;
              const currentTabLeft = currentTabInfo.x;
              const currentTabRight = currentTabInfo.x + currentTabInfo.width;
              const currentViewportLeft = currentScroll;
              const currentViewportRight = currentScroll + viewportWidth;
              
              // Only scroll if tab is still out of view
              const stillOutOfView = currentTabRight < (currentViewportLeft - margin) || currentTabLeft > (currentViewportRight + margin);
              
              if (stillOutOfView) {
                // Calculate scroll position to center the tab
                const tabCenter = currentTabInfo.x + (currentTabInfo.width / 2);
                const scrollPosition = tabCenter - (viewportWidth / 2);
                tabBarScrollRef.current.scrollTo({
                  x: Math.max(0, scrollPosition),
                  animated: true,
                });
              }
            }
          }
          // Clear the timeout ref after execution
          autoScrollTimeoutRef.current = null;
        }, 3000);
      } else if (isTabFullyInView) {
        // Tab is fully in view, cancel any pending auto-scroll
        if (autoScrollTimeoutRef.current) {
          clearTimeout(autoScrollTimeoutRef.current);
          autoScrollTimeoutRef.current = null;
        }
      }
      // If tab is partially visible, don't cancel the timeout - let it complete if it was already set
    }
  }, [activeTab, width]);

  const [orderStatusFilter, setOrderStatusFilter] = useState<'requested' | 'pending' | 'ready' | 'paid' | 'completed' | 'cancelled' | 'rejected'>('requested');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState('');
  const { user, profile, refreshRole } = useRole();
  const [chargesEnabled, setChargesEnabled] = useState<boolean>(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [payoutsEnabled, setPayoutsEnabled] = useState<boolean>(false);
  const [earningsRange, setEarningsRange] = useState<'week' | 'month'>('week');
  const [reviews, setReviews] = useState<Array<{ id: number; rating: number; comment: string | null; created_at: string; user_email?: string; user_name?: string }>>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrderUserId, setSelectedOrderUserId] = useState<string | null>(null);
  const [orderMessages, setOrderMessages] = useState<MessageWithUser[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedOrderUserEmail, setSelectedOrderUserEmail] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  
  type MessageWithUser = {
    id: number;
    order_id: number;
    user_id: string;
    chef_id: number;
    message: string;
    created_at: string;
    chef_name?: string | null;
    user_email?: string;
    sender_user_id?: string | null;
    recipient_user_id?: string | null;
    sender_type?: 'customer' | 'chef' | null;
  };

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


  async function handleLogout() {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/auth");
          },
        },
      ]
    );
  }

  async function handleDeactivateChefAccount() {
    console.log("handleDeactivateChefAccount called", { chef: !!chef, user: !!user });
    
    if (!chef || !user) {
      Alert.alert("Error", "Chef or user information is missing. Please try again.");
      return;
    }

    // Use window.confirm for web compatibility, Alert.alert for native
    const confirmed = Platform.OS === 'web' 
      ? window.confirm("Are you sure you want to deactivate your chef account? Your chef profile will be deactivated and you will become a regular user. You won't be able to access chef features or receive orders. Your data will be preserved.")
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Deactivate Chef Account",
            "Are you sure you want to deactivate your chef account? Your chef profile will be deactivated and you will become a regular user. You won't be able to access chef features or receive orders. Your data will be preserved.",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              {
                text: "Deactivate",
                style: "destructive",
                onPress: () => resolve(true),
              },
            ]
          );
        });

    if (!confirmed) {
      return;
    }

    try {
      console.log("Deactivate confirmed, starting deactivation process");
      
      // Deactivate chef account by setting status to 'inactive' or similar
      const { error: chefError } = await supabase
        .from("chefs")
        .update({ 
          status: 'inactive'
        })
        .eq("id", chef.id);
      
      if (chefError) {
        console.error("Chef deactivation error:", chefError);
        // If status field doesn't exist, try updating is_active if it exists
        const { error: altError } = await supabase
          .from("chefs")
          .update({ 
            is_active: false
          })
          .eq("id", chef.id);
        
        if (altError) {
          console.log("Chef status update error (fields may not exist, which is fine):", altError);
        }
      }
      
      // Update user profile to remove chef status - this is critical
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          is_chef: false
        })
        .eq("id", user.id);
      
      if (profileError) {
        console.error("Profile update error:", profileError);
        throw new Error("Failed to update user profile. Please try again.");
      }
      
      // Mark chef record as inactive instead of deleting
      // This preserves the data for potential reactivation
      const { error: chefStatusError } = await supabase
        .from("chefs")
        .update({ 
          status: 'inactive'
        })
        .eq("id", chef.id);
      
      if (chefStatusError) {
        console.error("Chef status update error:", chefStatusError);
        // If status field doesn't exist, try is_active field
        const { error: altError } = await supabase
          .from("chefs")
          .update({ 
            is_active: false
          })
          .eq("id", chef.id);
        
        if (altError) {
          console.warn("Could not update chef status, but profile was updated. You may need to run the migration script.");
        }
      }
      
      // Wait a moment for the database to commit the changes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the role to get the updated profile
      if (refreshRole) {
        await refreshRole();
        console.log("Role refreshed after deactivation");
      }
      
      // Wait a bit more to ensure role is refreshed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (Platform.OS === 'web') {
        alert("Chef account deactivated successfully. You are now a regular user. You can reactivate your chef account later by contacting support.");
      } else {
        Alert.alert(
          "Success", 
          "Chef account deactivated successfully. You are now a regular user. You can reactivate your chef account later by contacting support.",
          [
            {
              text: "OK",
              onPress: () => {
                // Sign out and redirect to auth to refresh user role
                supabase.auth.signOut().then(() => {
                  router.replace("/auth");
                });
              }
            }
          ]
        );
      }
      
      // Sign out and redirect to auth to refresh user role
      await supabase.auth.signOut();
      router.replace("/auth");
    } catch (e: any) {
      console.error("Deactivate chef account error:", e);
      const errorMsg = e?.message || "Failed to deactivate chef account. Please try again.";
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
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

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this dish?')) {
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
      return;
    }

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
      // Fetch orders with all relevant statuses for chef dashboard
      // Include: requested, pending, ready, completed, cancelled, rejected
      // Include: payment_status='succeeded' OR (payment_status IS NULL AND has stripe_payment_intent_id)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id,user_id,status,total_cents,platform_fee_cents,created_at,pickup_at,chef_id,stripe_transfer_id,payment_status,stripe_payment_intent_id,checkout_session_id')
        .eq('chef_id', chefId)
        .in('status', ['requested', 'pending', 'ready', 'completed', 'cancelled', 'rejected'])
        .order('created_at', { ascending: false });

      if (error || !ordersData) {
        if (error) console.error('load chef orders error', error);
        setOrders([]);
        return;
      }

      // Client-side filter: For 'requested' orders, ONLY show orders where payment was successfully processed
      // For other statuses (pending, ready, completed), show all orders as they've already been confirmed
      // This is strict for 'requested' to ensure chefs only see paid orders
      // Include:
      // 1. payment_status = 'succeeded' (confirmed paid - webhook updated)
      // 2. payment_status IS NULL AND stripe_payment_intent_id IS NOT NULL (legacy paid orders)
      // 3. Orders with status other than 'requested' (pending, ready, completed, etc.)
      // Exclude: 'awaiting_payment', 'failed', 'canceled' for 'requested' orders only
      // Note: Orders with 'awaiting_payment' are NOT shown until webhook updates them to 'succeeded'
      const filteredOrders = ordersData.filter(order => {
        // For non-requested orders (pending, ready, completed, etc.), show them all
        // These orders have already been confirmed by the chef
        if (order.status !== 'requested') {
          return true;
        }
        
        // For 'requested' orders, apply strict payment filtering
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

  // Calculate weekly and monthly earnings
  const weeklyEarnings = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    const day = startOfWeek.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return orders
      .filter(order => {
        if (!order.stripe_transfer_id) return false;
        const orderDate = new Date(order.created_at);
        return orderDate >= startOfWeek && orderDate < endOfWeek;
      })
      .reduce((sum, order) => sum + Math.max(0, (order.total_cents ?? 0) - (order.platform_fee_cents ?? 0)), 0);
  }, [orders]);

  const monthlyEarnings = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return orders
      .filter(order => {
        if (!order.stripe_transfer_id) return false;
        const orderDate = new Date(order.created_at);
        return orderDate >= startOfMonth && orderDate < endOfMonth;
      })
      .reduce((sum, order) => sum + Math.max(0, (order.total_cents ?? 0) - (order.platform_fee_cents ?? 0)), 0);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  // Open message modal for an order
  const handleOpenMessageModal = async (orderId: number, userEmail: string) => {
    setSelectedOrderId(orderId);
    setSelectedOrderUserEmail(userEmail);
    setShowMessageModal(true);
    setMessageText('');
    setOrderMessages([]); // Clear previous messages
    
    // Fetch messages for this order
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Fetching messages for order:', orderId, 'Chef ID:', chef?.id, 'User ID:', user?.id);
      
      // Fetch order details to get customer's user_id
      let customerUserId: string | null = null;
      if (chef?.id) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id,chef_id,user_id')
          .eq('id', orderId)
          .eq('chef_id', chef.id)
          .maybeSingle();
        
        if (orderError || !orderData) {
          console.warn('Order verification:', { orderError, orderData, orderId, chefId: chef.id });
          // Don't block - RLS will handle security, just log for debugging
        } else {
          customerUserId = orderData.user_id;
          setSelectedOrderUserId(customerUserId);
        }
      }
      
      // Fetch messages - RLS should allow if chef_id matches and chef.user_id = auth.uid()
      const { data, error } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      
      console.log('Messages query result:', { 
        data, 
        error, 
        dataLength: data?.length,
        chefId: chef?.id,
        orderId: orderId
      });
      
      if (error) {
        console.error('Error fetching messages:', error);
        Alert.alert('Error', `Failed to load messages: ${error.message}`);
        setOrderMessages([]);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('Found messages:', data.length);
        // Fetch user emails for customer messages
        const userIds = [...new Set(data.map(m => m.user_id).filter(Boolean))];
        let userEmailMap = new Map<string, string>();
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id,email,name')
            .in('id', userIds);
          
          if (profilesError) {
            console.warn('Error fetching user profiles:', profilesError);
          }
          
          if (profilesData) {
            // Use name if available, otherwise fall back to email
            userEmailMap = new Map(profilesData.map((p: any) => [p.id, p.name || p.email || 'Customer']));
          }
        }
        
        // Enhance messages with user name/email info
        const enhancedMessages = data.map(msg => ({
          ...msg,
          user_email: userEmailMap.get(msg.user_id) || userEmail || 'Customer',
        }));
        
        console.log('Enhanced messages:', enhancedMessages);
        setOrderMessages(enhancedMessages);
      } else {
        console.log('No messages found for order:', orderId);
        setOrderMessages([]);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      Alert.alert('Error', `Failed to load messages: ${err?.message || 'Unknown error'}`);
      setOrderMessages([]);
    }
  };

  // Send message function
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedOrderId || !chef || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to send messages');
        return;
      }

      // Find the order to get order details
      const order = orders.find(o => o.id === selectedOrderId);
      if (!order) {
        Alert.alert('Error', 'Order not found');
        return;
      }

      // When chef sends a message:
      // - sender_user_id = chef's user ID (current logged-in user)
      // - recipient_user_id = customer's user ID (from order)
      // - sender_type = 'chef'
      const { data, error } = await supabase
        .from('order_messages')
        .insert({
          order_id: selectedOrderId,
          user_id: user.id, // Keep for backward compatibility
          chef_id: chef.id, // Keep for backward compatibility
          sender_user_id: user.id, // Chef's user ID (who sent it)
          recipient_user_id: order.user_id, // Customer's user ID (who receives it)
          sender_type: 'chef', // Chef sent this message
          message: messageText.trim(),
          chef_name: chef.name,
        })
        .select()
        .single();

      if (error) throw error;

      // Add message to local state
      setOrderMessages(prev => [...prev, data]);
      setMessageText('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Voice dictation function (Web Speech API)
  const handleStartVoiceInput = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Voice dictation is currently only available on web');
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      Alert.alert('Not Supported', 'Voice dictation is not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessageText(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecording(false);
      recognition.stop();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      Alert.alert('Error', 'Voice recognition failed. Please try again.');
      recognition.stop();
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

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
        ? await supabase.from('profiles').select('id, email, name').in('id', userIds)
        : { data: [], error: null };
      const emailMap = new Map((profilesData || []).map((p: any) => [p.id, p.email || '']));
      const nameMap = new Map((profilesData || []).map((p: any) => [p.id, p.name || null]));

      const reviewsWithUsers = (reviewsData || []).map((r: any) => {
        const email = r.user_id ? (emailMap.get(r.user_id) || '') : '';
        const name = r.user_id ? (nameMap.get(r.user_id) || null) : null;
        // Use actual name from profile, or Anonymous if no name
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          user_email: email || undefined,
          user_name: name || 'Anonymous',
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
      <Screen style={{ backgroundColor: BG_PAGE }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_PAGE }}>
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
    { key: 'dashboard' as const, label: 'Overview', iconSource: require('../../assets/controls.png') },
    { key: 'menu' as const, label: 'Menu', iconSource: require('../../assets/notebook.png') },
    { key: 'orders' as const, label: 'Orders', iconSource: require('../../assets/add.png') },
    { key: 'reviews' as const, label: 'My reviews', iconSource: require('../../assets/edit.png') },
    { key: 'payouts' as const, label: 'Payment', iconSource: require('../../assets/credit-card.png') },
  ];

  const footerNavItems = [
    { key: 'profile' as const, label: 'Profile', iconSource: require('../../assets/settings.png'), action: 'profile' as const },
    { key: 'logout' as const, label: 'Logout', iconSource: require('../../assets/logout.png'), action: 'logout' as const },
  ];
  
  function handleProfileNavigation() {
    router.push('/chef/profile');
  }
  
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  const Sidebar = (
    <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
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
          <View style={{ flex: 1 }}>
            <Text style={styles.sidebarTitle}>{chef?.name || 'Chef'}</Text>
            {chef?.location ? (
              <Text style={styles.sidebarSubtitle}>{chef.location}</Text>
            ) : null}
          </View>
        </View>
      )}
      
      {!isMobile && (
        <View style={styles.sidebarSectionFooter}>
          {footerNavItems.map(item => {
            const handlePress = item.action === 'logout'
              ? handleLogout
              : handleProfileNavigation;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={handlePress}
                style={styles.footerNavItem}
              >
                <Image 
                  source={item.iconSource} 
                  style={[styles.footerNavIcon, { tintColor: '#FE734C' }]} 
                  resizeMode="contain" 
                />
                <Text style={styles.footerNavLabel}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const WelcomeHeader = (
    <View style={styles.welcomeHeader}>
      <Text style={styles.welcomeTitle}>Welcome, {chef?.name?.split(' ')[0] || 'Chef'}!</Text>
      <Text style={styles.welcomeSubtitle}>Here's a summary of your business today.</Text>
    </View>
  );

  // TabBar component - render directly (not memoized) so it always has access to current activeTab
  // The ScrollView will stay mounted because it's always in the same position with the same ref
  const TabBar = (
    <View style={styles.tabBarWrapper} key="tab-bar-stable">
      <ScrollView 
        ref={tabBarScrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
        onScroll={handleTabBarScroll}
        scrollEventThrottle={16}
      >
        {navItems.map(item => (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              userInitiatedTabChange.current = true;
              setActiveTab(item.key);
            }}
            style={[styles.tab, activeTab === item.key && styles.tabActive]}
            onLayout={(event) => {
              const { x, width: tabWidth } = event.nativeEvent.layout;
              // Only record position if we have valid dimensions
              if (tabWidth > 0 && x >= 0) {
                tabPositions.current[item.key] = { x, width: tabWidth };
                // When the active tab's layout is measured, trigger scroll
                if (item.key === activeTab) {
                  setTimeout(() => setTabLayoutReady(true), 150);
                }
              }
            }}
          >
            <View style={styles.tabContent}>
              <Image 
                source={item.iconSource} 
                style={[styles.tabIcon, { tintColor: activeTab === item.key ? '#FFFFFF' : '#33393A' }]} 
                resizeMode="contain" 
              />
              <Text style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}>
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
                backgroundColor: orderStatusFilter === status ? PRIMARY_COLOR : 'transparent',
                minWidth: 100,
              }}
            >
              <Text style={{ color: orderStatusFilter === status ? '#FFFFFF' : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
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
                    <View style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await handleOrderStatus(order.id, 'ready');
                            Alert.alert('Success', 'Order marked as ready!');
                          } catch (err: any) {
                            Alert.alert('Update failed', err?.message || 'Unable to mark order as ready');
                          }
                        }}
                        style={{ backgroundColor: '#FE734C', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Mark as Ready</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleOpenMessageModal(order.id, order.user_email || 'Customer')}
                        style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: PRIMARY_COLOR, paddingVertical: 8, paddingHorizontal: isMobile ? 12 : 16, borderRadius: 8, alignSelf: 'flex-start', minWidth: isMobile ? 100 : 'auto' }}
                      >
                        <Text style={{ color: PRIMARY_COLOR, fontSize: 12, fontWeight: '800' }}>Messages</Text>
                      </TouchableOpacity>
                      <Text style={{ color: PRIMARY_COLOR, fontWeight: '700' }}>In the kitchen</Text>
                    </View>
                  ) : order.status === 'ready' ? (
                    <View style={{ backgroundColor: '#FE734C20', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                      <Text style={{ color: '#FE734C', fontSize: 12, fontWeight: '700' }}>Ready</Text>
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
    <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 32, paddingBottom: 120 }}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4, minWidth: '100%' }}>
        {(['requested', 'pending', 'ready', 'paid', 'completed', 'cancelled', 'rejected'] as const).map(status => (
          <TouchableOpacity
            key={status}
            onPress={() => setOrderStatusFilter(status)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 6,
              backgroundColor: orderStatusFilter === status ? PRIMARY_COLOR : 'transparent',
              minWidth: 100,
            }}
          >
            <Text style={{ color: orderStatusFilter === status ? '#FFFFFF' : TEXT_MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
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
                    <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await handleOrderStatus(order.id, 'ready');
                      Alert.alert('Success', 'Order marked as ready!');
                    } catch (err: any) {
                      Alert.alert('Update failed', err?.message || 'Unable to mark order as ready');
                    }
                  }}
                style={{ backgroundColor: '#FE734C', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Mark as Ready</Text>
                </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleOpenMessageModal(order.id, order.user_email || 'Customer')}
                        style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: PRIMARY_COLOR, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                      >
                        <Text style={{ color: PRIMARY_COLOR, fontSize: 12, fontWeight: '800' }}>Messages</Text>
                </TouchableOpacity>
                <Text style={{ color: PRIMARY_COLOR, fontWeight: '700' }}>In the kitchen</Text>
              </View>
            ) : order.status === 'ready' ? (
            <View style={{ backgroundColor: '#FE734C20', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
              <Text style={{ color: '#FE734C', fontSize: 12, fontWeight: '700' }}>Ready</Text>
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
      {/* Rating Summary Card */}
      <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: TEXT_DARK, fontSize: 28, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
              {reviewStats.count > 0 ? reviewStats.avg.toFixed(1) : '0.0'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const rounded = Math.round(reviewStats.avg * 2) / 2; // Round to nearest 0.5
                if (star <= Math.floor(rounded)) {
                  return <Text key={star} style={{ fontSize: 28, color: PRIMARY_COLOR }}>★</Text>;
                } else if (star === Math.ceil(rounded) && rounded % 1 === 0.5) {
                  // Half star - show half-filled using overlay technique
                  return (
                    <View key={star} style={{ position: 'relative', width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, color: '#D1D5DB' }}>★</Text>
                      <View style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 28, overflow: 'hidden' }}>
                        <Text style={{ fontSize: 28, color: PRIMARY_COLOR, lineHeight: 28 }}>★</Text>
                      </View>
                    </View>
                  );
                } else {
                  return <Text key={star} style={{ fontSize: 28, color: '#D1D5DB' }}>★</Text>;
                }
              })}
            </View>
          </View>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
            Based on {reviewStats.count} {reviewStats.count === 1 ? 'review' : 'reviews'}
          </Text>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Text style={{ color: TEXT_DARK, fontSize: 14, fontWeight: '700' }}>
                            {review.rating.toFixed(1)}
                          </Text>
                          <View style={{ flexDirection: 'row' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Text key={star} style={{ fontSize: 16, color: star <= review.rating ? PRIMARY_COLOR : '#D1D5DB' }}>★</Text>
                            ))}
                          </View>
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

  return (
    <Screen style={{ backgroundColor: BG_PAGE }}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        {Sidebar}
        <View style={styles.content}>
          {/* Render TabBar once at the top level to prevent reloading */}
          <View style={{ backgroundColor: BG_PAGE, paddingTop: 32, paddingHorizontal: 32, paddingBottom: 0 }}>
            {WelcomeHeader}
            {TabBar}
          </View>
          {/* Tab content without WelcomeHeader and TabBar */}
          {activeTab === 'dashboard' && (
            <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 24, paddingBottom: 120, paddingTop: 0 }}>
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
                          backgroundColor: earningsRange === 'week' ? PRIMARY_COLOR : 'transparent',
                        }}
                      >
                        <Text style={{ color: earningsRange === 'week' ? '#FFFFFF' : TEXT_DARK, fontWeight: '700', fontSize: 12 }}>Week</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setEarningsRange('month')}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 12,
                          borderRadius: 6,
                          backgroundColor: earningsRange === 'month' ? PRIMARY_COLOR : 'transparent',
                        }}
                      >
                        <Text style={{ color: earningsRange === 'month' ? '#FFFFFF' : TEXT_DARK, fontWeight: '700', fontSize: 12 }}>Month</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={{ color: TEXT_DARK, fontSize: 32, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
                    {formatCad(earningsRange === 'week' ? weeklyEarnings : monthlyEarnings)}
                  </Text>
                </View>
                {/* Active Orders Card */}
                <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                  <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', fontFamily: theme.typography.fontFamily.display, marginBottom: 16 }}>Active Orders</Text>
                  <Text style={{ color: TEXT_DARK, fontSize: 32, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
                    {orders.filter(o => ['requested', 'pending', 'ready', 'paid'].includes(o.status)).length}
                  </Text>
                </View>
                {/* Total Dishes Card */}
                <View style={{ flex: 1, minWidth: 300, backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                  <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', fontFamily: theme.typography.fontFamily.display, marginBottom: 16 }}>Total Dishes</Text>
                  <Text style={{ color: TEXT_DARK, fontSize: 32, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
                    {dishes.length}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
          {activeTab === 'menu' && (
            <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 32, paddingBottom: 120, paddingTop: 0 }}>
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
              <NewDishForm onCreate={createDish} saving={saving} />
              <View style={{ gap: 24 }}>
                {dishes.length === 0 ? (
                  <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>No dishes yet. Add your first dish above.</Text>
                ) : (
                  dishes.map(d => (
                    <DishEditor key={d.id} dish={d} onSave={updateDish} onDelete={deleteDish} />
                  ))
                )}
              </View>
            </ScrollView>
          )}
          {activeTab === 'orders' && (
            <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 16, paddingBottom: 120, paddingTop: 0 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', backgroundColor: BG_GRAY, borderRadius: 8, padding: 4, minWidth: '100%' }}>
                {(['requested', 'pending', 'ready', 'paid', 'completed', 'cancelled', 'rejected'] as const).map(status => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setOrderStatusFilter(status)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 6,
                      backgroundColor: orderStatusFilter === status ? PRIMARY_COLOR : 'transparent',
                      marginRight: 4,
                    }}
                  >
                    <Text style={{ color: orderStatusFilter === status ? '#FFFFFF' : TEXT_DARK, fontWeight: '700', fontSize: 14, textTransform: 'capitalize' }}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {filteredOrders.map(order => (
                <View key={order.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT_DARK, fontSize: 18, fontWeight: '900', fontFamily: theme.typography.fontFamily.display, marginBottom: 4 }}>
                        Order #{order.id}
                      </Text>
                      <Text style={{ color: TEXT_MUTED, fontSize: 14, marginBottom: 4 }}>
                        {order.user_email || 'Unknown user'}
                      </Text>
                      <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>
                        {formatLocal(order.created_at)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '900', fontFamily: theme.typography.fontFamily.display, marginBottom: 4 }}>
                        {formatCad(order.total_cents)}
                      </Text>
                      <View style={{
                        paddingVertical: 4,
                        paddingHorizontal: 12,
                        borderRadius: 6,
                        backgroundColor: order.status === 'completed' ? '#10B981' : order.status === 'cancelled' || order.status === 'rejected' ? '#EF4444' : '#F59E0B',
                      }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }}>
                          {order.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {order.order_items && order.order_items.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: BORDER_LIGHT, paddingTop: 16, marginTop: 16 }}>
                      {order.order_items.map((item, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ color: TEXT_DARK, fontSize: 14 }}>
                            {item.dish_name || `Dish #${item.dish_id}`} x {item.quantity}
                          </Text>
                          <Text style={{ color: TEXT_DARK, fontSize: 14, fontWeight: '700' }}>
                            {formatCad(item.unit_price_cents * item.quantity)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    {order.status === 'requested' && (
                      <>
                        <TouchableOpacity
                          onPress={() => updateOrderStatus(order.id, 'pending')}
                          style={{ flex: 1, backgroundColor: PRIMARY_COLOR, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => updateOrderStatus(order.id, 'rejected')}
                          style={{ flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {order.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => updateOrderStatus(order.id, 'ready')}
                        style={{ flex: 1, backgroundColor: PRIMARY_COLOR, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Mark Ready</Text>
                      </TouchableOpacity>
                    )}
                    {order.status === 'ready' && (
                      <TouchableOpacity
                        onPress={() => updateOrderStatus(order.id, 'paid')}
                        style={{ flex: 1, backgroundColor: PRIMARY_COLOR, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Mark Paid</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {filteredOrders.length === 0 && (
                <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center', padding: 32 }}>No {orderStatusFilter} orders</Text>
              )}
            </ScrollView>
          )}
          {activeTab === 'reviews' && (
            <ScrollView style={{ flex: 1, backgroundColor: BG_PAGE }} contentContainerStyle={{ padding: 32, gap: 24, paddingBottom: 120, paddingTop: 0 }}>
              {/* Rating Summary Card */}
              <View style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: TEXT_DARK, fontSize: 28, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
                      {reviewStats.avg.toFixed(1)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const rounded = Math.round(reviewStats.avg * 2) / 2; // Round to nearest 0.5
                        if (star <= Math.floor(rounded)) {
                          return <Text key={star} style={{ fontSize: 28, color: PRIMARY_COLOR }}>★</Text>;
                        } else if (star === Math.ceil(rounded) && rounded % 1 === 0.5) {
                          // Half star - show half-filled using overlay technique
                          return (
                            <View key={star} style={{ position: 'relative', width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ fontSize: 28, color: '#D1D5DB' }}>★</Text>
                              <View style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 28, overflow: 'hidden' }}>
                                <Text style={{ fontSize: 28, color: PRIMARY_COLOR, lineHeight: 28 }}>★</Text>
                              </View>
                            </View>
                          );
                        } else {
                          return <Text key={star} style={{ fontSize: 28, color: '#D1D5DB' }}>★</Text>;
                        }
                      })}
                    </View>
                  </View>
                  <Text style={{ color: TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                    Based on {reviewStats.count} {reviewStats.count === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              </View>
              {/* Reviews List */}
              {filteredAndSortedReviews.length > 0 ? (
                <View style={{ gap: 16 }}>
                  {filteredAndSortedReviews.map(review => (
                    <View key={review.id} style={{ backgroundColor: BG_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                            {review.user_name || 'Anonymous'}
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>
                            {formatLocal(review.created_at)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ color: TEXT_DARK, fontSize: 16, fontWeight: '700' }}>
                            {review.rating.toFixed(1)}
                          </Text>
                          <View style={{ flexDirection: 'row' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Text key={star} style={{ fontSize: 20, color: star <= review.rating ? PRIMARY_COLOR : '#D1D5DB' }}>★</Text>
                            ))}
                          </View>
                        </View>
                      </View>
                      {review.comment && (
                        <Text style={{ color: TEXT_DARK, fontSize: 14, lineHeight: 20 }}>
                          {review.comment}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center', padding: 32 }}>
                  {reviewSearch ? 'No reviews match your search' : 'No reviews yet'}
                </Text>
              )}
            </ScrollView>
          )}
          {activeTab === 'payouts' && (
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
          )}
        </View>
      </View>

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowMessageModal(false);
          setMessageText('');
          handleStopVoiceInput();
        }}
      >
        <View style={messageModalStyles.modalOverlay}>
          <View style={messageModalStyles.modalContent}>
            <View style={messageModalStyles.modalHeader}>
              <View style={messageModalStyles.modalTitleContainer}>
                <Text style={messageModalStyles.modalTitle}>{selectedOrderUserEmail || 'Customer'}</Text>
                <Text style={messageModalStyles.modalSubtitle}>Order #{selectedOrderId}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowMessageModal(false);
                  setMessageText('');
                  handleStopVoiceInput();
                }}
                style={messageModalStyles.modalCloseButton}
              >
                <Text style={messageModalStyles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={messageModalStyles.modalBody}
              contentContainerStyle={messageModalStyles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {/* Messages List */}
              {orderMessages.length > 0 ? (
                <View style={messageModalStyles.messagesList}>
                  {orderMessages.map(message => {
                    // Check if this message was sent by the chef (current logged-in chef)
                    // Use sender_type if available (new schema), otherwise fall back to user_id comparison
                    const isChefMessage = message.sender_type === 'chef' || 
                      (message.sender_type === null && selectedOrderUserId 
                        ? message.user_id !== selectedOrderUserId 
                        : message.user_id === user?.id);
                    
                    // For chef messages: show "You" (just like order tracking page)
                    // For user messages: show user's name/email
                    const senderName = isChefMessage 
                      ? 'You' 
                      : (message.user_email || 'Customer');
                    
                    return (
                      <View 
                        key={message.id} 
                        style={[
                          messageModalStyles.messageBubbleContainer,
                          isChefMessage ? messageModalStyles.messageBubbleRight : messageModalStyles.messageBubbleLeft
                        ]}
                      >
                        <View style={[
                          messageModalStyles.messageBubble,
                          isChefMessage ? messageModalStyles.messageBubbleChef : messageModalStyles.messageBubbleUser
                        ]}>
                          <Text style={messageModalStyles.messageSenderName}>{senderName}</Text>
                          <Text style={messageModalStyles.messageBody}>{message.message}</Text>
                          <Text style={messageModalStyles.messageTime}>{formatLocal(message.created_at, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={messageModalStyles.emptyMessagesContainer}>
                  <Text style={messageModalStyles.emptyMessagesText}>No messages yet. Start the conversation!</Text>
                </View>
              )}

              {/* Message Input */}
              <View style={messageModalStyles.messageInputContainer}>
                <TextInput
                  style={messageModalStyles.messageInput}
                  placeholder="Type your message..."
                  placeholderTextColor={TEXT_MUTED}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <View style={messageModalStyles.messageInputActions}>
                  <TouchableOpacity
                    style={[messageModalStyles.micButton, isRecording && messageModalStyles.micButtonActive]}
                    onPress={isRecording ? handleStopVoiceInput : handleStartVoiceInput}
                  >
                    <Image 
                      source={require('../../assets/microphone.png')} 
                      style={messageModalStyles.micIconImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[messageModalStyles.sendButton, (!messageText.trim() || sendingMessage) && messageModalStyles.sendButtonDisabled]}
                    onPress={handleSendMessage}
                    disabled={!messageText.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={messageModalStyles.sendButtonIcon}>➤</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  sidebarSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 2,
  },
  welcomeHeader: {
    marginBottom: theme.spacing.md,
  },
  welcomeTitle: {
    color: TEXT_DARK,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: theme.typography.fontFamily.display,
  },
  welcomeSubtitle: {
    color: TEXT_MUTED,
    fontSize: 16,
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.body,
  },
  tabBarWrapper: {
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
    backgroundColor: '#F2F0EF',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 8,
  },
  tabBarContent: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: 4,
  },
  tab: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FE734C',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabIcon: {
    width: 20,
    height: 20,
  },
  tabText: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    letterSpacing: theme.typography.letterSpacing.wide,
    fontFamily: theme.typography.fontFamily.body,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  sidebarSectionFooter: {
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 16,
    marginTop: 'auto',
  },
  footerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  footerNavIcon: {
    width: 20,
    height: 20,
  },
  footerNavLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: '#33393A',
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
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
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
});

const messageModalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: BG_LIGHT,
    borderRadius: 16,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_DARK,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: TEXT_DARK,
    fontWeight: '300',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 20,
  },
  messagesList: {
    marginBottom: 16,
    gap: 8,
    flexGrow: 1,
  },
  emptyMessagesContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessagesText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
  },
  messageBubbleContainer: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 4,
  },
  messageBubbleLeft: {
    justifyContent: 'flex-start',
  },
  messageBubbleRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    gap: 6,
  },
  messageBubbleChef: {
    backgroundColor: 'rgba(254, 115, 76, 0.1)', // Orange background for chef messages
    borderTopRightRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: '#F3F4F6', // Grey background for user messages
    borderTopLeftRadius: 4,
  },
  messageSenderName: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 4,
  },
  messageBody: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  messageTime: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Keep old styles for backward compatibility (not used anymore)
  messageItem: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 8,
  },
  messageItemUser: {
    backgroundColor: '#F9FAFB', // Grey background for user messages
  },
  messageItemChef: {
    backgroundColor: 'rgba(254, 115, 76, 0.1)', // Orange background for chef messages
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageDate: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  messageInputContainer: {
    gap: 12,
  },
  messageInput: {
    minHeight: 120,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    padding: 12,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textAlignVertical: 'top',
  },
  messageInputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  micIconImage: {
    width: 24,
    height: 24,
    tintColor: PRIMARY_COLOR,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
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
                  backgroundColor: '#DC2626', 
                  paddingVertical: 10, 
                  paddingHorizontal: 16, 
                  borderRadius: 8,
                  opacity: saving ? 0.6 : 1
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

