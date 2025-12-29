// components/NavBar.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { Link, useRouter, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'
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
    const MotionSpan = motion.span;
    
    // Merge all styles into single objects - NO arrays for DOM elements
    const linkStyle = { textDecoration: 'none', outline: 'none' };
    const containerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isMobile ? '4px' : '8px',
      paddingInline: isMobile ? '4px' : '10px',
      paddingBlock: '6px',
      borderRadius: '10px',
      position: 'relative',
      color: isActive ? activeColor : TEXT_DARK,
      cursor: 'pointer',
    };
    const textStyle = {
      fontWeight: '600',
      color: isActive ? activeColor : TEXT_DARK,
      fontFamily: theme.typography.fontFamily.body,
      fontSize: '14px',
    };
    const underlineStyle = {
      position: 'absolute',
      left: '8px',
      right: '8px',
      bottom: '-4px',
      height: '2.5px',
      borderRadius: '2px',
      background: 'linear-gradient(90deg, rgba(254,115,76,1) 0%, rgba(254,115,76,1) 100%)',
      pointerEvents: 'none' as const,
    };
    
    return (
      <Link href={href} style={linkStyle} aria-current={isActive ? 'page' : undefined} role="link">
        <MotionDiv
          initial={false}
          whileHover={{ scale: 1.05 }}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          style={containerStyle}
        >
          {Icon && <Icon size={18} strokeWidth={2.2} color={isActive ? activeColor : TEXT_DARK} />}
          <span style={textStyle}>{label}</span>
          <MotionSpan
            layoutId={`nav-underline-${label}`} // Unique layoutId per button
            initial={{ width: 0, opacity: 0, x: -8 }}
            animate={{
              width: isActive ? '100%' : '0%',
              opacity: isActive ? 1 : 0,
              x: 0,
            }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={underlineStyle}
          />
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
          isMobile && { paddingHorizontal: 4, paddingVertical: 4 },
          isActive && { borderBottomWidth: 2, borderBottomColor: activeColor }
        ])}
      >
        <Text style={StyleSheet.flatten([
          styles.navLinkText, 
          isActive && { color: activeColor, fontWeight: '600' }
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
  const { isAdmin, isChef, user, profile } = useRole()
  const { items } = useCart()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const pathname = usePathname?.() || '';
  const isExploreActive = pathname.startsWith('/browse') || pathname.startsWith('/explore');
  const isDashboardActive = pathname.startsWith('/admin') || pathname.startsWith('/chef');
  
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [hasReadyOrder, setHasReadyOrder] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [location, setLocation] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [manualInputLocation, setManualInputLocation] = useState("")
  const [savingLocation, setSavingLocation] = useState(false)
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState("")

  // Native Icon Fallbacks
  const MenuIcon = () => (
    <View style={{ width: 24, height: 24, justifyContent: 'space-around', paddingVertical: 4 }}>
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
    </View>
  )
  const CloseIcon = () => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '-45deg' }] }} />
    </View>
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
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
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Load current location
  useEffect(() => {
    if (user) {
      loadLocation();
    }
  }, [user]);

  // Load location when modal opens
  useEffect(() => {
    if (showLocationModal && user) {
      loadLocation();
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
      Alert.alert("Success", "Location saved successfully!");
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
              } else {
                setLocation(address);
              }
            } catch (saveErr: any) {
              console.error("Error auto-saving location:", saveErr);
            }
          }
          Alert.alert("Success", "Location detected and saved successfully!");
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
            } else {
              setLocation(fallbackAddress);
            }
          } catch (saveErr: any) {
            console.error("Error auto-saving location:", saveErr);
          }
        }
        Alert.alert("Partial Success", "Location detected but couldn't get full address. You can edit it manually.");
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
              source={require('../assets/HClogo2.png')}
              style={StyleSheet.flatten([styles.logoImage, isMobile && styles.logoImageMobile])}
              resizeMode="contain"
            />
            <Text style={StyleSheet.flatten([styles.logoText, isMobile && styles.logoTextMobile])}>
              <Text style={{ color: '#33393A' }}>Your</Text>
              <Text style={{ color: '#FE734C' }}>HomeChef</Text>
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Center Section: Navigation */}
        <View style={StyleSheet.flatten([styles.navCenter, isMobile && styles.navCenterMobile])}>
          <NavButton href="/browse" label="Explore" isActive={isExploreActive} icon={Compass} />
          {hasActiveOrder ? (
            <Link href="/orders/track" asChild>
              <TouchableOpacity style={StyleSheet.flatten([styles.navLink, { flexDirection: 'row', alignItems: 'center', gap: 6 }])}>
                <Text style={StyleSheet.flatten([styles.navLinkText, { fontWeight: '700' }])}>{isMobile ? '' : 'Track Order'}</Text>
                {hasReadyOrder ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR }} /> : null}
              </TouchableOpacity>
            </Link>
          ) : null}
          {/* Dashboard button: only show for admin or chef */}
          {(isAdmin || isChef) && (
            <NavButton 
              href={isAdmin ? '/admin' : '/chef'} 
              label={isAdmin ? (isMobile ? 'Dash' : 'Dashboard') : 'Sales'} 
              isActive={isDashboardActive} 
            />
          )}
        </View>

        {/* Right Section: Actions */}
        <View style={StyleSheet.flatten([styles.rightSection, isMobile && styles.rightSectionMobile])}>
          {isMobile ? (
            <>
              <Link href="/cart" asChild>
                <TouchableOpacity style={styles.cartButton}>
                  <Image 
                    source={require('../assets/shopping-cart.png')} 
                    style={styles.cartIconImage}
                    resizeMode="contain"
                  />
                  {cartQty > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartQty}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
              <TouchableOpacity 
                onPress={() => setIsMenuOpen(!isMenuOpen)}
                style={styles.iconButton}
              >
                {isMenuOpen ? (
                  Platform.OS === 'web' && X ? <X color="#FE734C" size={24} /> : <CloseIcon />
                ) : (
                  Platform.OS === 'web' && Menu ? <Menu color="#FE734C" size={24} /> : <MenuIcon />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {loggedIn ? (
                <TouchableOpacity 
                  onPress={() => setShowLocationModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 }}
                >
                  <Image 
                    source={require('../assets/placeholder.png')} 
                    style={{ width: 16, height: 16, tintColor: '#FE734C' }} 
                    resizeMode="contain" 
                  />
                  <Text style={{ 
                    fontSize: 14, 
                    color: PRIMARY_COLOR, 
                    fontFamily: theme.typography.fontFamily.body,
                    fontWeight: '500',
                    textDecorationLine: 'underline'
                  }}>
                    {profile?.location || "Set Location"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  // Role-aware profile routing
                  if (isAdmin) {
                        router.push('/profile');
                  } else if (isChef) {
                        // Navigate to the Profile tab in the Chef Dashboard
                        router.push('/chef?tab=profile');
                  } else {
                    router.push('/profile');
                  }
                }}
                    style={styles.primaryButton}
              >
                  <Text style={styles.primaryButtonText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { 
                  await supabase.auth.signOut(); 
                  router.push('/auth');
                }}
                    style={styles.secondaryButton}
              >
                  <Text style={styles.secondaryButtonText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
              <Link href="/auth" asChild>
                  <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Login</Text>
                </TouchableOpacity>
              </Link>
          )}

          <Link href="/cart" asChild>
            <TouchableOpacity style={styles.cartButton}>
              <Image 
                source={require('../assets/shopping-cart.png')} 
                style={styles.cartIconImage}
                resizeMode="contain"
              />
              {cartQty > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartQty}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
            </>
          )}
        </View>
      </View>

      {isMobile && loggedIn ? (
        <View style={styles.mobileLocationBar}>
          <Image 
            source={require('../assets/placeholder.png')} 
            style={styles.mobileLocationIcon} 
            resizeMode="contain" 
          />
          <TouchableOpacity onPress={() => setShowLocationModal(true)}>
            <Text style={[styles.mobileLocationText, styles.mobileLocationLink]} numberOfLines={1}>
              {profile?.location || "Set Location"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Mobile Menu Overlay */}
      {isMobile && isMenuOpen && (
        <View style={styles.mobileMenu}>
          {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setIsMenuOpen(false);
                  if (isAdmin) {
                    router.push('/profile');
                  } else if (isChef) {
                    router.push('/chef?tab=profile');
                  } else {
                    router.push('/profile');
                  }
                }}
                style={styles.mobileMenuItem}
              >
                <Image source={require('../assets/user.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Profile</Text>
              </TouchableOpacity>
              

              <TouchableOpacity
                onPress={async () => { 
                  setIsMenuOpen(false);
                  await supabase.auth.signOut(); 
                  router.push('/auth');
                }}
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
              >
                <Image source={require('../assets/logout.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={StyleSheet.flatten([styles.mobileMenuText, { color: '#FE734C' }])}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Link href="/auth" asChild>
              <TouchableOpacity 
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
                onPress={() => setIsMenuOpen(false)}
              >
                {/* Assuming user icon for login or could import another one */}
                 <Image source={require('../assets/user.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Login</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      )}

      {/* Location Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
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
                <Text style={styles.modalTitle}>Find food near you!</Text>
                <Text style={styles.modalSubtitle}>Your location helps show nearby chefs & pickups.</Text>
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
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {currentLocation ? (
                <View style={styles.currentLocationContainer}>
                  <Text style={styles.currentLocationLabel}>Current location:</Text>
                  <Text style={styles.currentLocationText}>{currentLocation}</Text>
                </View>
              ) : null}
              <Text style={styles.locationInputTitle}>Enter location manually</Text>
              <LocationPicker
                value={manualInputLocation || ""}
                onChange={handleLocationChange}
                placeholder="Search"
                style={styles.locationPicker}
                onFocus={() => setIsLocationInputFocused(true)}
                onBlur={() => setIsLocationInputFocused(false)}
              />
            </ScrollView>
            {(selectedLocation || !isLocationInputFocused) && (
              <View style={styles.modalFooter}>
                {selectedLocation ? (
                  <TouchableOpacity
                    style={[styles.saveLocationButton, savingLocation && styles.saveLocationButtonDisabled]}
                    onPress={handleSaveSelectedLocation}
                    disabled={savingLocation}
                  >
                    {savingLocation ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveLocationButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <>
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
                      style={styles.dontAllowButton}
                      onPress={() => {
                        setShowLocationModal(false);
                        setIsLocationInputFocused(false);
                      }}
                    >
                      <Text style={styles.dontAllowButtonText}>Don't allow</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
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
    borderBottomColor: '#FE734C',
  },
  container: {
    width: '100%',
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    tintColor: '#FE734C',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#33393A',
    letterSpacing: -0.015,
    lineHeight: 28,
    fontFamily: theme.typography.fontFamily.display,
  },
  navCenter: {
    ...Platform.select({
      web: {
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: '-50%' }],
        overflow: 'visible', // Ensure underline isn't clipped
      },
      default: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 8,
  },
  logoContainerMobile: {
    gap: 4,
    marginLeft: -4, // Pull logo slightly left
  },
  logoImageMobile: {
    width: 24,
    height: 24,
  },
  logoTextMobile: {
    fontSize: 14,
    lineHeight: 20,
  },
  navCenterMobile: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
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
    width: '50%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_LIGHT,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
      web: { boxShadow: '-4px 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    }),
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    fontFamily: 'OpenSans_700Bold',
    color: TEXT_DARK,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
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
    fontFamily: 'OpenSans_400Regular',
    color: '#33393A',
    marginBottom: theme.spacing.xs,
  },
  currentLocationText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
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
    flex: 1,
    minWidth: 150,
  },
  enableLocationButtonDisabled: {
    opacity: 0.6,
  },
  enableLocationButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  locationInputTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
    color: TEXT_DARK,
    marginBottom: theme.spacing.sm,
    paddingLeft: 16,
  },
  locationPicker: {
    marginBottom: theme.spacing.sm,
  },
  modalFooter: {
    flexDirection: 'row',
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
    fontFamily: 'OpenSans_700Bold',
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
    fontFamily: 'OpenSans_700Bold',
  },
})
