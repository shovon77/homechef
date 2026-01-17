import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Image, StyleSheet, Platform, TextInput, ScrollView, useWindowDimensions, Modal } from "react-native";
import { useRouter, Link, useLocalSearchParams, usePathname } from "expo-router";
import { supabase } from "../../lib/supabase";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, elev } from "../../lib/theme";
import { useRole } from "../../hooks/useRole";
import { getProfile } from "../../lib/db";
import { uploadToBucket } from "../../lib/upload";
import FilePicker from "../../components/FilePicker";
import LocationPicker from "../../components/LocationPicker";
import type { Profile, OrderStatus } from "../../lib/types";
import Screen from "../../components/Screen";
import { formatLocal } from "../../lib/datetime";
import { safeToFixed } from "../../lib/number";
import { formatCad } from "../../lib/money";

type UserOrderSummary = {
  id: number;
  status: string;
  total_cents: number;
  created_at: string;
  pickup_at: string | null;
  chef_id: number | null;
  chef_name?: string | null;
  chef_location?: string | null;
  dish_names?: string[];
  total_quantity?: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { loading: roleLoading, user, isAdmin, isChef, refreshRole } = useRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "completed" | "declined">("all");
  const [activeNavTab, setActiveNavTab] = useState<"orders" | "settings">(tab === "settings" ? "settings" : "orders");
  const [orders, setOrders] = useState<UserOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') {
      return orders;
    } else if (activeTab === 'upcoming') {
      return orders.filter(order => ['requested', 'pending', 'ready', 'paid'].includes(order.status));
    } else if (activeTab === 'completed') {
      return orders.filter(order => order.status === 'completed');
    } else if (activeTab === 'declined') {
      return orders.filter(order => ['cancelled', 'rejected'].includes(order.status));
    }
    return orders;
  }, [orders, activeTab]);

  useEffect(() => {
    if (!roleLoading && !user) {
      router.replace("/auth");
      return;
    }

    if (user) {
      loadProfile();
      loadOrders();
    }
  }, [user, roleLoading]);

  // Update activeNavTab when tab parameter changes
  useEffect(() => {
    if (tab === "settings") {
      setActiveNavTab("settings");
    } else if (tab === "orders" || !tab) {
      setActiveNavTab("orders");
    }
  }, [tab]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const prof = await getProfile(user.id);
      if (prof) {
        setProfile(prof);
        // Parse name into first and last name
        const nameParts = (prof.name || "").trim().split(" ");
        setFirstName(nameParts[0] || "");
        setLastName(nameParts.slice(1).join(" ") || "");
        setEmail(prof.email || "");
        setPhone((prof as any).phone || "");
        setPhotoUrl(prof.photo_url || null);
        setLocation(prof.location || "");
      }
    } catch (e: any) {
      console.error("Error loading profile:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id,status,total_cents,created_at,pickup_at,chef_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const chefIds = [...new Set(rows.map(r => r.chef_id).filter((id): id is number => typeof id === 'number'))];
      const orderIds = rows.map(r => r.id);
      
      let chefMap = new Map<number, { name: string; location: string | null }>();
      let orderItemsMap = new Map<number, Array<{ dish_name: string; quantity: number }>>();

      // Fetch chef names and locations
      if (chefIds.length > 0) {
        const { data: chefsData, error: chefsError } = await supabase
          .from('chefs')
          .select('id,name,location')
          .in('id', chefIds);
        if (!chefsError && chefsData) {
          chefMap = new Map(chefsData.map((c: any) => [c.id, { name: c.name || `Chef #${c.id}`, location: c.location || null }]));
        }
      }

      // Fetch order items with dish names
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id,dish_id,quantity')
          .in('order_id', orderIds);
        
        if (!itemsError && itemsData) {
          const dishIds = [...new Set(itemsData.map((it: any) => it.dish_id).filter((id): id is number => typeof id === 'number'))];
          
          if (dishIds.length > 0) {
            const { data: dishesData, error: dishesError } = await supabase
              .from('dishes')
              .select('id,name')
              .in('id', dishIds);
            
            if (!dishesError && dishesData) {
              const dishMap = new Map(dishesData.map((d: any) => [d.id, d.name]));
              
              itemsData.forEach((item: any) => {
                if (!orderItemsMap.has(item.order_id)) {
                  orderItemsMap.set(item.order_id, []);
                }
                const dishName = dishMap.get(item.dish_id) || 'Unknown Dish';
                orderItemsMap.get(item.order_id)!.push({
                  dish_name: dishName,
                  quantity: item.quantity || 1,
                });
              });
            }
          }
        }
      }

      const enriched: UserOrderSummary[] = rows.map(row => {
        const items = orderItemsMap.get(row.id) || [];
        const chefInfo = row.chef_id ? chefMap.get(row.chef_id) : null;
        
        return {
          id: row.id,
          status: row.status,
          total_cents: row.total_cents ?? 0,
          created_at: row.created_at,
          pickup_at: row.pickup_at ?? null,
          chef_id: row.chef_id ?? null,
          chef_name: chefInfo?.name ?? null,
          chef_location: chefInfo?.location ?? null,
          dish_names: items.map(i => i.dish_name),
          total_quantity: items.reduce((sum, i) => sum + i.quantity, 0),
        };
      });

      setOrders(enriched);
    } catch (e: any) {
      console.error('Error loading orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!firstName.trim()) {
      Alert.alert("Validation", "First name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      // Combine first and last name
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      
      console.log("Attempting to update profile:", { userId: user.id, name: fullName, phone, photoUrl });
      
      // Build update object with name, phone, location, and photo_url if changed
      const updateData: { name: string; phone?: string | null; location?: string | null; photo_url?: string | null } = {
        name: fullName,
        phone: phone.trim() || null,
        location: location.trim() || null,
      };
      
      // Include photo_url if it has changed and is not null
      if (photoUrl !== null && photoUrl !== profile?.photo_url) {
        updateData.photo_url = photoUrl;
      }

      console.log("Update data:", updateData);

      // Update both fields in a single query (more efficient)
      const { data, error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id)
        .select();

      if (error) {
        console.error("Profile update error - full error object:", JSON.stringify(error, null, 2));
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        // If error is about photo_url column not existing, try name only
        if (error.message?.includes('photo_url') || error.code === '42703') {
          console.warn("Photo URL column may not exist, updating name only");
          const { error: nameError, data: nameData } = await supabase
            .from("profiles")
            .update({ name: name.trim() })
            .eq("id", user.id)
            .select();
          
          if (nameError) {
            console.error("Profile name update error:", nameError);
            throw new Error(`Failed to update name: ${nameError.message}`);
          }
          console.log("Name updated successfully:", nameData);
        } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          // RLS policy error
          throw new Error("Permission denied. You may not have permission to update your profile. Please contact support.");
        } else {
          throw new Error(error.message || `Update failed: ${error.code || 'Unknown error'}`);
        }
      } else {
        console.log("Profile updated successfully:", data);
      }

      Alert.alert("Success", "Profile updated successfully");
      await loadProfile();
      // Refresh auth context to update navbar location
      await refreshRole();
    } catch (e: any) {
      console.error("Profile update exception:", e);
      const errorMsg = e?.message || e?.details || "Failed to update profile";
      Alert.alert("Error", errorMsg);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPick(file: File) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadToBucket('public-assets', file, `users/${user.id}/avatar`);
      setPhotoUrl(publicUrl);
      // Automatically save to profile
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id);
      if (error) throw error;
      // Reload profile to get updated data
      await loadProfile();
      Alert.alert("Success", "Avatar uploaded and saved successfully!");
    } catch (e: any) {
      console.error("Avatar upload error:", e);
      Alert.alert("Error", e?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleLogout() {
    setShowLogoutModal(true);
  }

  function handleLogoutCancel() {
    setShowLogoutModal(false);
  }

  async function handleLogoutConfirm() {
    setShowLogoutModal(false);
    await performLogout();
  }

  async function performLogout() {
    try {
      console.log("Starting logout process");
      let hasNavigated = false;
      let subscription: any = null;
      
      const navigateToAuth = () => {
        if (!hasNavigated) {
          hasNavigated = true;
          console.log("Navigating to auth page");
          if (subscription) {
            subscription.unsubscribe();
          }
          router.replace("/auth");
        }
      };

      // Set up a one-time listener for auth state change
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth state changed:", event, session ? "has session" : "no session");
        if (event === 'SIGNED_OUT' || !session) {
          navigateToAuth();
        }
      });
      subscription = sub;
      
      // Try to sign out - even if it fails (403), we'll still proceed
      console.log("Calling signOut");
      const { error } = await supabase.auth.signOut();
      
      // Manually clear session storage to ensure logout works even if signOut fails
      try {
        // Extract project ref from Supabase URL to build exact key
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
        const authKey = projectRef ? `sb-${projectRef}-auth-token` : null;
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Clear Supabase auth token from localStorage
          if (authKey) {
            localStorage.removeItem(authKey);
          }
          // Also clear any other Supabase-related keys as fallback
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('supabase') && key.includes('auth')) {
              localStorage.removeItem(key);
            }
          });
        } else {
          // Native: Clear AsyncStorage keys
          if (authKey) {
            await AsyncStorage.removeItem(authKey);
          }
          // Also clear any other Supabase-related keys as fallback
          const allKeys = await AsyncStorage.getAllKeys();
          const supabaseKeys = allKeys.filter(key => 
            key.includes('supabase') && key.includes('auth')
          );
          if (supabaseKeys.length > 0) {
            await AsyncStorage.multiRemove(supabaseKeys);
          }
        }
        console.log("Manually cleared session storage");
      } catch (storageError) {
        console.warn("Error clearing storage:", storageError);
      }
      
      if (error) {
        console.warn("SignOut error (proceeding anyway):", error);
        // Don't return - proceed with logout even if server request fails
      } else {
        console.log("SignOut successful, waiting for session to clear");
      }

      // Check session after a delay and navigate if cleared
      // This handles both successful signOut and cases where server request failed but local session is cleared
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Fallback check - session:", session ? "exists" : "cleared");
        // Only navigate if session is actually cleared
        if (!session) {
          navigateToAuth();
        } else {
          // If session still exists, wait a bit more and check again
          setTimeout(async () => {
            const { data: { session: recheckSession } } = await supabase.auth.getSession();
            if (!recheckSession) {
              navigateToAuth();
            }
          }, 500);
        }
      }, 500);
    } catch (error: any) {
      console.error("Logout error:", error);
      // Even on error, try to navigate to auth page
      router.replace("/auth");
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Deactivate Account",
      "Are you sure you want to deactivate your account? Your data will be preserved but you will be signed out.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            try {
              // Deactivate account by setting is_active to false (if field exists)
              // If the field doesn't exist, we'll just sign out without deleting records
              const { error: profileError } = await supabase
                .from("profiles")
                .update({ 
                  is_active: false,
                  deactivated_at: new Date().toISOString()
                })
                .eq("id", user.id);
              
              if (profileError) {
                // If is_active/deactivated_at fields don't exist, that's okay
                // We'll just sign out without updating - records are preserved
                console.log("Profile update error (fields may not exist, which is fine):", profileError);
              }
              
              // Sign out the user (this doesn't delete any database records)
              await supabase.auth.signOut();
              router.replace("/auth");
              Alert.alert("Success", "Account deactivated successfully");
            } catch (e: any) {
              console.error("Deactivate account error:", e);
              // Even if update fails, sign out the user (records are still preserved)
              try {
                await supabase.auth.signOut();
                router.replace("/auth");
                Alert.alert("Success", "You have been signed out");
              } catch (signOutError: any) {
                console.error("Sign out error:", signOutError);
                Alert.alert("Error", "Failed to sign out. Please try again.");
              }
            }
          }
        }
      ]
    );
  }

  function getStatusInfo(status: OrderStatus | string) {
    switch (status) {
      case 'requested':
        return { label: 'Requested', icon: '⏳', color: '#3E6A55' };
      case 'pending':
        return { label: 'Preparing', icon: '👨‍🍳', color: '#D97706' };
      case 'ready':
        return { label: 'Ready for Pickup', icon: '🛍️', color: '#2D6966' };
      case 'paid':
        return { label: 'Awaiting Pickup', icon: '🚚', color: '#3E6A55' };
      case 'completed':
        return { label: 'Completed', icon: '✓', color: '#3E6A55' };
      case 'rejected':
        return { label: 'Rejected', icon: '✕', color: '#EF4444' };
      case 'cancelled':
        return { label: 'Cancelled', icon: '✕', color: '#EF4444' };
      default:
        return { label: String(status), icon: '•', color: '#667085' };
    }
  }

  function safeToFixed(num: number, precision: number, defaultValue: string): string {
    const fixed = Number(num).toFixed(precision);
    return isNaN(Number(fixed)) ? defaultValue : fixed;
  }

  // Note: Account Settings functionality moved to separate route
  // For now, navigation items are placeholders except "My Orders"

  if (roleLoading || loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ color: '#101828', fontSize: 18, marginBottom: 16 }}>Please sign in to view your profile</Text>
          <TouchableOpacity
            onPress={() => router.push("/auth")}
            style={{ backgroundColor: theme.colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: "800" }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const initials = [firstName, lastName].filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || email[0]?.toUpperCase() || "?";

  return (
    <Screen scroll contentPadding={16} style={{ backgroundColor: '#F2F0EF' }}>
      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleLogoutCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>Are you sure you want to log out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleLogoutCancel}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleLogoutConfirm}
              >
                <Text style={styles.modalButtonConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.container, isMobile && styles.containerMobile]}>
        {/* Left Sidebar */}
        <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
          <View style={[styles.sidebarContent, isMobile && styles.sidebarContentMobile]}>
            {/* Profile Header */}
            {!isMobile && (
            <View style={styles.profileHeader}>
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{name || "User"}</Text>
                <Text style={styles.profileEmail}>{email || "No email"}</Text>
              </View>
            </View>
            )}

            {/* Navigation Menu - Horizontal Scroll on Mobile */}
            <ScrollView 
              horizontal={isMobile} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[isMobile && styles.navMenuMobileContent]}
              style={[styles.navMenu, isMobile && styles.navMenuMobile]}
            >
              <TouchableOpacity 
                style={[styles.navItem, activeNavTab === "orders" && styles.navItemActive]}
                onPress={() => {
                  setActiveNavTab("orders");
                  if (tab === "settings") {
                    router.push("/profile");
                  }
                }}
              >
                <Text style={[styles.navText, activeNavTab === "orders" && styles.navTextActive]}>Your Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.navItem, activeNavTab === "settings" && styles.navItemActive]}
                onPress={() => {
                  setActiveNavTab("settings");
                  if (tab !== "settings") {
                    router.push("/profile?tab=settings");
                  }
                }}
              >
                <Text style={[styles.navText, activeNavTab === "settings" && styles.navTextActive]}>Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Log Out Button */}
          {!isMobile && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>→</Text>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          )}
        </View>

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {activeNavTab === "orders" ? (
            <>
              {/* Tabs */}
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "all" && styles.tabActive]}
                  onPress={() => setActiveTab("all")}
                >
                  <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
                  onPress={() => setActiveTab("upcoming")}
                >
                  <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>
                    Upcoming
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "completed" && styles.tabActive]}
                  onPress={() => setActiveTab("completed")}
                >
                  <Text style={[styles.tabText, activeTab === "completed" && styles.tabTextActive]}>
                    Completed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "declined" && styles.tabActive]}
                  onPress={() => setActiveTab("declined")}
                >
                  <Text style={[styles.tabText, activeTab === "declined" && styles.tabTextActive]}>
                    Declined
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Orders List - no nested ScrollView, just View */}
              <View style={styles.ordersList}>
                {ordersLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  </View>
                ) : filteredOrders.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No orders yet</Text>
                    <Text style={styles.emptySubtext}>Pickup homemade meals near you</Text>
                  </View>
                ) : (
                  <View style={styles.ordersListContent}>
                    {filteredOrders.map((order) => {
                      const statusInfo = getStatusInfo(order.status);
                      return (
                        <View key={order.id} style={styles.orderCard}>
                          <View style={styles.orderContent}>
                            <View style={styles.orderInfo}>
                              <Text style={styles.orderId}>Order #HC{String(order.id).padStart(5, '0')}</Text>
                              {order.dish_names && order.dish_names.length > 0 && (
                                <Text style={styles.orderDishInfo}>
                                  {order.dish_names[0]}{order.dish_names.length > 1 ? ` +${order.dish_names.length - 1} more` : ''}
                                  {order.total_quantity ? ` × ${order.total_quantity}` : ''}
                                </Text>
                              )}
                              {order.chef_location && (
                                <Text style={styles.orderLocation}>Pickup location: {order.chef_location}</Text>
                              )}
                              {order.pickup_at && (
                                <Text style={styles.orderDishName}>Pickup: {formatLocal(order.pickup_at)}</Text>
                              )}
                              <Text style={styles.orderChef}>Placed: {formatLocal(order.created_at)}</Text>
                              <View style={styles.orderStatus}>
                                <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                  {statusInfo.label}
                                </Text>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Link href={order.status === 'completed' ? `/orders/thank-you?id=${order.id}` : (order.status === 'rejected' || order.status === 'cancelled') ? `/orders/track?id=${order.id}&type=history` : `/orders/track?id=${order.id}`} asChild>
                                  <TouchableOpacity style={styles.orderButtonPrimary}>
                                    <Text style={styles.orderButtonTextPrimary}>View details</Text>
                                  </TouchableOpacity>
                                </Link>
                                <Text style={styles.orderTotal}>{formatCad(order.total_cents / 100)}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.settingsContent}>
              <View style={styles.header}>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.settingsCard}>
                <View style={styles.nameRow}>
                  <View style={styles.nameField}>
                    <Text style={styles.settingsSectionTitle}>First name</Text>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Enter your first name"
                      placeholderTextColor="#94a3b8"
                      style={styles.settingsInput}
                    />
                  </View>
                  <View style={styles.nameField}>
                    <Text style={styles.settingsSectionTitle}>Last name</Text>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Enter your last name"
                      placeholderTextColor="#94a3b8"
                      style={styles.settingsInput}
                    />
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>Email</Text>
                  <TextInput
                    value={email}
                    editable={false}
                    style={[styles.settingsInput, styles.settingsInputReadOnly]}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>Phone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    style={styles.settingsInput}
                  />
                </View>

                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>Location</Text>
                  <LocationPicker
                    value={location}
                    onChange={setLocation}
                    placeholder="Search for your location..."
                    style={styles.locationPicker}
                  />
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                  >
                    <Text style={styles.logoutButtonText}>Logout</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteAccount}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: Platform.select({
      web: "row",
      default: "column",
    }),
    backgroundColor: '#F2F0EF',
    padding: Platform.select({
      web: theme.spacing['3xl'],
      default: theme.spacing.md,
    }),
    gap: theme.spacing['2xl'],
    maxWidth: 1280,
    alignSelf: "center",
    width: "100%",
  },
  sidebar: {
    width: Platform.select({
      web: 256,
      default: "100%",
    }),
    minHeight: Platform.select({
      web: 700,
      default: "auto",
    }),
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    ...elev('sm'),
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sidebarContent: {
    flex: 1,
    gap: theme.spacing.md,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xs / 2,
  },
  profileName: {
    color: '#101828',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.base * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  profileEmail: {
    color: '#3E6A55',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  navMenu: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  navItemActive: {
    backgroundColor: theme.colors.primary,
  },
  navIcon: {
    fontSize: 20,
  },
  navText: {
    color: '#101828',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  navTextActive: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing['2xl'],
  },
  logoutIcon: {
    fontSize: 20,
    color: '#EF4444',
    fontFamily: theme.typography.fontFamily.body,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F2F0EF',
  },
  header: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  pageTitle: {
    color: '#101828',
    fontSize: 36,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.033,
    fontFamily: theme.typography.fontFamily.display,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing['2xl'],
  },
  tab: {
    paddingBottom: 13,
    paddingTop: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.015,
    fontFamily: theme.typography.fontFamily.body,
  },
  tabTextActive: {
    color: '#101828',
    fontFamily: theme.typography.fontFamily.body,
  },
  ordersList: {
    flex: 1,
  },
  ordersListContent: {
    gap: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing['4xl'],
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing['4xl'],
  },
  emptyText: {
    color: '#667085',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.body,
  },
  emptySubtext: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderCard: {
    flexDirection: Platform.select({
      web: "row",
      default: "column",
    }),
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...elev('sm'),
    alignItems: "stretch",
  },
  orderContent: {
    flex: 2,
    flexDirection: "column",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  orderInfo: {
    gap: theme.spacing.xs,
  },
  orderId: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderDishInfo: {
    color: '#101828',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderLocation: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderDishName: {
    color: '#101828',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.fontSize.lg * 1.2,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderChef: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  statusIcon: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderButton: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignSelf: "flex-start",
  },
  orderButtonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  orderButtonSecondary: {
    backgroundColor: 'rgba(62, 106, 85, 0.2)',
  },
  orderButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderButtonTextSecondary: {
    color: '#101828',
    fontFamily: theme.typography.fontFamily.body,
  },
  orderImageContainer: {
    width: Platform.select({
      web: "auto",
      default: "100%",
    }),
    aspectRatio: Platform.select({
      web: 1,
      default: 16 / 9,
    }),
    minWidth: 150,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    flex: 1,
  },
  orderImage: {
    width: "100%",
    height: "100%",
  },
  orderTotal: {
    color: '#101828',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.fontSize.lg * 1.2,
    fontFamily: theme.typography.fontFamily.body,
  },
  settingsContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing['2xl'],
    ...elev('sm'),
  },
  settingsSection: {
    gap: theme.spacing.md,
  },
  settingsSectionTitle: {
    color: '#101828',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
  },
  uploadButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(62, 106, 85, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  uploadButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  settingsInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: '#101828',
    backgroundColor: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  settingsInputReadOnly: {
    backgroundColor: '#F9FAFB',
    color: '#667085',
  },
  settingsHint: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs / 2,
  },
  locationPicker: {
    marginTop: 0,
  },
  nameRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  nameField: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  logoutButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
  },
  // Mobile Styles
  containerMobile: {
    flexDirection: 'column',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  sidebarMobile: {
    width: '100%',
    minHeight: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    boxShadow: 'none', // Remove shadow on mobile for cleaner look
    elevation: 0,
  },
  sidebarContentMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  navMenuMobile: {
    marginTop: 0,
    width: '100%',
  },
  navMenuMobileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      },
      default: {
        elevation: 5,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    fontFamily: theme.typography.fontFamily.body,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  modalButtonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
});
