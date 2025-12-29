import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, Platform, Alert, TextInput, StyleSheet, useWindowDimensions, Modal, ActivityIndicator } from "react-native";
import { theme } from "../lib/theme";
import { Link } from "expo-router";
import { useResponsiveColumns } from "../utils/responsive";
import { useCart } from "../context/CartContext";
import { getChefById, getProfile } from "../lib/db";
import { Screen } from "../components/Screen";
import { safeToFixed } from "../lib/number";
import { formatCad } from "../lib/money";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useRole } from "../hooks/useRole";
import LocationPicker from "../components/LocationPicker";

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const TEXT_MUTED = '#88B361';
const BORDER_COLOR = '#e7f3f0';

export default function CartScreen() {
  const router = useRouter();
  const { items, setQuantity, removeFromCart, total } = useCart();
  const { user } = useRole();
  const [chefNames, setChefNames] = useState<Map<number | null, string>>(new Map());
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [location, setLocation] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);

  const subtotal = total;

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

  async function loadLocation() {
    if (!user) return;
    try {
      const prof = await getProfile(user.id);
      if (prof) {
        setLocation(prof.location || "");
      }
    } catch (e: any) {
      console.error("Error loading location:", e);
    }
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
        .update({ location: location.trim() || null })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message || "Failed to update location");
      }

      setShowLocationModal(false);
      Alert.alert("Success", "Location updated successfully!");
    } catch (e: any) {
      console.error("Error saving location:", e);
      Alert.alert("Error", e.message || "Failed to save location. Please try again.");
    } finally {
      setSavingLocation(false);
    }
  }

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert("Cart is empty", "Please add items to your cart before checkout.");
      return;
    }

    router.push('/checkout');
  };

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={{ paddingBottom: 32 }}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
        {/* Breadcrumbs - REMOVED */}
        {/* Page Heading */}
        <Text style={styles.pageTitle}>Cart summary</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <View style={styles.emptyCartIcon}>
              <Image
                source={require('../assets/shopping-cart.png')}
                style={styles.emptyCartImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart if empty</Text>
            <Text style={styles.emptyCartText}>
              Find homemade meals near you
            </Text>
            <View style={styles.emptyCartButtons}>
              <Link href="/browse?tab=dishes" asChild>
                <TouchableOpacity style={styles.emptyCartButton}>
                  <Text style={styles.emptyCartButtonText}>Explore homemade meals</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/browse?tab=chefs" asChild>
                <TouchableOpacity style={styles.emptyCartButton}>
                  <Text style={styles.emptyCartButtonText}>Browse popular chefs</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <View style={styles.emptyCartFooterContainer}>
              <View style={styles.emptyCartFooterLine}>
                <TouchableOpacity onPress={() => {
                  if (user) {
                    setShowLocationModal(true);
                  } else {
                    Alert.alert("Login Required", "Please log in to set your location.");
                    router.push('/auth');
                  }
                }}>
                  <Text style={[styles.emptyCartFooterText, styles.emptyCartFooterLink]} numberOfLines={1}>
                    Set your location to find nearby chefs
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.emptyCartFooterText} numberOfLines={1}>
                All meals are prepared by independent chefs
              </Text>
            </View>

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
                    <Text style={styles.modalTitle}>Set Your Location</Text>
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
                    <LocationPicker
                      value={location}
                      onChange={setLocation}
                      placeholder="Search for your location..."
                      style={styles.locationPicker}
                      onFocus={() => setIsLocationInputFocused(true)}
                      onBlur={() => setIsLocationInputFocused(false)}
                    />
                    <Text style={styles.modalHint}>Select your location from the dropdown</Text>
                  </ScrollView>
                  {!isLocationInputFocused && (
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSecondary]}
                      onPress={() => {
                        setShowLocationModal(false);
                        setIsLocationInputFocused(false);
                      }}
                    >
                      <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonPrimary, savingLocation && styles.modalButtonDisabled]}
                      onPress={handleSaveLocation}
                      disabled={savingLocation}
                    >
                      {savingLocation ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalButtonTextPrimary}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
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
                              <Text style={styles.cartItemChef}>By {chefName}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.cartItemRight}>
                          <Text style={styles.cartItemPriceDesktop}>{itemPrice}</Text>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => setQuantity(item.id, item.quantity - 1)}
                            >
                              <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={styles.quantityInput}
                              value={String(item.quantity)}
                              onChangeText={(text) => {
                                const qty = parseInt(text) || 0;
                                setQuantity(item.id, Math.max(0, qty));
                              }}
                              keyboardType="numeric"
                              selectTextOnFocus
                            />
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => setQuantity(item.id, item.quantity + 1)}
                            >
                              <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
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
    paddingVertical: theme.spacing['2xl'],
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.black as any,
    fontFamily: 'OpenSans_700Bold',
    lineHeight: 24 * 1.2,
    letterSpacing: -0.033,
    marginBottom: theme.spacing['2xl'],
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
    justifyContent: 'space-between',
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
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  cartItemRight: {
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  cartItemPriceDesktop: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontFamily: 'OpenSans_400Regular',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BORDER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  quantityInput: {
    width: 24,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    fontFamily: 'OpenSans_400Regular',
    padding: 0,
    backgroundColor: 'transparent',
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
    color: PRIMARY_COLOR,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['4xl'],
    paddingHorizontal: theme.spacing['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: BORDER_COLOR,
    borderRadius: theme.radius.lg,
  },
  emptyCartIcon: {
    backgroundColor: 'transparent',
    borderRadius: 9999,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  emptyCartImage: {
    width: 64,
    height: 64,
    tintColor: PRIMARY_COLOR,
  },
  emptyCartTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: theme.spacing.sm,
    fontFamily: 'OpenSans_700Bold',
  },
  emptyCartText: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontFamily: 'OpenSans_700Bold',
  },
  emptyCartButtons: {
    flexDirection: 'column',
    gap: theme.spacing.md,
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
  emptyCartFooterContainer: {
    marginTop: theme.spacing.xl,
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
    tintColor: '#FE734C',
  },
  emptyCartFooterText: {
    color: '#33393A',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'OpenSans_700Bold',
    lineHeight: 16 * 1.5,
    flexShrink: 1,
  },
  emptyCartFooterLink: {
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
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
    color: TEXT_DARK,
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
    paddingBottom: theme.spacing['4xl'],
  },
  locationPicker: {
    marginBottom: theme.spacing.sm,
  },
  modalHint: {
    fontSize: theme.typography.fontSize.sm,
    color: PRIMARY_COLOR,
    fontFamily: 'OpenSans_400Regular',
    marginTop: theme.spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  modalButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: PRIMARY_COLOR,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: 'OpenSans_700Bold',
  },
  modalButtonTextSecondary: {
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
