import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image, StyleSheet, Platform } from "react-native";
import { useRouter, Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { theme, elev } from "../../lib/theme";
import { useRole } from "../../hooks/useRole";
import { getProfile, getUserOrders } from "../../lib/db";
import { uploadAvatar } from "../../lib/storage";
import type { Profile, OrderWithItems, OrderStatus } from "../../lib/types";
import { Screen } from "../../components/Screen";

type OrderWithDisplay = OrderWithItems & {
  firstDishName?: string | null;
  firstDishImage?: string | null;
  chefName?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { loading: roleLoading, user, isAdmin, isChef } = useRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [orders, setOrders] = useState<OrderWithDisplay[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!roleLoading && !user) {
      router.replace("/auth");
      return;
    }

    if (user) {
      loadProfile();
      loadOrders();
    }
  }, [user, roleLoading, activeTab]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const prof = await getProfile(user.id);
      if (prof) {
        setProfile(prof);
        setName(prof.name || "");
        setEmail(prof.email || "");
        setPhotoUrl(prof.photo_url || null);
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
      // Fetch all orders for user, then filter client-side
      const allUserOrders = await getUserOrders(user.id, { limit: 100 });
      
      // Active orders: pending or paid
      // Past orders: completed or cancelled
      const statusFilters: OrderStatus[] = activeTab === "active" 
        ? ['pending', 'paid'] 
        : ['completed', 'cancelled'];
      
      // Filter by status
      const filtered = allUserOrders.filter(order => 
        statusFilters.includes(order.status)
      );
      
      // Enrich orders with display info
      const enriched: OrderWithDisplay[] = filtered.map(order => {
        const firstItem = order.order_items?.[0];
        return {
          ...order,
          firstDishName: firstItem?.dish_name || null,
          firstDishImage: firstItem?.dish_image || null,
          chefName: firstItem?.chef_name || null,
        };
      });
      
      setOrders(enriched);
    } catch (e: any) {
      console.error("Error loading orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const updateData: { name: string; photo_url?: string | null } = {
        name: name.trim(),
      };
      
      if (photoUrl !== profile?.photo_url) {
        updateData.photo_url = photoUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      await loadProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAvatar() {
    if (!user) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Please grant camera roll permissions to upload photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingAvatar(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const url = await uploadAvatar(blob, user.id);
      setPhotoUrl(url);
      Alert.alert("Success", "Avatar uploaded successfully. Click 'Save Changes' to update your profile.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
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

  function getStatusInfo(status: OrderStatus) {
    switch (status) {
      case 'paid':
        return { label: 'Out for Delivery', icon: '🚚', color: '#3E6A55' };
      case 'pending':
        return { label: 'Preparing', icon: '👨‍🍳', color: '#D97706' };
      case 'completed':
        return { label: 'Completed', icon: '✓', color: '#3E6A55' };
      case 'cancelled':
        return { label: 'Cancelled', icon: '✕', color: '#EF4444' };
      default:
        return { label: status, icon: '•', color: '#667085' };
    }
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

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || email[0]?.toUpperCase() || "?";

  return (
    <Screen style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        {/* Left Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.sidebarContent}>
            {/* Profile Header */}
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

            {/* Navigation Menu */}
            <View style={styles.navMenu}>
              <TouchableOpacity 
                style={[styles.navItem, styles.navItemActive]}
                onPress={() => setActiveTab("active")}
              >
                <Text style={styles.navIcon}>📄</Text>
                <Text style={[styles.navText, styles.navTextActive]}>My Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navIcon}>❤️</Text>
                <Text style={styles.navText}>Favorite Dishes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navIcon}>🏪</Text>
                <Text style={styles.navText}>Saved Chefs</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.navItem}
                onPress={() => router.push("/profile/settings")}
              >
                <Text style={styles.navIcon}>⚙️</Text>
                <Text style={styles.navText}>Account Settings</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Log Out Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>→</Text>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          <View style={styles.header}>
            <Text style={styles.pageTitle}>My Orders</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "active" && styles.tabActive]}
              onPress={() => setActiveTab("active")}
            >
              <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>
                Active Orders
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "past" && styles.tabActive]}
              onPress={() => setActiveTab("past")}
            >
              <Text style={[styles.tabText, activeTab === "past" && styles.tabTextActive]}>
                Past Orders
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orders List */}
          <ScrollView 
            style={styles.ordersList}
            contentContainerStyle={styles.ordersListContent}
            showsVerticalScrollIndicator={false}
          >
            {ordersLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : orders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {activeTab === "active" ? "No active orders" : "No past orders"}
                </Text>
              </View>
            ) : (
              orders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                const firstItem = order.order_items?.[0];
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderContent}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>Order #HC{String(order.id).padStart(5, '0')}</Text>
                        <Text style={styles.orderDishName}>
                          {order.firstDishName || firstItem?.dish_name || "Order"}
                        </Text>
                        <Text style={styles.orderChef}>
                          {order.chefName || firstItem?.chef_name || "Chef"}
                        </Text>
                        <View style={styles.orderStatus}>
                          <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                          <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.orderButton,
                          order.status === 'paid' ? styles.orderButtonPrimary : styles.orderButtonSecondary
                        ]}
                        onPress={() => router.push(`/order/${order.id}`)}
                      >
                        <Text style={[
                          styles.orderButtonText,
                          order.status === 'paid' ? styles.orderButtonTextPrimary : styles.orderButtonTextSecondary
                        ]}>
                          {order.status === 'paid' ? 'Track Order' : 'View Details'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.orderImageContainer}>
                      <Image
                        source={{ 
                          uri: order.firstDishImage || firstItem?.dish_image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" 
                        }}
                        style={styles.orderImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
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
    backgroundColor: '#FFFFFF',
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
  },
  profileEmail: {
    color: '#3E6A55',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
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
    backgroundColor: 'rgba(62, 106, 85, 0.2)', // primary/20
  },
  navIcon: {
    fontSize: 20,
  },
  navText: {
    color: '#101828',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  navTextActive: {
    color: '#101828',
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
  },
  logoutText: {
    color: '#EF4444',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  pageTitle: {
    color: '#101828',
    fontSize: 36,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.033,
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
  },
  tabTextActive: {
    color: '#101828',
  },
  ordersList: {
    flex: 1,
  },
  ordersListContent: {
    padding: theme.spacing.md,
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
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  orderDishName: {
    color: '#101828',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.fontSize.lg * 1.2,
  },
  orderChef: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  orderStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  statusIcon: {
    fontSize: theme.typography.fontSize.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  orderButton: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignSelf: "flex-start",
  },
  orderButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  orderButtonSecondary: {
    backgroundColor: 'rgba(62, 106, 85, 0.2)',
  },
  orderButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  orderButtonTextPrimary: {
    color: '#FFFFFF',
  },
  orderButtonTextSecondary: {
    color: '#101828',
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
});
