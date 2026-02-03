import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, Platform, Alert, TextInput, StyleSheet, useWindowDimensions, Modal, ActivityIndicator } from "react-native";
import { theme } from "../lib/theme";
import { Link } from "expo-router";
import { useResponsiveColumns } from "../utils/responsive";
import { useCart } from "../context/CartContext";
import { getChefById } from "../lib/db";
import { Screen } from "../components/Screen";
import { safeToFixed } from "../lib/number";
import { formatCad } from "../lib/money";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useRole } from "../hooks/useRole";
import { useLocationModal } from "../context/LocationModalContext";
import LocationPicker from "../components/LocationPicker";

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F2F0EF';
const BRAND_BLACK = '#33393A';
const TEXT_DARK = BRAND_BLACK;
const TEXT_MUTED = BRAND_BLACK;
const BORDER_COLOR = '#e7f3f0';
const BORDER_LIGHT = '#E5E7EB';

export default function CartScreen() {
  const router = useRouter();
  const { items, isReady, setQuantity, removeFromCart, total } = useCart();
  const { user, profile, refreshRole, hasProfileLocation } = useRole();
  const { setShowLocationModal: openNavbarLocationModal } = useLocationModal();
  const [chefNames, setChefNames] = useState<Map<number | null, string>>(new Map());
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [location, setLocation] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [manualInputLocation, setManualInputLocation] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [locationView, setLocationView] = useState<'default' | 'manual_form'>('default');
  const [streetAddress, setStreetAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const subtotal = total;

  // Refresh profile when cart page gains focus (e.g. after returning from profile page)
  useFocusEffect(
    useCallback(() => {
      refreshRole();
    }, [refreshRole])
  );

  // Load chef names for all items
  useEffect(() => {
    const chefIds = [...new Set(items.map(item => item.chef_id).filter(Boolean))];
    const namesMap = new Map<number | null, string>();
    
    Promise.all(
      chefIds.map(async (chefId) => {
        if (chefId) {
          const chef = await getChefById(Number(chefId));
          if (chef) {
            namesMap.set(chefId, chef.name);
          }
        }
      })
    ).then(() => {
      setChefNames(namesMap);
    });
  }, [items]);

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
      const { updateLocationWithCoordinates } = await import('../lib/updateLocation');
      const result = await updateLocationWithCoordinates(user.id, currentLocation.trim() || null);
      
      if (!result.ok) {
        throw new Error(result.error || "Failed to update location");
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
      const { updateLocationWithCoordinates } = await import('../lib/updateLocation');
      const result = await updateLocationWithCoordinates(user.id, selectedLocation.trim());
      
      if (!result.ok) {
        throw new Error(result.error || "Failed to update location");
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
      const { updateLocationWithCoordinates } = await import('../lib/updateLocation');
      const result = await updateLocationWithCoordinates(user.id, fullAddress);
      
      if (!result.ok) {
        throw new Error(result.error || "Failed to update location");
      }

      // Update all location-related state
      setLocation(fullAddress);
      setCurrentLocation(fullAddress);
      setManualInputLocation(fullAddress);
      
      // Refresh profile to update navbar immediately
      await refreshRole();
      
      // Close the modal
      setShowLocationModal(false);
      setLocationView('default');
      
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
              const { updateLocationWithCoordinates } = await import('../lib/updateLocation');
              const result = await updateLocationWithCoordinates(user.id, address);
              
              if (!result.ok) {
                console.error("Error auto-saving location:", result.error);
              } else {
                setLocation(address);
                setManualInputLocation(address);
                // Refresh profile to update navbar immediately
                await refreshRole();
              }
            } catch (saveErr: any) {
              console.error("Error auto-saving location:", saveErr);
            }
          }
          // Close modal on success
          setShowLocationModal(false);
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
            const { updateLocationWithCoordinates } = await import('../lib/updateLocation');
            const result = await updateLocationWithCoordinates(user.id, fallbackAddress);
            
            if (!result.ok) {
              console.error("Error auto-saving location:", result.error);
            } else {
              setLocation(fallbackAddress);
              setManualInputLocation(fallbackAddress);
              // Refresh profile to update navbar immediately
              await refreshRole();
            }
          } catch (saveErr: any) {
            console.error("Error auto-saving location:", saveErr);
          }
        }
        // Close modal on success
        setShowLocationModal(false);
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

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert("Cart is empty", "Please add items to your cart before checkout.");
      return;
    }

    if (!user) {
      router.push('/auth');
      return;
    }

    router.push('/checkout');
  };

  if (!isReady) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={{ flex: 1, paddingBottom: 0 }}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
        {/* Breadcrumbs - REMOVED */}
        {/* Page Heading - only show when cart has items */}
        {items.length > 0 && (
          <Text style={styles.pageTitle}>Cart summary</Text>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <View style={styles.emptyCartIcon}>
              <Image
                source={require('../assets/shopping-cart.png')}
                style={styles.emptyCartImage}
                tintColor={PRIMARY_COLOR}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <View style={styles.emptyCartButtons}>
              <TouchableOpacity
                style={styles.emptyCartButton}
                onPress={() => router.push('/browse?tab=dishes')}
              >
                <Text style={styles.emptyCartButtonText}>Discover homemade meals</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.emptyCartSubtext}>Pickup from local chefs nearby</Text>
            <View style={styles.emptyCartFooterContainer}>
              {user && !hasProfileLocation && (
                <TouchableOpacity
                  style={styles.setLocationButton}
                  onPress={() => openNavbarLocationModal(true)}
                >
                  <Text style={styles.setLocationButtonText}>Set location to find chefs near you</Text>
                </TouchableOpacity>
              )}
            </View>

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
        ) : (
          <View style={[styles.desktopLayout, isMobile && styles.mobileLayout]}>
            {/* Cart Items Column */}
            <View style={styles.cartItemsColumn}>
              <View style={styles.cartItemsList}>
                {items.map((item) => {
                  const chefName = item.chef_id ? chefNames.get(item.chef_id) : null;
                  const itemPrice = formatCad(item.price);
                  
                  return (
                    <View key={String(item.id)} style={styles.cartItem}>
                      <View style={styles.cartItemContent}>
                        <View style={styles.cartItemLeft}>
                          <Link href={`/dish/${item.id}?quantity=${item.quantity}`} asChild>
                            <TouchableOpacity>
                          <Image
                            source={{ uri: (item.image as string) || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=60" }}
                            style={styles.cartItemImage}
                            resizeMode="cover"
                          />
                            </TouchableOpacity>
                          </Link>
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemName}>{item.name || "Item"}</Text>
                            {chefName && (
                              <Text style={styles.cartItemChef}>{chefName}</Text>
                            )}
                            <Text style={styles.cartItemPriceInline}>{itemPrice}</Text>
                            {!!item.notes?.trim() && (
                              <Text
                                style={styles.cartItemNotes}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                Notes: {item.notes.trim()}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.cartItemQtyBar}>
                        <View style={styles.cartItemQtySlotLeft}>
                          <TouchableOpacity
                            style={[
                              styles.quantityIconButton,
                              item.quantity <= 0 && styles.quantityIconButtonDisabled,
                            ]}
                            onPress={() => setQuantity(item.id, Math.max(0, item.quantity - 1))}
                            disabled={item.quantity <= 0}
                          >
                            <Image
                              source={require('../assets/minus.png')}
                              style={styles.quantityIconImage as any}
                              tintColor={PRIMARY_COLOR}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.cartItemQtySlotCenter}>
                          <Text style={styles.cartItemQtyText}>{String(item.quantity)}</Text>
                        </View>
                        <View style={styles.cartItemQtySlotRight}>
                          <TouchableOpacity
                            style={styles.quantityIconButton}
                            onPress={() => setQuantity(item.id, item.quantity + 1)}
                          >
                            <Image
                              source={require('../assets/add (1).png')}
                              style={styles.quantityIconImage as any}
                              tintColor={PRIMARY_COLOR}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Order Summary Column */}
            <View style={[styles.orderSummaryColumn, isMobile && styles.orderSummaryColumnMobile]}>
              <View style={styles.orderSummaryCard}>
                <View style={styles.orderSummaryDetails}>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Subtotal</Text>
                    <Text style={styles.orderSummaryValue}>{formatCad(subtotal)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.checkoutButton, items.length === 0 && styles.checkoutButtonDisabled]}
                  onPress={handleCheckout}
                  disabled={items.length === 0}
                >
                  <Text style={styles.checkoutButtonText}>
                    Checkout
                  </Text>
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
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.md,
    }),
    paddingTop: theme.spacing['2xl'],
    // Extra bottom space so the footer doesn't overlap the last content.
    // The global `Screen` footer is pulled up with a negative margin.
    paddingBottom: 100,
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.black as any,
    fontFamily: 'OpenSans_700Bold',
    lineHeight: 24 * 1.2,
    letterSpacing: -0.033,
    marginBottom: theme.spacing.md,
  },
  mobileLayout: {
    flexDirection: 'column',
    gap: theme.spacing['2xl'],
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  cartItemsColumn: {
    width: Platform.select({ web: 400, default: '100%' }),
  },
  cartItemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  cartItem: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  cartItemContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  cartItemLeft: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    flex: 1,
  },
  cartItemImage: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: '#f0f0f0',
  },
  cartItemInfo: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: theme.spacing.xs / 2,
  },
  cartItemName: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemChef: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemPriceInline: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemNotes: {
    color: TEXT_DARK,
    opacity: 0.72,
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
    lineHeight: 18,
  },
  cartItemQtyBar: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemQtySlotLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  cartItemQtySlotCenter: {
    flex: 1,
    alignItems: 'center',
  },
  cartItemQtySlotRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cartItemQtyText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    fontFamily: 'OpenSans_400Regular',
  },
  // cartItemPriceDesktop removed (price now displayed under chef name)
  quantityIconButton: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityIconButtonDisabled: {
    opacity: 0.35,
  },
  quantityIconImage: {
    width: 16,
    height: 16,
  },
  deleteButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  deleteIcon: {
    fontSize: 20,
  },
  orderSummaryColumn: {
    width: Platform.select({ web: 400, default: '100%' }),
  },
  orderSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 96,
      },
    }),
  },
  orderSummaryTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  orderSummaryDetails: {
    gap: theme.spacing.md,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderSummaryLabel: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
  },
  orderSummaryDivider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: theme.spacing.xs,
  },
  orderSummaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSummaryTotalLabel: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  orderSummaryTotalValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  checkoutButton: {
    alignSelf: 'center',
    minWidth: 200,
    maxWidth: 300,
    height: 48,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: BORDER_COLOR,
    borderRadius: theme.radius.lg,
    minHeight: 280,
  },
  emptyCartIcon: {
    backgroundColor: 'transparent',
    borderRadius: 9999,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  emptyCartImage: {
    width: 64,
    height: 64,
  },
  emptyCartTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: 48,
    fontFamily: 'OpenSans_700Bold',
  },
  emptyCartText: {
    color: TEXT_DARK,
    fontWeight: 'normal',
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontFamily: 'OpenSans_400Regular',
  },
  emptyCartButtons: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  emptyCartButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    height: 48,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    maxWidth: 300,
  },
  emptyCartButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  emptyCartSubtext: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  setLocationButton: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  setLocationButtonText: {
    color: BRAND_BLACK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
  },
  emptyCartFooterContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  emptyCartFooterLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'nowrap',
  },
  emptyCartFooterIcon: {
    width: 16,
    height: 16,
  },
  emptyCartFooterText: {
    color: '#33393A',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'OpenSans_400Regular',
    fontWeight: 'normal',
    lineHeight: 16 * 1.5,
    flexShrink: 1,
  },
  emptyCartFooterLink: {
    textDecorationLine: 'underline',
    textDecorationColor: PRIMARY_COLOR,
    color: TEXT_DARK,
    ...Platform.select({
      web: {
        textUnderlineOffset: 3,
      },
      default: {},
    }),
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
    fontFamily: 'OpenSans_700Bold',
    color: TEXT_DARK,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    color: TEXT_DARK,
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
    color: TEXT_DARK,
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
    color: TEXT_DARK,
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
  modalHint: {
    fontSize: theme.typography.fontSize.sm,
    color: TEXT_DARK,
    fontFamily: 'OpenSans_400Regular',
    marginTop: theme.spacing.xs,
  },
  modalFooter: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    gap: theme.spacing.md,
  },
  manualFormContainer: {
    gap: theme.spacing.lg,
  },
  inputGroup: {
    gap: theme.spacing.sm,
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
    color: TEXT_DARK,
    paddingLeft: 16,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    fontFamily: 'OpenSans_400Regular',
    color: TEXT_DARK,
    backgroundColor: '#FFFFFF',
  },
  showFoodButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    minWidth: 200,
    maxWidth: 250,
    height: 48,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  showFoodButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  useCurrentLocationLink: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  useCurrentLocationLinkText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: 'OpenSans_400Regular',
    textDecorationLine: 'underline',
  },
  manualEntryButton: {
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
  manualEntryButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  dontAllowButtonLink: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'transparent',
  },
  dontAllowButtonLinkText: {
    color: TEXT_DARK,
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
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  // Mobile Styles
  containerMobile: {
    paddingHorizontal: theme.spacing.md,
  },
});
