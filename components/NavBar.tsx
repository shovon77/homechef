// components/NavBar.tsx
'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native'
import { Link, useRouter, usePathname, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'
import { useLocationModal } from '../context/LocationModalContext'
import { NAVBAR_HEIGHT } from '../constants/layout'
import { theme } from '../lib/theme'
import { getProfile } from '../lib/db'
import LocationPicker from './LocationPicker'

// Web-only imports for animations
let motion: any = null;
let Compass: any = null;
let Menu: any = null;
let X: any = null;
if (Platform.OS === 'web') {
  try {
    motion = require('framer-motion');
    const lucide = require('lucide-react');
    Compass = lucide.Compass;
    Menu = lucide.Menu;
    X = lucide.X;
  } catch (e) {
    // Fallback if not available
  }
}

// Colors matching homepage and navbar design
const PRIMARY_COLOR = '#FE734C';
const BG_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const BORDER_LIGHT = '#E5E7EB';
const MAXW = 1280; // max-w-7xl

// Generic NavButton component with animation support
function NavButton({ href, label, isActive, icon: Icon }: { href: string, label: string, isActive: boolean, icon?: any }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const activeColor = '#FE734C'; // Updated brand color

  // Web version with framer-motion animations
  if (Platform.OS === 'web' && motion) {
    const MotionDiv = motion.div;
    
    // Merge all styles into single objects - NO arrays for DOM elements
    const linkStyle = { textDecoration: 'none', outline: 'none' };
    const containerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isMobile ? '4px' : '8px',
      paddingInline: isMobile ? '8px' : '16px',
      paddingBlock: '8px',
      borderRadius: '8px',
      position: 'relative',
      backgroundColor: isActive ? activeColor : 'transparent',
      cursor: 'pointer',
    };
    const textStyle = {
      fontWeight: isActive ? '700' : '600',
      color: isActive ? '#FFFFFF' : TEXT_DARK,
      fontFamily: theme.typography.fontFamily.body,
      fontSize: '14px',
    };
    
    return (
      <Link href={href} style={linkStyle as any} aria-current={isActive ? 'page' : undefined} role="link">
        <MotionDiv
          initial={false}
          whileHover={{ scale: 1.05 }}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          style={containerStyle}
        >
          {Icon && <Icon size={18} strokeWidth={2.2} color={isActive ? '#FFFFFF' : TEXT_DARK} />}
          <span style={textStyle}>{label}</span>
        </MotionDiv>
      </Link>
    );
  }

  // Native fallback (regular link) - style arrays are OK for React Native components
  return (
    <Link href={href} asChild>
      <TouchableOpacity 
        style={StyleSheet.flatten([
          styles.navLink,
          isMobile && { paddingHorizontal: 8, paddingVertical: 8 },
          isActive && { backgroundColor: activeColor, borderRadius: 8 }
        ])}
      >
        <Text style={StyleSheet.flatten([
          styles.navLinkText, 
          isActive && { color: '#FFFFFF', fontWeight: '700' as any }
        ])}>
          {label}
        </Text>
      </TouchableOpacity>
    </Link>
  );
}

