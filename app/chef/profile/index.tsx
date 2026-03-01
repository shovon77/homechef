import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image, Modal, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter, Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../lib/supabase";
import { theme } from "../../../lib/theme";
import { useRole } from "../../../hooks/useRole";
import { getProfile } from "../../../lib/db";
import { uploadAvatar } from "../../../lib/storage";
import { uploadToBucket } from "../../../lib/upload";
import FilePicker from "../../../components/FilePicker";
import LocationPicker from "../../../components/LocationPicker";
import { formatCad } from "../../../lib/money";
import { formatLocal as formatLocalOrder } from "../../../lib/datetime";
import type { Profile, OrderStatus } from "../../../lib/types";
import { Screen } from "../../../components/Screen";

export default function ChefProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { loading: roleLoading, user, isChef } = useRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingChefLogo, setUploadingChefLogo] = useState(false);
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [chefLogoUrl, setChefLogoUrl] = useState<string | null>(null);
  
  // Onboarding fields
  const [brandName, setBrandName] = useState("");
  const [briefDescription, setBriefDescription] = useState("");
  const [cuisineType, setCuisineType] = useState<string[]>([]);
  const [pickupAvailability, setPickupAvailability] = useState<Array<{ day: string; timeWindow: string }>>([]);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTimeWindows, setSelectedTimeWindows] = useState<string[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsType, setTermsType] = useState<'agreement' | 'fee' | 'payout' | null>(null);
  const [profileSaveMsg, setProfileSaveMsg] = useState<string | null>(null);
  
  // Profile tabs
  const [activeNavTab, setActiveNavTab] = useState<'orders' | 'settings'>('settings');
  const [activeOrderTab, setActiveOrderTab] = useState<'all' | 'upcoming' | 'completed' | 'declined'>('all');
  const [userOrders, setUserOrders] = useState<Array<{
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
  }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);

  const cuisineTypes = [
    'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian', 'Bengali',
    'French', 'Mediterranean', 'American', 'Asian Fusion', 'Vegan', 'Vegetarian',
    'BBQ', 'Seafood', 'Desserts', 'Bakery', 'Middle Eastern', 'Korean',
    'Vietnamese', 'Greek', 'Spanish', 'Caribbean', 'Soul Food', 'Cajun', 'Other'
  ];
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeWindows = [
    '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM', '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM', '04:00 PM - 05:00 PM',
    '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM', '07:00 PM - 08:00 PM'
  ];

  useEffect(() => {
    if (!roleLoading && !isChef) {
      router.replace("/");
      return;
    }

    // Only load profile when user is set and we haven't loaded for this user yet (or user id changed).
    // This avoids refetching on every auth state change (e.g. TOKEN_REFRESHED when tab gains focus).
    if (user && loadedUserIdRef.current !== user.id) {
      loadedUserIdRef.current = user.id;
      loadProfile();
    }
  }, [user, roleLoading, isChef]);

  useEffect(() => {
    if (activeNavTab === 'orders' && user) {
      loadUserOrders();
    }
  }, [activeNavTab, user]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const prof = await getProfile(user.id);
      if (prof) {
        setProfile(prof);
        const nameParts = (prof.name || "").trim().split(" ");
        setFirstName(nameParts[0] || "");
        setLastName(nameParts.slice(1).join(" ") || "");
        setName(prof.name || "");
        setEmail(prof.email || "");
        setPhone((prof as any).phone || "");
        setLocation(prof.location || "");
        setPhotoUrl(prof.photo_url || null);
      }
      
      // Load chef data from chefs table
      const { data: chefData } = await supabase
        .from('chefs')
        .select('name, bio, cuisine, phone, pickup_availability, photo')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (chefData) {
        setBrandName(chefData.name || "");
        setBriefDescription(chefData.bio || "");
        setChefLogoUrl(chefData.photo || null);
        
        // Parse cuisine - could be string or array
        if (chefData.cuisine) {
          if (typeof chefData.cuisine === 'string') {
            try {
              const parsed = JSON.parse(chefData.cuisine);
              setCuisineType(Array.isArray(parsed) ? parsed : chefData.cuisine.split(',').map(c => c.trim()));
            } catch {
              setCuisineType(chefData.cuisine.split(',').map(c => c.trim()));
            }
          } else if (Array.isArray(chefData.cuisine)) {
            setCuisineType(chefData.cuisine);
          }
        }
        
        // Parse pickup_availability
        if (chefData.pickup_availability) {
          try {
            const parsed = typeof chefData.pickup_availability === 'string' 
              ? JSON.parse(chefData.pickup_availability)
              : chefData.pickup_availability;
            if (Array.isArray(parsed)) {
              setPickupAvailability(parsed);
            }
          } catch (e) {
            console.warn('Failed to parse pickup_availability:', e);
          }
        }
      }
    } catch (e: any) {
      console.error("Error loading profile:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserOrders() {
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

      const enriched = rows.map(row => {
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

      setUserOrders(enriched);
    } catch (e: any) {
      console.error('Error loading orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  }

  const filteredUserOrders = useMemo(() => {
    if (activeOrderTab === 'all') {
      return userOrders;
    } else if (activeOrderTab === 'upcoming') {
      return userOrders.filter(order => ['requested', 'pending', 'ready', 'paid'].includes(order.status));
    } else if (activeOrderTab === 'completed') {
      return userOrders.filter(order => order.status === 'completed');
    } else if (activeOrderTab === 'declined') {
      return userOrders.filter(order => ['cancelled', 'rejected'].includes(order.status));
    }
    return userOrders;
  }, [userOrders, activeOrderTab]);

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

  async function handleSaveProfile() {
    if (!user) return;
    if (!firstName.trim()) {
      Alert.alert("Validation", "First name cannot be empty");
      return;
    }
    if (!brandName.trim()) {
      Alert.alert("Validation", "Brand name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      
      // Geocode location if it changed
      let latitude: number | null = null;
      let longitude: number | null = null;
      const locationValue = location.trim() || null;
      if (locationValue && locationValue !== profile?.location) {
        try {
          const { geocodeAddress } = await import('../../lib/geocode');
          const coords = await geocodeAddress(locationValue);
          if (coords) {
            latitude = coords.lat;
            longitude = coords.lon;
          }
        } catch (error) {
          console.warn('Failed to geocode location:', error);
        }
      } else if (locationValue === profile?.location && profile) {
        // Location unchanged, preserve existing coordinates if available
        const existingProfile = profile as any;
        if (existingProfile.latitude && existingProfile.longitude) {
          latitude = existingProfile.latitude;
          longitude = existingProfile.longitude;
        }
      }
      
      const updateData: { 
        name: string; 
        phone?: string | null; 
        location?: string | null; 
        latitude?: number | null;
        longitude?: number | null;
        photo_url?: string | null 
      } = {
        name: fullName,
        phone: phone.trim() || null,
        location: locationValue,
      };
      
      // Add coordinates if we have them
      if (latitude !== null && longitude !== null) {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
      } else if (locationValue === null) {
        // Clear coordinates if location is cleared
        updateData.latitude = null;
        updateData.longitude = null;
      }
      
      if (photoUrl !== null && photoUrl !== profile?.photo_url) {
        updateData.photo_url = photoUrl;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Also update chef's location in chefs table if location changed
      if (locationValue !== profile?.location) {
        const chefLocationUpdate: {
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        } = {
          location: locationValue,
        };
        if (latitude !== null && longitude !== null) {
          chefLocationUpdate.latitude = latitude;
          chefLocationUpdate.longitude = longitude;
        } else if (locationValue === null) {
          chefLocationUpdate.latitude = null;
          chefLocationUpdate.longitude = null;
        }
        
        await supabase
        .from("chefs")
          .update(chefLocationUpdate)
          .eq("user_id", user.id);
      }

      // Update chefs table with onboarding fields
      const chefUpdateData: {
        name: string;
        bio: string | null;
        cuisine: string | null;
        phone: string | null;
        pickup_availability: any;
      } = {
        name: brandName.trim(),
        bio: briefDescription.trim() || null,
        cuisine: cuisineType.length > 0 ? (cuisineType.length === 1 ? cuisineType[0] : JSON.stringify(cuisineType)) : null,
        phone: phone.trim() || null,
        pickup_availability: pickupAvailability.length > 0 ? pickupAvailability : null,
      };
      
      const { error: chefError } = await supabase
            .from("chefs")
        .update(chefUpdateData)
        .eq("user_id", user.id);

      if (chefError) {
        console.error("Failed to update chefs table:", chefError);
        throw chefError;
      }

      setProfileSaveMsg('Profile updated');
      setTimeout(() => setProfileSaveMsg(null), 3000);
      await loadProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPickProfile(file: File) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadToBucket('public-assets', file, `users/${user.id}/avatar`);
      setPhotoUrl(publicUrl);
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert("Success", "Avatar uploaded and saved successfully!");
    } catch (e: any) {
      console.error("Avatar upload error:", e);
      Alert.alert("Error", e?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChefLogoPick(file: File) {
    if (!user) return;
    setUploadingChefLogo(true);
    try {
      const { data: chefData } = await supabase
        .from('chefs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!chefData) throw new Error('Chef record not found');
      
      const { publicUrl } = await uploadToBucket('public-assets', file, `chefs/${chefData.id}/logo`);
      setChefLogoUrl(publicUrl);
      const { error } = await supabase
        .from('chefs')
        .update({ photo: publicUrl })
        .eq('id', chefData.id);
      if (error) throw error;
      Alert.alert("Success", "Chef logo uploaded and saved successfully!");
    } catch (e: any) {
      console.error("Chef logo upload error:", e);
      Alert.alert("Error", e?.message || "Failed to upload chef logo");
    } finally {
      setUploadingChefLogo(false);
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
    if (!user) {
      Alert.alert("Error", "User information is missing. Please try again.");
        return;
      }

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

    if (!confirmed) return;

    try {
      const { data: chefData } = await supabase
        .from('chefs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (chefData) {
        const { error: chefError } = await supabase
          .from("chefs")
          .update({ status: 'inactive' })
          .eq("id", chefData.id);
        
        if (chefError) {
          console.error("Chef deactivation error:", chefError);
        }
      }
      
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_chef: false })
        .eq("id", user.id);
      
      if (profileError) {
        console.error("Profile update error:", profileError);
        Alert.alert("Error", "Failed to deactivate chef account. Please contact support.");
        return;
      }

      Alert.alert("Success", "Your chef account has been deactivated. You are now a regular user.");
      router.replace("/");
    } catch (e: any) {
      console.error("Deactivation error:", e);
      Alert.alert("Error", e?.message || "Failed to deactivate chef account");
    }
  }
  
  function handleAddPickupSlot() {
    if (!selectedDay || selectedTimeWindows.length === 0) {
      Alert.alert("Validation", "Please select a day and at least one time window");
      return;
    }
    
    const newSlots = selectedTimeWindows.map(tw => ({ day: selectedDay, timeWindow: tw }));
    const existing = pickupAvailability.filter(s => s.day !== selectedDay);
    setPickupAvailability([...existing, ...newSlots]);
    setSelectedDay('');
    setSelectedTimeWindows([]);
    setShowPickupModal(false);
  }
  
  function handleRemovePickupSlot(day: string) {
    setPickupAvailability(pickupAvailability.filter(s => s.day !== day));
  }

  if (roleLoading || loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
      </Screen>
    );
  }

  if (!isChef || !user) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontFamily: theme.typography.fontFamily.body }}>Chef access required</Text>
      </View>
      </Screen>
    );
  }

  const initials = [firstName, lastName].filter(Boolean).join(" ")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || email[0]?.toUpperCase() || "?";

  return (
    <Screen style={{ backgroundColor: '#F2F0EF' }} contentStyle={{ paddingBottom: 0, marginBottom: 100 }}>
      <View style={[profileStyles.container, isMobile && profileStyles.containerMobile]}>
        {/* Left Sidebar */}
        <View style={[profileStyles.sidebar, isMobile && profileStyles.sidebarMobile]}>
          <View style={[profileStyles.sidebarContent, isMobile && profileStyles.sidebarContentMobile]}>
            {/* Profile Header */}
            {!isMobile && (
              <View style={profileStyles.profileHeader}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                    style={profileStyles.avatar}
              />
            ) : (
                  <View style={[profileStyles.avatar, profileStyles.avatarPlaceholder]}>
                    <Text style={profileStyles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={profileStyles.profileInfo}>
                  <Text style={profileStyles.profileName}>{[firstName, lastName].filter(Boolean).join(" ") || "User"}</Text>
                  <Text style={profileStyles.profileEmail}>{email || "No email"}</Text>
                </View>
              </View>
            )}

            {/* Navigation Menu */}
            <ScrollView 
              horizontal={isMobile} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[isMobile && profileStyles.navMenuMobileContent]}
              style={[profileStyles.navMenu, isMobile && profileStyles.navMenuMobile]}
            >
              <TouchableOpacity 
                style={[profileStyles.navItem, activeNavTab === "settings" && profileStyles.navItemActive]}
                onPress={() => setActiveNavTab("settings")}
              >
                <Text style={[profileStyles.navText, activeNavTab === "settings" && profileStyles.navTextActive]}>Account</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[profileStyles.navItem, activeNavTab === "orders" && profileStyles.navItemActive]}
                onPress={() => setActiveNavTab("orders")}
              >
                <Text style={[profileStyles.navText, activeNavTab === "orders" && profileStyles.navTextActive]}>Orders</Text>
              </TouchableOpacity>
            </ScrollView>
              </View>

          {/* Log Out Button */}
          {!isMobile && (
            <TouchableOpacity style={profileStyles.logoutButton} onPress={handleLogout}>
              <Text style={profileStyles.logoutIcon}>→</Text>
              <Text style={profileStyles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Content Area */}
        <View style={profileStyles.mainContent}>
          {activeNavTab === "orders" ? (
            <>
              {/* Tabs */}
              <View style={profileStyles.tabs}>
            <TouchableOpacity
                  style={[profileStyles.tab, activeOrderTab === "all" && profileStyles.tabActive]}
                  onPress={() => setActiveOrderTab("all")}
                >
                  <Text style={[profileStyles.tabText, activeOrderTab === "all" && profileStyles.tabTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[profileStyles.tab, activeOrderTab === "upcoming" && profileStyles.tabActive]}
                  onPress={() => setActiveOrderTab("upcoming")}
                >
                  <Text style={[profileStyles.tabText, activeOrderTab === "upcoming" && profileStyles.tabTextActive]}>
                    Upcoming
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[profileStyles.tab, activeOrderTab === "completed" && profileStyles.tabActive]}
                  onPress={() => setActiveOrderTab("completed")}
                >
                  <Text style={[profileStyles.tabText, activeOrderTab === "completed" && profileStyles.tabTextActive]}>
                    Completed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[profileStyles.tab, activeOrderTab === "declined" && profileStyles.tabActive]}
                  onPress={() => setActiveOrderTab("declined")}
                >
                  <Text style={[profileStyles.tabText, activeOrderTab === "declined" && profileStyles.tabTextActive]}>
                    Declined
              </Text>
            </TouchableOpacity>
          </View>

              {/* Orders List */}
              <View style={profileStyles.ordersList}>
                {ordersLoading ? (
                  <View style={profileStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
                ) : filteredUserOrders.length === 0 ? (
                  <View style={profileStyles.emptyContainer}>
                    <Text style={profileStyles.emptyText}>No orders yet</Text>
                    <Text style={profileStyles.emptySubtext}>Pickup homemade meals near you</Text>
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={profileStyles.ordersListContent}>
                    {filteredUserOrders.map((order) => {
                      const statusInfo = getStatusInfo(order.status);
                      return (
                        <View key={order.id} style={profileStyles.orderCard}>
                          <View style={profileStyles.orderContent}>
                            <View style={profileStyles.orderInfo}>
                              <Text style={profileStyles.orderId}>Order #HC{String(order.id).padStart(5, '0')}</Text>
                              {order.dish_names && order.dish_names.length > 0 && (
                                <Text style={profileStyles.orderDishInfo}>
                                  {order.dish_names[0]}{order.dish_names.length > 1 ? ` +${order.dish_names.length - 1} more` : ''}
                                  {order.total_quantity ? ` × ${order.total_quantity}` : ''}
                                </Text>
                              )}
                              {order.chef_location && (
                                <Text style={profileStyles.orderLocation}>Pickup location: {order.chef_location}</Text>
                              )}
                              {order.pickup_at && (
                                <Text style={profileStyles.orderDishName}>Pickup: {formatLocalOrder(order.pickup_at)}</Text>
                              )}
                              <Text style={profileStyles.orderChef}>Placed: {formatLocalOrder(order.created_at)}</Text>
                              <View style={profileStyles.orderStatus}>
                                <Text style={profileStyles.statusIcon}>{statusInfo.icon}</Text>
                                <Text style={[profileStyles.statusText, { color: statusInfo.color }]}>
                                  {statusInfo.label}
                                </Text>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Link href={order.status === 'completed' ? `/orders/thank-you?id=${order.id}` : `/orders/track?id=${order.id}`} asChild>
                                  <TouchableOpacity style={profileStyles.orderButtonPrimary}>
                                    <Text style={profileStyles.orderButtonTextPrimary}>View details</Text>
                                  </TouchableOpacity>
                                </Link>
                                <Text style={profileStyles.orderTotal}>{formatCad(order.total_cents / 100)}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </>
          ) : (
            <ScrollView
              contentContainerStyle={profileStyles.settingsContent}
              style={Platform.OS === 'web' ? {
                flex: 1,
                minWidth: 0,
                backgroundColor: '#F2F0EF',
                overflowX: 'hidden',
              } : undefined}
            >
              <View style={profileStyles.header}>
                <TouchableOpacity
                  style={[profileStyles.saveButton, saving && profileStyles.saveButtonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={profileStyles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
          </View>

              <View style={profileStyles.settingsCard}>
                {/* Chef Logo Field */}
                <View style={profileStyles.settingsSection}>
                  <View style={profileStyles.chefLogoRow}>
                    <Text style={profileStyles.settingsSectionTitle}>Chef logo</Text>
                    <View style={profileStyles.chefLogoContainer}>
                      {chefLogoUrl ? (
                        <Image
                          source={{ uri: chefLogoUrl }}
                          style={profileStyles.settingsAvatar}
                        />
                      ) : (
                        <View style={[profileStyles.settingsAvatar, profileStyles.avatarPlaceholder]}>
                          <Text style={profileStyles.avatarInitials}>🍽️</Text>
                        </View>
                      )}
                      <FilePicker 
                        label={uploadingChefLogo ? "Uploading..." : "Upload logo"} 
                        onFile={handleChefLogoPick} 
                        accept="image/*"
                        disabled={uploadingChefLogo}
                      />
                    </View>
                  </View>
                </View>

                {/* Onboarding Fields Section */}
                <View style={profileStyles.settingsSection}>
                  {/* Brand Name */}
          <View>
                    <Text style={[profileStyles.settingsSectionTitle, { marginBottom: 8 }]}>Brand name</Text>
            <TextInput
                      value={brandName}
                      onChangeText={setBrandName}
                      placeholder="Enter your brand name"
                      placeholderTextColor="#94a3b8"
                      style={profileStyles.settingsInput}
                    />
                  </View>

                  {/* Cuisine Type */}
                  <View>
                    <Text style={[profileStyles.settingsSectionTitle, { marginBottom: 8 }]}>Cuisine type</Text>
                    <TouchableOpacity
                      onPress={() => setShowCuisineModal(true)}
                      style={[profileStyles.settingsInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    >
                      <Text style={{ color: cuisineType.length > 0 ? '#101828' : '#94a3b8', fontFamily: theme.typography.fontFamily.body }}>
                        {cuisineType.length > 0 ? cuisineType.join(', ') : 'Select cuisine types...'}
                      </Text>
                      <Text style={{ color: '#94a3b8', fontFamily: theme.typography.fontFamily.body }}>▼</Text>
                    </TouchableOpacity>
                    {cuisineType.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setCuisineType([])}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                      >
                        <Text style={{ color: theme.colors.primary, fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.body }}>
                          Clear selection
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={profileStyles.nameRow}>
                  <View style={profileStyles.nameField}>
                    <Text style={profileStyles.settingsSectionTitle}>First name</Text>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Enter your first name"
                      placeholderTextColor="#94a3b8"
                      style={profileStyles.settingsInput}
                    />
                  </View>
                  <View style={profileStyles.nameField}>
                    <Text style={profileStyles.settingsSectionTitle}>Last name</Text>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Enter your last name"
                      placeholderTextColor="#94a3b8"
                      style={profileStyles.settingsInput}
                    />
                  </View>
                </View>

                {/* Brief Description */}
                <View style={profileStyles.settingsSection}>
                  <Text style={[profileStyles.settingsSectionTitle, { marginBottom: 8 }]}>Brief description</Text>
                  <TextInput
                    value={briefDescription}
                    onChangeText={setBriefDescription}
                    placeholder="Tell us about yourself"
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={[profileStyles.settingsInput, { minHeight: 80 }]}
                  />
                </View>

                <View style={profileStyles.settingsSection}>
                  <Text style={profileStyles.settingsSectionTitle}>Email</Text>
                  <TextInput
                    value={email}
                    editable={false}
                    style={[profileStyles.settingsInput, profileStyles.settingsInputReadOnly]}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* Phone */}
                <View style={profileStyles.settingsSection}>
                  <Text style={[profileStyles.settingsSectionTitle, { marginBottom: 8 }]}>Phone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    style={profileStyles.settingsInput}
                  />
                </View>

                {/* Pickup Days & Time */}
                <View style={profileStyles.settingsSection}>
                  <Text style={[profileStyles.settingsSectionTitle, { marginBottom: 8 }]}>Pickup days & time</Text>
                  <TouchableOpacity
                    onPress={() => setShowPickupModal(true)}
                    style={[profileStyles.settingsInput, { marginBottom: 8 }]}
                  >
                    <Text style={{ color: theme.colors.primary, fontFamily: theme.typography.fontFamily.body }}>+ Add pickup slot</Text>
                  </TouchableOpacity>
                  {pickupAvailability.length > 0 && (
                    <View style={{ gap: 8 }}>
                      {(() => {
                        const slotsByDay: { [day: string]: string[] } = {};
                        pickupAvailability.forEach(slot => {
                          if (!slotsByDay[slot.day]) {
                            slotsByDay[slot.day] = [];
                          }
                          slotsByDay[slot.day].push(slot.timeWindow);
                        });
                        return Object.entries(slotsByDay).map(([day, timeWindows]) => (
                          <View key={day} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#F9FAFB', borderRadius: 6 }}>
                            <Text style={{ color: '#101828', fontSize: 14, flex: 1, fontFamily: theme.typography.fontFamily.body }}>
                              {day}: {timeWindows.join(', ')}
                            </Text>
                            <TouchableOpacity onPress={() => handleRemovePickupSlot(day)}>
                              <Text style={{ color: '#B91C1C', fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        ));
                      })()}
                    </View>
                  )}
                </View>

                <View style={profileStyles.settingsSection}>
                  <Text style={profileStyles.settingsSectionTitle}>Pickup location</Text>
                  <LocationPicker
                    value={location}
                    onChange={setLocation}
                    placeholder="Search for your location..."
                    style={profileStyles.locationPicker}
                  />
                  <Text style={profileStyles.settingsHint}>Only available to customers after order confirmation</Text>
                </View>

                {/* Terms and Agreements Section */}
                <View style={[profileStyles.settingsSection, { paddingTop: theme.spacing.xl, borderTopWidth: 1, borderTopColor: '#EAECF0' }]}>
                  <Text style={[profileStyles.settingsSectionTitle, { fontSize: 18, marginBottom: 12 }]}>Food safety & payout acknowledgement</Text>
                  <Text style={{ color: '#667085', fontSize: 14, marginBottom: 12, fontFamily: theme.typography.fontFamily.body }}>
                    You're responsible for preparation.{"\n"}
                    We securely handle payments.
                  </Text>
                  
                  <View style={{ gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                    <TouchableOpacity onPress={() => {
                      setTermsType('agreement');
                      setShowTermsModal(true);
                    }}>
                      <Text style={{ color: theme.colors.primary, fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Chef Participation Agreement</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setTermsType('payout');
                      setShowTermsModal(true);
                    }}>
                      <Text style={{ color: theme.colors.primary, fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Payouts & Payments</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setTermsType('fee');
                      setShowTermsModal(true);
                    }}>
                      <Text style={{ color: theme.colors.primary, fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Fee Schedule</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>I'll clearly list ingredients & allergens</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>I'll prepare food safely and responsibly</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>The platform doesn't inspect food</Text>
                    </View>
                  </View>
                </View>

                <View style={profileStyles.actionButtons}>
                  <TouchableOpacity
                    style={profileStyles.logoutButtonProfile}
                    onPress={handleLogout}
                  >
                    <Text style={profileStyles.logoutButtonText}>Logout</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={profileStyles.deleteButton}
                    onPress={handleDeactivateChefAccount}
                  >
                    <Text style={profileStyles.deleteButtonText}>Deactivate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Cuisine Type Modal */}
      <Modal
        visible={showCuisineModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowCuisineModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
              style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#101828', fontFamily: theme.typography.fontFamily.body }}>Select cuisine types</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {cuisineTypes.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine}
                  onPress={() => {
                    if (cuisineType.includes(cuisine)) {
                      setCuisineType(cuisineType.filter(c => c !== cuisine));
                    } else {
                      setCuisineType([...cuisineType, cuisine]);
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#EAECF0',
                  }}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: theme.colors.primary,
                    backgroundColor: cuisineType.includes(cuisine) ? theme.colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {cuisineType.includes(cuisine) && (
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>✓</Text>
                    )}
                  </View>
                  <Text style={{ color: '#101828', fontSize: 16, fontFamily: theme.typography.fontFamily.body }}>{cuisine}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowCuisineModal(false)}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                backgroundColor: theme.colors.primary,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, fontFamily: theme.typography.fontFamily.body }}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Pickup Availability Modal */}
      <Modal
        visible={showPickupModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPickupModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowPickupModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#101828', fontFamily: theme.typography.fontFamily.body }}>Add pickup slot</Text>
            
            <Text style={{ color: '#667085', fontSize: 14, fontWeight: '700', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {daysOfWeek.map((day) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selectedDay === day ? theme.colors.primary : '#E5E7EB',
                      backgroundColor: selectedDay === day ? theme.colors.primary + '20' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ 
                      color: selectedDay === day ? theme.colors.primary : '#101828', 
                      fontSize: 14, 
                      fontWeight: selectedDay === day ? '700' : '400',
                      fontFamily: theme.typography.fontFamily.body,
                    }}>{day.slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
          </View>
            </ScrollView>

            <Text style={{ color: '#667085', fontSize: 14, fontWeight: '700', marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>Time windows</Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
              {timeWindows.map((tw) => (
                <TouchableOpacity
                  key={tw}
                  onPress={() => {
                    if (selectedTimeWindows.includes(tw)) {
                      setSelectedTimeWindows(selectedTimeWindows.filter(t => t !== tw));
                    } else {
                      setSelectedTimeWindows([...selectedTimeWindows, tw]);
                    }
                  }}
              style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#EAECF0',
                  }}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: theme.colors.primary,
                    backgroundColor: selectedTimeWindows.includes(tw) ? theme.colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {selectedTimeWindows.includes(tw) && (
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>✓</Text>
                    )}
                  </View>
                  <Text style={{ color: '#101828', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>{tw}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowPickupModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 8,
                  alignItems: 'center',
                borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Text style={{ color: '#101828', fontWeight: '700', fontSize: 16, fontFamily: theme.typography.fontFamily.body }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddPickupSlot}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: theme.colors.primary,
                borderRadius: 8,
                  alignItems: 'center',
              }}
            >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, fontFamily: theme.typography.fontFamily.body }}>Add</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Terms and Agreements Modal */}
      <Modal
        visible={showTermsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowTermsModal(false);
          setTermsType(null);
        }}
      >
          <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => {
            setShowTermsModal(false);
            setTermsType(null);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#101828', fontFamily: theme.typography.fontFamily.body }}>
                {termsType === 'agreement' && 'Chef Participation Agreement'}
                {termsType === 'fee' && 'Fee Schedule'}
                {termsType === 'payout' && 'Payouts & Payments'}
            </Text>
              <TouchableOpacity onPress={() => {
                setShowTermsModal(false);
                setTermsType(null);
              }}>
                <Text style={{ fontSize: 24, color: '#667085', fontFamily: theme.typography.fontFamily.body }}>✕</Text>
          </TouchableOpacity>
        </View>
            <ScrollView style={{ maxHeight: Platform.OS === 'web' ? 500 : 400 }}>
              {termsType === 'agreement' && (
                <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>{`
PARTICIPATION AGREEMENT
(Marketplace Platform – Ontario, Canada)

This Home Chef Participation Agreement ("Agreement") governs your access to and use of the YourHomeChef marketplace platform. By creating a chef account, listing meals, or accepting orders on the Platform, you agree to be bound by this Agreement.

1. Purpose & Relationship of the Parties

1.1 The Platform operates an online marketplace that facilitates connections between independent food preparers ("Chefs") and customers seeking prepared meals.
1.2 The Chef acts solely as an independent contractor and is not an employee, partner, joint venturer, agent, or representative of the Platform.
1.3 The Platform does not prepare, cook, package, or handle food, and does not control the methods, ingredients, or preparation of food beyond general marketplace requirements for safety and compliance.

2. Compliance With Laws & Food Safety

2.1 The Chef acknowledges and agrees that they are solely responsible for complying at all times with all applicable federal, provincial, and municipal laws, regulations, and guidelines.
2.2 The Platform does not inspect, verify, or approve kitchens or food preparation methods. The Chef is solely responsible for the location, equipment, and preparation of food.
2.3 The Platform may suspend or terminate the Chef's access immediately if it believes the Chef is operating in violation of any applicable law.

3. Food Handler Certification

3.1 Food safety certifications may or may not be held by Chefs. The Platform does not verify or require certifications for listing meals.
3.2 The Chef acknowledges that compliance with local laws and safety practices is their responsibility.
3.3 Failure to follow applicable laws or unsafe practices may result in suspension or removal from the Platform.

4. Kitchen & Preparation Requirements

4.1 By listing meals on the Platform, the Chef confirms responsibility for:

• Kitchen cleanliness
• Ingredient sourcing
• Allergen disclosure
• Packaging and labeling accuracy

4.2 The Chef acknowledges that Platform approval does not constitute an inspection or endorsement of the Chef's kitchen or food preparation standards.

5. Quality, Safety & Incident Reporting

5.1 The Chef agrees to promptly notify the Platform of:

• Any customer complaint related to food safety, illness, contamination, or allergens
• Any incident that may pose a risk to customer health or platform reputation

5.2 The Platform reserves the right to:

• Temporarily suspend listings
• Remove the Chef from the Platform
• Require corrective action prior to reinstatement

6. Indemnification & Liability Allocation

6.1 Indemnification by Chef.
To the fullest extent permitted by law, the Chef agrees to indemnify, defend, and hold harmless the Platform, its directors, officers, employees, contractors, and affiliates from and against any and all claims, demands, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising out of or related to (1) Foodborne illness, contamination, or injury caused by food prepared by the Chef (2) The Chef's negligence, recklessness, or misconduct (3) The Chef's failure to comply with applicable food safety or health regulations (4) Misrepresentation of ingredients, allergens, or preparation methods
6.2 The Chef acknowledges that this indemnification obligation survives termination of this Agreement.
6.3 The Platform does not waive any consumer rights under applicable law and does not limit liability where such limitation would be unlawful.

7. Insurance (Optional)

7.1 The Platform may recommend that the Chef maintain product liability or commercial general liability insurance.
7.2 Proof of insurance may be requested at the Platform's discretion.
7.3 Failure to maintain insurance will not automatically restrict access, but may be considered as part of broader risk or compliance reviews.

8. Payments & Fees

8.1 By using the Platform, the Chef authorizes the Platform to facilitate payment collection on the Chef's behalf through a third-party payment processor, currently Stripe Payments Canada, Ltd. ("Payment Processor"). By using the Platform, the Chef agrees to be bound by the Payment Processor's applicable terms, policies, and requirements, as amended from time to time.
8.2 Platform Commission & Fees
The Platform charges the Chef a commission on each completed order processed through the Platform.

• The current commission rate is 10% of the order subtotal, exclusive of applicable taxes, delivery fees, or payment processor fees.
• YourHomeChef absorbs all standard payment processing fees. No payment processing fees are deducted from the Chef's earnings.
• The Platform may update commission rates or fees upon reasonable notice through the Platform interface or a published Fee Schedule.
• Continued use of the Platform after notice of updated fees constitutes acceptance of those changes.

8.3 Payout Methodology
Subject to this Agreement and Payment Processor requirements:

• Net payouts (order amount minus applicable commissions, refunds, or adjustments) will be disbursed to the Chef's designated bank account (which may delay the first payout by up to 7–14 days)
  • Verification, dispute resolution, or compliance reviews.
  • Payouts are initiated on a weekly basis, subject to:
    • Payment Processor settlement timelines
    • Initial account verification and risk reviews
• The Platform does not guarantee payout timing and is not responsible for delays caused by banking institutions or the Payment Processor.

8.4 Holding Periods
The Platform may apply short holding periods on funds to manage:

• Customer disputes or chargebacks
• Refund requests
• Suspected fraud or policy violations
• Food safety or regulatory investigations

Funds may be withheld, offset, or adjusted until the matter is resolved.
8.5 Refunds, Disputes & Chargebacks

• The Platform may issue refunds to customers at its discretion in cases of:
  • Food safety concerns
  • Misrepresentation of ingredients or allergens
  • Order cancellation or failure to fulfill
• Refunded amounts, including associated fees, may be deducted from the Chef's pending or future payouts.
• Chargebacks initiated by customers may result in:
• Temporary payout suspension
• Additional administrative fees
• Account review or termination in repeated cases

8.6 Taxes
The Chef acknowledges and agrees that they are solely responsible for:

• Reporting and remitting all applicable taxes, including HST/GST, income tax, and any local levies
• Determining whether tax registration is required under applicable law

The Platform does not provide tax advice and does not assume tax liability on behalf of the Chef.

9. Termination

9.1 Either the Platform or the Chef may terminate participation with 90 days' notice through the Platform or in writing.
9.2 The Platform may terminate or suspend the Chef immediately, without notice, in cases of:

• Suspected food safety violations
• Customer health complaints
• Regulatory non-compliance
• Reputational risk to the Platform

9.3 Upon termination, the Chef must cease using the Platform and remove references to affiliation.

10. Confidentiality

10.1 The Chef agrees not to disclose non-public Platform information, including customer data, pricing algorithms, or operational materials.

11. Governing Law

11.1 This Agreement is governed by the laws of the Province of Ontario, Canada, without regard to conflict of laws principles.

12. Payment Processor Limitation of Liability

The Platform is not responsible for the acts, omissions, errors, service interruptions, or failures of any third-party payment processor. The Chef acknowledges that payment services are provided directly by the Payment Processor and are subject to its terms and risk controls.

13. Entire Agreement & Amendments

13.1 This Agreement constitutes the entire agreement between the Parties.
13.2 The Platform may update this Agreement from time to time. Continued use of the Platform after notice of updates constitutes acceptance.

By clicking "I Agree," creating a chef account, listing meals, or accepting orders on the Platform, you confirm that you have read, understood, and agreed to this Agreement.

APPENDIX A — Regulatory Compliance & Platform Adaptability

A1. Regulatory Landscape
Food preparation, sale, and delivery may be subject to evolving laws and guidelines, including but not limited to:

• Provincial health regulations
• Municipal bylaws
• Food safety standards
• Marketplace or platform regulations

A2. Platform Adaptation Rights
The Platform reserves the right to:

• Update safety requirements
• Introduce verification steps
• Require additional disclosures
• Modify onboarding or listing requirements

These changes may be implemented to comply with:

• Legal obligations
• Public health directives
• Risk management best practices

A3. Chef Cooperation
The Chef agrees to:

• Promptly comply with new requirements
• Provide requested information or documentation
• Acknowledge updated policies within the Platform

Failure to comply may result in:

• Temporary suspension
• Removal of listings
• Termination of access

A4. No Retroactive Liability
Updates or new requirements do not create retroactive liability for past activity that was compliant at the time.

A5. Acceptance Through Continued Use
Continued use of the Platform after notice of compliance updates constitutes acceptance of those changes.
                `}</Text>)}
              {termsType === 'fee' && (
                <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>{`
Fee Schedule - YourHomeChef
Last Updated: February 28, 2026

This Fee Schedule explains how fees and payouts work on the YourHomeChef platform. By using the Platform as a Chef, you agree to this Fee Schedule.

Platform Commission (Accepted by Use)

• A 10% platform commission is charged on each completed order
• Calculated on the order subtotal (before taxes and delivery fees)

Payment Processing Fees

Payments are processed through a third-party payment processor, currently Stripe.

• YourHomeChef absorbs all standard payment processing fees.
• No payment processing fees are deducted from your earnings.
• Rates are set by Stripe and may change independently

Net Earnings

You receive:

• Order subtotal minus platform commission, refunds, and applicable adjustments

Payout Timing (Estimated)

• Payouts are issued on a weekly schedule.
• Your first payout may be delayed 7–14 days for account verification and risk review.
• After funds are released, they typically arrive within 2–7 business days depending on bank processing times.
• Timing depends on:
  • Stripe settlement timelines
  • Bank processing
  • Account verification or dispute reviews

Refunds & Adjustments

If a refund or adjustment is issued due to:

• Food safety concerns
• Order issues
• Misrepresentation (ingredients, allergens, availability)

The refunded amount (and related fees) may be deducted from pending or future payouts.

No Guarantees

YourHomeChef makes no guarantees regarding sales volume, income, or order frequency.

Fee Updates

Fees may be updated from time to time with reasonable notice. Continued use of the Platform after such notice constitutes acceptance of the updated Fee Schedule.

Questions?

For questions, contact support at thereforyou.yhc@gmail.com
                `}</Text>)}
              {termsType === 'payout' && (
                <>
                  <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>{`
How payouts work
(Accepted by using the Platform)

This section explains how payouts are calculated and processed.

Customer places an order

• Customer pays through the app
• You receive an order notification

You prepare the meal

• You fulfill the order as listed
• You are responsible for accurate ingredient and allergen disclosures

The payment is processed

• Platform commission (10%) is applied
• YourHomeChef absorbs all standard payment processing fees.

A short review or holding period may apply

Funds may be temporarily held for:

• Refunds
• Disputes
• Safety or compliance checks

(This helps manage disputes, refunds, and compliance risks.)

Payouts are initiated weekly

• Payouts are initiated weekly, subject to processor and bank timelines.
• Your first payout may be delayed 7–14 days due to account verification and risk review.
• Net earnings (after platform commission, refunds, and adjustments) are sent to your designated bank account.
• You'll see a full payout breakdown in your dashboard

Your dashboard will show
`}</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>Order totals</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>Fees & deductions</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>Refunds (if any)</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={require('../../../assets/success.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary }} resizeMode="contain" />
                      <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>Payout status</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#101828', fontSize: 14, lineHeight: 22, fontFamily: theme.typography.fontFamily.body }}>{`

No subscriptions. No long-term commitments. Continued use of the Platform confirms acceptance of this payout process.
`}</Text>
                </>
              )}
    </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {profileSaveMsg && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setProfileSaveMsg(null)}>
          <View style={profileStyles.floatingToastOverlay} pointerEvents="box-none">
            <View style={profileStyles.profileSaveBanner}>
              <Image source={require('../../../assets/success.png')} style={{ width: 24, height: 24 }} tintColor={theme.colors.primary} />
              <Text style={profileStyles.profileSaveBannerText}>{profileSaveMsg}</Text>
            </View>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

const profileStyles = StyleSheet.create({
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
    ...(Platform.OS === 'web' ? { minWidth: 0, overflow: 'hidden' as const } : {}),
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
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
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
  navText: {
    color: '#101828',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    fontFamily: theme.typography.fontFamily.body,
  },
  navTextActive: {
    color: '#FFFFFF',
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
    fontFamily: theme.typography.fontFamily.body,
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F2F0EF',
    ...(Platform.OS === 'web' ? { overflow: 'hidden' as const } : {}),
  },
  header: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  floatingToastOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 48,
    paddingHorizontal: 16,
    alignItems: 'stretch',
  },
  profileSaveBanner: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  profileSaveBannerText: {
    color: theme.colors.primary,
    fontWeight: '700',
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing['2xl'],
  },
  tab: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    letterSpacing: 0.015,
    fontFamily: theme.typography.fontFamily.body,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  ordersList: {
    flex: 1,
  },
  ordersListContent: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
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
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderButtonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  orderButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.body,
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
    padding: theme.spacing.md,
    ...(Platform.OS === 'web' ? { width: '100%', maxWidth: '100%', minWidth: 0 } : {}),
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing['2xl'],
    ...(Platform.OS === 'web' ? { width: '100%', maxWidth: '100%', minWidth: 0 } : {}),
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
  chefLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  chefLogoContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  settingsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
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
  locationPicker: {
    marginTop: 0,
  },
  settingsHint: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs / 2,
    fontFamily: theme.typography.fontFamily.body,
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
    fontWeight: theme.typography.fontWeight.normal,
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  logoutButtonProfile: {
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
    fontWeight: theme.typography.fontWeight.normal,
    fontFamily: theme.typography.fontFamily.body,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E84343',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#E84343',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal,
    fontFamily: theme.typography.fontFamily.body,
  },
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
});