export default function NavBar() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isMobile = width < 768
  const { isAdmin, isChef, user, profile, refreshRole } = useRole()
  const { items } = useCart()
  const { showLocationModal, setShowLocationModal } = useLocationModal()
  const params = useLocalSearchParams<{ id?: string; type?: string }>()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const pathname = usePathname?.() || '';
  const isExploreActive = pathname.startsWith('/browse') || pathname.startsWith('/explore');
  const isOrderActive = pathname.startsWith('/orders') && !pathname.includes('/thank-you');
  // Hide Order button on tracking page EXCEPT when viewing history (rejected/cancelled) orders
  const isOnOrderTrackingPage = pathname.startsWith('/orders/track') && params.type !== 'history';
  const isDashboardActive = pathname.startsWith('/admin') || pathname.startsWith('/chef');
  const isAuthPage = pathname.startsWith('/auth') || pathname.startsWith('/login');
  const isCartPage = pathname.startsWith('/cart');
  const isCheckoutPage = pathname.startsWith('/checkout');
  const isChefSignupPage = pathname.startsWith('/auth/chef');
  const isHomePage = pathname === '/' || pathname === '/index';
  const isFaqPage = pathname.startsWith('/faq');
  
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [hasReadyOrder, setHasReadyOrder] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [locationView, setLocationView] = useState<'default' | 'manual_form'>('default')
  const [location, setLocation] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [manualInputLocation, setManualInputLocation] = useState("")
  
  // Manual form state
  const [streetAddress, setStreetAddress] = useState("")
  const [postalCode, setPostalCode] = useState("")

  const [savingLocation, setSavingLocation] = useState(false)
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState("")

  // Native Icon Fallbacks - memoized to prevent re-renders and blinking
  const MenuIcon = useMemo(() => (
    <Image 
      source={require('../assets/menu.png')} 
      style={{ width: 24, height: 24, tintColor: '#FE734C' }} 
      resizeMode="contain" 
    />
  ), [])
  
  const CloseIcon = useMemo(() => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '-45deg' }] }} />
    </View>
  ), [])

  // Check for active orders - runs when user changes and subscribes to real-time updates
  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function checkActiveOrders() {
      if (!user?.id) {
        if (mounted) {
          setHasActiveOrder(false)
          setHasReadyOrder(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status')
          .eq('user_id', user.id)
          .in('status', ['requested', 'pending', 'ready', 'paid'])
        if (mounted && !error) {
          const statuses = (data ?? []).map((row: any) => row.status)
          setHasActiveOrder(statuses.length > 0)
          setHasReadyOrder(statuses.includes('ready'))
        } else if (mounted) {
          setHasActiveOrder(false)
          setHasReadyOrder(false)
        }
      } catch (err) {
        if (mounted) {
          setHasActiveOrder(false)
          setHasReadyOrder(false)
        }
      }
    }

    // Initial check
    checkActiveOrders()

    // Subscribe to order changes for real-time updates
    if (user?.id) {
      channel = supabase
        .channel(`navbar-orders-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Re-check active orders when any order changes
            checkActiveOrders()
          }
        )
        .subscribe()
    }

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id])

  // Load current location
  useEffect(() => {
    if (user) {
      loadLocation();
    }
  }, [user]);

  // Sync location state when profile location changes
  useEffect(() => {
    if (profile?.location) {
      setLocation(profile.location);
    }
  }, [profile?.location]);

  // Load location when modal opens
  useEffect(() => {
    if (showLocationModal && user) {
      loadLocation();
      setLocationView('default');
      setStreetAddress("");
      setPostalCode("");
    }
  }, [showLocationModal, user]);

  function loadLocation() {
    if (!user || !profile) return;
    
    const savedLocation = profile.location || "";
    setLocation(savedLocation);
    setCurrentLocation(savedLocation);
    // Initialize manual input with current location so it shows in the picker
    setManualInputLocation(savedLocation);
    
    // Clear any selected location when modal opens
    setSelectedLocation("");
  }

  async function handleSaveLocation() {
    if (!user) {
      Alert.alert("Error", "Please log in to set your location.");
      return;
    }

    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ location: currentLocation.trim() || null })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message || "Failed to update location");
      }

      setLocation(currentLocation);
      
      // Refresh profile to update navbar immediately
      await refreshRole();
      
      setShowLocationModal(false);
      Alert.alert("Success", "Location updated successfully!");
    } catch (e: any) {
      console.error("Error saving location:", e);
      Alert.alert("Error", e.message || "Failed to save location. Please try again.");
    } finally {
      setSavingLocation(false);
    }
  }

  function handleLocationChange(value: string) {
    const trimmedValue = value.trim();
    
    // Always update manual input to keep LocationPicker in sync
    setManualInputLocation(value);
    
    // When a location is selected from dropdown, the LocationPicker calls this function.
    // We treat any non-empty value as a valid selection to show the Save button.
    if (trimmedValue) {
      setSelectedLocation(trimmedValue);
      setCurrentLocation(trimmedValue);
    } else {
      // Input cleared
      setSelectedLocation("");
      setCurrentLocation("");
    }
  }

  async function handleSaveSelectedLocation() {
    if (!user || !selectedLocation.trim()) {
      Alert.alert("Error", "Please select a location first.");
      return;
    }

    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ location: selectedLocation.trim() })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message || "Failed to update location");
      }

      // Update all location states after successful save
      setLocation(selectedLocation.trim());
      setCurrentLocation(selectedLocation.trim());
      setManualInputLocation(selectedLocation.trim());
      setSelectedLocation(""); // Clear selected location after save
      
      // Refresh profile to update navbar immediately
      await refreshRole();
      
      Alert.alert("Success", "Location saved successfully!");
    } catch (e: any) {
      console.error("Error saving location:", e);
      Alert.alert("Error", e.message || "Failed to save location. Please try again.");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handlePlaceSelect(placeId: string, description: string) {
    console.log('handlePlaceSelect called with:', { placeId, description });
    
    // Update street address immediately
    setStreetAddress(description);
    
    // Try to extract postal code - first try regex, then geocoding
    try {
      // First, try to extract postal code from description using improved regex patterns
      // Canadian postal code: A1A 1A1 or A1A1A1
      // US ZIP code: 12345 or 12345-6789
      // UK postcode: SW1A 1AA or SW1A1AA
      const patterns = [
        /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i,  // Canadian: A1A 1A1
        /\b(\d{5}(-\d{4})?)\b/,              // US: 12345 or 12345-6789
        /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i, // UK: SW1A 1AA
      ];
      
      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          const extractedPostalCode = match[1].toUpperCase().replace(/\s/g, '');
          console.log('Extracted postal code from description:', extractedPostalCode);
          setPostalCode(extractedPostalCode);
          return;
        }
      }
      
      // If not found in description, try geocoding to get full address components
      console.log('Postal code not in description, trying geocoding for:', description);
      
      try {
        // Use forward geocoding to get coordinates
        const { data: geoData, error: geoError } = await supabase.functions.invoke('google-geocode-forward', {
          body: { address: description },
        });

        if (geoError) {
          console.error('Geocoding error:', geoError);
          // Don't set postal code to empty, let user enter manually
          return;
        }

        if (geoData?.lat && geoData?.lng) {
          // Use reverse geocoding to get full address components with postal code
          const { data: reverseGeoData, error: reverseGeoError } = await supabase.functions.invoke('google-geocode', {
            body: { lat: geoData.lat, lng: geoData.lng },
          });

        if (!reverseGeoError && reverseGeoData?.results && reverseGeoData.results.length > 0) {
            const addressComponents = reverseGeoData.results[0].address_components || [];
            console.log('Address components from reverse geocoding:', addressComponents);
            
            // Look for postal_code in address components
            const postalCodeComponent = addressComponents.find(
              (component: any) => component.types && component.types.includes('postal_code')
            );
            
            if (postalCodeComponent) {
              const postalCode = postalCodeComponent.long_name || postalCodeComponent.short_name || "";
              console.log('Found postal code from geocoding:', postalCode);
              setPostalCode(postalCode);
              return;
            }
          }
        }
      } catch (geoErr) {
        console.error('Geocoding function error:', geoErr);
        // If geocoding fails, postal code will remain empty for manual entry
      }
      
      // If all methods fail, leave postal code empty (user can enter manually)
      console.log('No postal code found using any method');
    } catch (err) {
      console.error("Error getting postal code:", err);
    }
  }

  function handleStreetAddressChange(value: string) {
    // Only update if the value is different to avoid unnecessary re-renders
    // This prevents clearing the value when onPlaceSelect updates it
    if (value !== streetAddress) {
      setStreetAddress(value);
      // Only clear postal code if the address is being cleared or manually edited
      // Don't clear if it's being set from a place selection (that will be handled by handlePlaceSelect)
      if (!value.trim()) {
        setPostalCode("");
      }
      // Note: We don't clear postal code when value changes because handlePlaceSelect
      // will be called separately to update it when a place is selected
    }
  }

  async function handleSaveManualForm() {
    if (!user) {
      Alert.alert("Error", "Please log in to save your location.");
      return;
    }

    if (!streetAddress.trim()) {
      Alert.alert("Error", "Please enter a street address.");
      return;
    }

    const fullAddress = postalCode.trim() 
      ? `${streetAddress.trim()}, ${postalCode.trim()}`
      : streetAddress.trim();
    
    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ location: fullAddress })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message || "Failed to update location");
      }

      // Update all location-related state
      setLocation(fullAddress);
      setCurrentLocation(fullAddress);
      setManualInputLocation(fullAddress);
      
      // Refresh profile to update navbar immediately
      await refreshRole();
      
      // Close the modal
      setShowLocationModal(false);
      
      // Navigate to browse page with dishes tab and nearest sort
      router.push('/browse?tab=dishes&sort=nearest');
    } catch (e: any) {
      console.error("Error saving location:", e);
      Alert.alert("Error", e.message || "Failed to save location. Please try again.");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleEnableLocation() {
    if (!navigator.geolocation) {
      Alert.alert("Error", "Geolocation is not supported by your browser.");
      return;
    }

    setGettingLocation(true);
    try {
      // Get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode using Google Geocoding API via Supabase function
      try {
        const { data, error } = await supabase.functions.invoke('google-geocode', {
          body: { lat: latitude, lng: longitude },
        });

        if (error) {
          throw new Error(error.message || "Failed to get address");
        }

        if (data?.results && data.results.length > 0) {
          const address = data.results[0].formatted_address;
          setCurrentLocation(address);
          // Automatically save to user profile
          if (user) {
            try {
              const { error: saveError } = await supabase
                .from("profiles")
                .update({ location: address })
                .eq("id", user.id);
              
              if (saveError) {
                console.error("Error auto-saving location:", saveError);
                Alert.alert("Error", "Failed to save location. Please try again.");
              } else {
                setLocation(address);
                setCurrentLocation(address);
                // Refresh profile to update navbar immediately
                await refreshRole();
                setShowLocationModal(false);
                Alert.alert("Success", "Location detected and saved successfully!");
              }
            } catch (saveErr: any) {
              console.error("Error auto-saving location:", saveErr);
              Alert.alert("Error", "Failed to save location. Please try again.");
            }
          } else {
            Alert.alert("Success", "Location detected and saved successfully!");
          }
        } else {
          throw new Error("No address found for this location");
        }
      } catch (geocodeError: any) {
        // Fallback: use coordinates if geocoding fails
        console.error("Geocoding error:", geocodeError);
        const fallbackAddress = `${latitude}, ${longitude}`;
        setCurrentLocation(fallbackAddress);
        // Automatically save fallback address to user profile
        if (user) {
          try {
            const { error: saveError } = await supabase
              .from("profiles")
              .update({ location: fallbackAddress })
              .eq("id", user.id);
            
            if (saveError) {
              console.error("Error auto-saving location:", saveError);
              Alert.alert("Error", "Failed to save location. Please try again.");
            } else {
              setLocation(fallbackAddress);
              setCurrentLocation(fallbackAddress);
              // Refresh profile to update navbar immediately
              await refreshRole();
              setShowLocationModal(false);
              Alert.alert("Partial Success", "Location detected but couldn't get full address. You can edit it manually.");
            }
          } catch (saveErr: any) {
            console.error("Error auto-saving location:", saveErr);
            Alert.alert("Error", "Failed to save location. Please try again.");
          }
        } else {
          Alert.alert("Partial Success", "Location detected but couldn't get full address. You can edit it manually.");
        }
      }
    } catch (error: any) {
      console.error("Error getting location:", error);
      if (error.code === 1) {
        Alert.alert("Permission Denied", "Please enable location permissions in your browser settings.");
      } else if (error.code === 2) {
        Alert.alert("Error", "Unable to determine your location. Please try again.");
      } else if (error.code === 3) {
        Alert.alert("Timeout", "Location request timed out. Please try again.");
      } else {
        Alert.alert("Error", error.message || "Failed to get your location. Please try again.");
      }
    } finally {
      setGettingLocation(false);
    }
  }

  return (
    <View style={styles.header}>
      <View style={StyleSheet.flatten([styles.container, isMobile && styles.containerMobile])}>
        {/* Left Section: Logo */}
        <Link href="/" asChild>
          <TouchableOpacity 
            style={StyleSheet.flatten([styles.logoContainer, isMobile && styles.logoContainerMobile])}
            accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}
          >
            <Image 
              source={require('../assets/AppLogoFinal2026.png')}
              style={StyleSheet.flatten([styles.logoImage, isMobile && styles.logoImageMobile]) as any}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Link>

        {/* Center Section: Navigation */}
        {!isAuthPage && (
        <View style={StyleSheet.flatten([styles.navCenter, isMobile && styles.navCenterMobile])}>
          <NavButton href="/browse" label="Explore" isActive={isExploreActive} icon={Compass} />
            {!loggedIn && (
              <NavButton href="/auth" label="Sign-up" isActive={false} />
            )}
            {hasActiveOrder && !isOnOrderTrackingPage ? (
            <Link href="/orders/track" asChild>
                <TouchableOpacity style={StyleSheet.flatten([
                  styles.navLink, 
                  { flexDirection: 'row', alignItems: 'center', gap: 6 },
                  isOrderActive && { borderBottomWidth: 2, borderBottomColor: PRIMARY_COLOR }
                ])}>
                  <Text style={StyleSheet.flatten([
                    styles.navLinkText, 
                    { fontWeight: '700' as any },
                    isOrderActive && { color: PRIMARY_COLOR, fontWeight: '600' as any }
                  ])}>Order</Text>
                {hasReadyOrder ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR }} /> : null}
              </TouchableOpacity>
            </Link>
          ) : null}
            {/* Dashboard button: only show for admin or chef, but not on cart, checkout, or chef signup page */}
            {(isAdmin || isChef) && !isCartPage && !isCheckoutPage && !isChefSignupPage && (
            <NavButton 
              href={isAdmin ? '/admin' : '/chef'} 
              label={isAdmin ? (isMobile ? 'Admin' : 'Dashboard') : 'Sales'} 
              isActive={isDashboardActive} 
            />
          )}
            {/* Location button */}
            {loggedIn && (
              <TouchableOpacity 
                onPress={() => setShowLocationModal(true)}
                style={styles.locationNavButton}
              >
                <Image 
                  source={require('../assets/locationnewicon.png')} 
                  style={styles.locationNavIcon as any} 
                  resizeMode="contain" 
                />
                <Text style={styles.locationNavText} numberOfLines={1}>
                  {location ? (location.split(',')[1]?.trim() || location.split(',')[0]) : 'Location'}
                </Text>
              </TouchableOpacity>
          )}
        </View>
        )}

        {/* Right Section: Actions */}
        <View style={StyleSheet.flatten([styles.rightSection, isMobile && styles.rightSectionMobile])}>
          {!isFaqPage && (isAuthPage && !isChefSignupPage) ? (
            <Link href="/faq" asChild>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>FAQ</Text>
              </TouchableOpacity>
            </Link>
          ) : (
            <>
          {isMobile ? (
            <>
              {!(loggedIn && location) && (
                <NavButton href="/faq" label="FAQ" isActive={isFaqPage} />
              )}
              {!isChefSignupPage && (
              <Link href="/cart" asChild>
                <TouchableOpacity style={styles.cartButton}>
                  <Image 
                    source={require('../assets/shopping-cart.png')} 
                      style={styles.cartIconImage as any}
                    resizeMode="contain"
                  />
                  {cartQty > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartQty}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
              )}
              <TouchableOpacity 
                onPress={() => setIsMenuOpen(!isMenuOpen)}
                style={[styles.iconButton, { backgroundColor: 'transparent' }]}
                activeOpacity={0.7}
              >
                {isMenuOpen ? (
                  Platform.OS === 'web' && X ? <X color="#FE734C" size={24} /> : CloseIcon
                ) : (
                  MenuIcon
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  // Role-aware profile routing
                  if (isAdmin) {
                        router.push('/profile?tab=settings');
                  } else if (isChef) {
                        // Navigate to the Profile tab in the Chef Dashboard
                        router.push('/chef?tab=profile');
                  } else {
                    router.push('/profile?tab=settings');
                  }
                }}
                    style={styles.primaryButton}
              >
                  <Text style={[styles.primaryButtonText, { color: PRIMARY_COLOR }]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { 
                  let subscription: any = null;
                  let hasNavigated = false;
                  
                  const navigateToAuth = () => {
                    if (!hasNavigated) {
                      hasNavigated = true;
                      if (subscription) {
                        subscription.unsubscribe();
                      }
                      router.push('/auth');
                    }
                  };

                  // Set up a one-time listener for auth state change
                  const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_OUT' || !session) {
                      navigateToAuth();
                    }
                  });
                  subscription = sub;
                  
                  // Try to sign out - even if it fails (403), we'll still proceed
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
                  } catch (storageError) {
                    console.warn("Error clearing storage:", storageError);
                  }
                  
                  if (error) {
                    console.warn("SignOut error (proceeding anyway):", error);
                  }

                  // Fallback: Check session and navigate after delay
                  setTimeout(async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      navigateToAuth();
                    } else {
                      // Force navigation even if session exists
                      navigateToAuth();
                    }
                  }, 300);
                }}
                    style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
              <Link href="/auth" asChild>
                  <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Login / Sign-up</Text>
                </TouchableOpacity>
              </Link>
          )}

          <NavButton href="/faq" label="FAQ" isActive={isFaqPage} />
          {!isChefSignupPage && (
          <Link href="/cart" asChild>
            <TouchableOpacity style={styles.cartButton}>
              <Image 
                source={require('../assets/shopping-cart.png')} 
                  style={styles.cartIconImage as any}
                resizeMode="contain"
              />
              {cartQty > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartQty}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
          )}
            </>
          )}
            </>
          )}
        </View>
      </View>


      {/* Mobile Menu Overlay */}
      {isMobile && isMenuOpen && (
        <View style={styles.mobileMenu}>
          {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setIsMenuOpen(false);
                  if (isAdmin) {
                    router.push('/profile?tab=settings');
                  } else if (isChef) {
                    router.push('/chef?tab=profile');
                  } else {
                    router.push('/profile?tab=settings');
                  }
                }}
                style={styles.mobileMenuItem}
              >
                <Image source={require('../assets/user.png')} style={styles.menuIcon as any} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Profile</Text>
              </TouchableOpacity>
              
              {loggedIn && location && (
                <Link href="/faq" asChild>
                  <TouchableOpacity 
                    style={styles.mobileMenuItem}
                    onPress={() => setIsMenuOpen(false)}
                  >
                    <Image source={require('../assets/sitemap.png')} style={styles.menuIcon as any} resizeMode="contain" />
                    <Text style={styles.mobileMenuText}>FAQ</Text>
                  </TouchableOpacity>
                </Link>
              )}

              <TouchableOpacity
                onPress={async () => { 
                  setIsMenuOpen(false);
                  
                  let subscription: any = null;
                  let hasNavigated = false;
                  
                  const navigateToAuth = () => {
                    if (!hasNavigated) {
                      hasNavigated = true;
                      if (subscription) {
                        subscription.unsubscribe();
                      }
                      router.push('/auth');
                    }
                  };

                  // Set up a one-time listener for auth state change
                  const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_OUT' || !session) {
                      navigateToAuth();
                    }
                  });
                  subscription = sub;
                  
                  // Try to sign out - even if it fails (403), we'll still proceed
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
                  } catch (storageError) {
                    console.warn("Error clearing storage:", storageError);
                  }
                  
                  if (error) {
                    console.warn("SignOut error (proceeding anyway):", error);
                  }

                  // Fallback: Check session and navigate after delay
                  setTimeout(async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      navigateToAuth();
                    } else {
                      // Force navigation even if session exists
                      navigateToAuth();
                    }
                  }, 300);
                }}
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
              >
                <Image source={require('../assets/logout.png')} style={styles.menuIcon as any} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Link href="/auth" asChild>
              <TouchableOpacity 
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
                onPress={() => setIsMenuOpen(false)}
              >
                {/* Assuming user icon for login or could import another one */}
                 <Image source={require('../assets/user.png')} style={styles.menuIcon as any} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Login / Sign-up</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      )}

      {/* Location Modal */}
      <Modal
        visible={showLocationModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowLocationModal(false);
          setIsLocationInputFocused(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  {locationView === 'manual_form' ? 'Enter your location' : 'Find food near you!'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowLocationModal(false);
                  setIsLocationInputFocused(false);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalBody}
              contentContainerStyle={locationView === 'default' ? {} : styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {locationView === 'default' ? null : (
                <View style={styles.manualFormContainer}>
                  <View style={[styles.inputGroup, { zIndex: 10000 }]}>
                    <Text style={styles.inputLabel}>Street Address</Text>
                    <LocationPicker
                      value={streetAddress}
                      onChange={handleStreetAddressChange}
                      onPlaceSelect={handlePlaceSelect}
                      placeholder="Search for your address..."
                      style={[styles.locationPicker, { zIndex: 10000 }]}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Postal Code</Text>
                    <TextInput
                      style={styles.manualInput}
                      value={postalCode}
                      onChangeText={setPostalCode}
                      placeholder="Enter postal code"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  
                  <TouchableOpacity
                    style={styles.showFoodButton}
                    onPress={handleSaveManualForm}
                    disabled={savingLocation}
                  >
                     {savingLocation ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.showFoodButtonText}>Show food nearby</Text>
                      )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.useCurrentLocationLink}
                    onPress={handleEnableLocation}
                  >
                    <Text style={styles.useCurrentLocationLinkText}>Use my current location instead</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            {locationView === 'default' && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.enableLocationButton, gettingLocation && styles.enableLocationButtonDisabled]}
                  onPress={handleEnableLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.enableLocationButtonText}>Enable location</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualEntryButton}
                  onPress={() => setLocationView('manual_form')}
                >
                  <Text style={styles.manualEntryButtonText}>Enter location manually</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {locationView === 'default' && (
              <TouchableOpacity
                style={styles.dontAllowButtonLink}
                onPress={() => {
                  setShowLocationModal(false);
                  setIsLocationInputFocused(false);
                }}
              >
                <Text style={styles.dontAllowButtonLinkText}>Don't allow</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    ...Platform.select({
      web: {
        zIndex: 1000,
        backgroundColor: BG_LIGHT,
      },
      default: {
        backgroundColor: BG_LIGHT,
      },
    }),
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  container: {
    width: '100%',
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingLeft: 0,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 0,
    marginLeft: -80,
    paddingLeft: 0,
    paddingTop: 0,
    marginTop: 0,
  },
  logoImage: {
    width: 364,
    height: 73,
    backgroundColor: 'transparent',
  },
  navCenter: {
    ...Platform.select({
      web: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: [{ translateX: '-50%' }, { translateY: '-50%' }] as any,
        overflow: 'visible', // Ensure underline isn't clipped
        marginLeft: 0,
      },
      default: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 0,
      },
    }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_DARK,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  locationNavIcon: {
    width: 16,
    height: 16,
    tintColor: '#FE734C',
  },
  locationNavText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
    maxWidth: 70,
  },
  primaryButton: {
    minWidth: 84,
    maxWidth: 480,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.015,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  secondaryButton: {
    minWidth: 84,
    maxWidth: 480,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FE734C',
    borderWidth: 1,
    borderColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.015,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  cartButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconImage: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: BG_LIGHT,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  // Mobile styles
  containerMobile: {
    paddingRight: 8,
    paddingLeft: 0,
  },
  logoContainerMobile: {
    gap: 0,
    marginLeft: -80,
    paddingLeft: 0,
    alignItems: 'center',
    alignSelf: 'center',
    paddingTop: 0,
    marginTop: 0,
  },
  logoImageMobile: {
    width: 260,
    height: 52,
  },
  navCenterMobile: {
    position: 'absolute',
    left: '48%',
    top: 0,
    bottom: 0,
    transform: [{ translateX: '-50%' }],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    marginLeft: 0,
  },
  rightSectionMobile: {
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
  },
  faqButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE734C',
  },
  iconButtonImage: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
  },
  secondaryButtonMobile: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FE734C',
    borderWidth: 1,
    borderColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileMenu: {
    position: 'absolute',
    top: NAVBAR_HEIGHT,
    right: 0,
    width: 'auto',
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_LIGHT,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
      web: { boxShadow: '-4px 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    }),
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
  },
  mobileMenuText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
    textAlignVertical: 'center',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
    }),
  },
  mobileLocationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    gap: 4,
    width: '100%',
  },
  mobileLocationIcon: {
    width: 14,
    height: 14,
    tintColor: '#FE734C',
  },
  mobileLocationText: {
    fontSize: 12,
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
  },
  mobileLocationLink: {
    textDecorationLine: 'underline',
    color: PRIMARY_COLOR,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    flexDirection: 'column',
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
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_DARK,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    color: PRIMARY_COLOR,
    lineHeight: theme.typography.fontSize.sm * 1.4,
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
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  currentLocationContainer: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: 'transparent',
    borderRadius: theme.radius.lg,
  },
  currentLocationLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    color: '#33393A',
    marginBottom: theme.spacing.xs,
  },
  currentLocationText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    color: PRIMARY_COLOR,
    lineHeight: theme.typography.fontSize.base * 1.4,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    width: '100%',
  },
  enableLocationButtonDisabled: {
    opacity: 0.6,
  },
  enableLocationButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
  },
  locationInputTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_DARK,
    marginBottom: theme.spacing.sm,
    paddingLeft: 16,
  },
  manualEntryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  manualEntryButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
  },
  dontAllowButtonLink: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
  },
  dontAllowButtonLinkText: {
    color: '#9CA3AF',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600' as any,
    fontFamily: theme.typography.fontFamily.body,
  },
  manualFormContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: TEXT_DARK,
    backgroundColor: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  showFoodButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 24,
    minWidth: 200,
    maxWidth: 250,
  },
  showFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as any,
    fontFamily: theme.typography.fontFamily.display,
  },
  useCurrentLocationLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  useCurrentLocationLinkText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600' as any,
    fontFamily: theme.typography.fontFamily.body,
  },
  locationPicker: {
    marginBottom: theme.spacing.sm,
  },
  modalFooter: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    gap: theme.spacing.md,
  },
  dontAllowButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 150,
  },
  dontAllowButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
  },
  saveLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    flex: 1,
    minWidth: 150,
  },
  saveLocationButtonDisabled: {
    opacity: 0.6,
  },
  saveLocationButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
  },
})
