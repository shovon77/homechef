import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, Platform, Alert, TextInput, StyleSheet } from "react-native";
import { theme } from "../lib/theme";
import { Link } from "expo-router";
import { useResponsiveColumns } from "../utils/responsive";
import { useCart } from "../context/CartContext";
import { getChefById } from "../lib/db";
import { Screen } from "../components/Screen";
import { safeToFixed } from "../lib/number";
import { useRouter } from "expo-router";

// Colors from HTML design
const PRIMARY_COLOR = '#17cfa1';
const BACKGROUND_LIGHT = '#f8fcfb';
const TEXT_DARK = '#0e1b18';
const TEXT_MUTED = '#4e9785';
const BORDER_COLOR = '#e7f3f0';
const DELIVERY_FEE = 5.00;

export default function CartScreen() {
  const router = useRouter();
  const { items, setQuantity, removeFromCart, total } = useCart();
  const [chefNames, setChefNames] = useState<Map<number | null, string>>(new Map());
  const { width } = useResponsiveColumns();
  const isMobile = width < 1024;

  const subtotal = total;
  const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
  const totalWithDelivery = subtotal + deliveryFee;

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

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert("Cart is empty", "Please add items to your cart before checkout.");
      return;
    }

    router.push('/checkout');
  };

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.container}>
        {/* Breadcrumbs */}
        <View style={styles.breadcrumbs}>
          <Link href="/" asChild>
            <TouchableOpacity>
              <Text style={styles.breadcrumbLink}>Home</Text>
            </TouchableOpacity>
          </Link>
          <Text style={styles.breadcrumbSeparator}>/</Text>
          <Text style={styles.breadcrumbCurrent}>Cart</Text>
        </View>

        {/* Page Heading */}
        <Text style={styles.pageTitle}>Your Cart</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <View style={styles.emptyCartIcon}>
              <Text style={styles.emptyCartEmoji}>🛒</Text>
            </View>
            <Text style={styles.emptyCartTitle}>Your Cart is Empty</Text>
            <Text style={styles.emptyCartText}>
              Looks like you haven't added any dishes yet. Let's find something delicious!
            </Text>
            <Link href="/browse" asChild>
              <TouchableOpacity style={styles.emptyCartButton}>
                <Text style={styles.emptyCartButtonText}>Find a Meal</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <View style={isMobile ? styles.mobileLayout : styles.desktopLayout}>
            {/* Cart Items Column */}
            <View style={styles.cartItemsColumn}>
              <View style={styles.cartItemsList}>
                {items.map((item) => {
                  const chefName = item.chef_id ? chefNames.get(item.chef_id) : null;
                  const itemPrice = safeToFixed(item.price, 2, '0.00');
                  
                  return (
                    <View key={String(item.id)} style={styles.cartItem}>
                      <View style={styles.cartItemContent}>
                        <View style={styles.cartItemLeft}>
                          <Image
                            source={{ uri: (item.image as string) || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=60" }}
                            style={styles.cartItemImage}
                            resizeMode="cover"
                          />
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemName}>{item.name || "Item"}</Text>
                            {chefName && (
                              <Text style={styles.cartItemChef}>By {chefName}</Text>
                            )}
                            {isMobile && (
                              <Text style={styles.cartItemPriceMobile}>${itemPrice}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.cartItemRight}>
                          {!isMobile && (
                            <Text style={styles.cartItemPriceDesktop}>${itemPrice}</Text>
                          )}
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => setQuantity(item.id, Math.max(1, item.quantity - 1))}
                            >
                              <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={styles.quantityInput}
                              value={String(item.quantity)}
                              onChangeText={(text) => {
                                const qty = parseInt(text) || 1;
                                setQuantity(item.id, Math.max(1, qty));
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
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => removeFromCart(item.id)}
                            >
                              <Text style={styles.deleteIcon}>🗑️</Text>
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
            <View style={styles.orderSummaryColumn}>
              <View style={styles.orderSummaryCard}>
                <Text style={styles.orderSummaryTitle}>Order Summary</Text>
                <View style={styles.orderSummaryDetails}>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Subtotal</Text>
                    <Text style={styles.orderSummaryValue}>${safeToFixed(subtotal, 2, '0.00')}</Text>
                  </View>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Delivery Fee</Text>
                    <Text style={styles.orderSummaryValue}>${safeToFixed(deliveryFee, 2, '0.00')}</Text>
                  </View>
                </View>
                <View style={styles.orderSummaryDivider} />
                <View style={styles.orderSummaryTotal}>
                  <Text style={styles.orderSummaryTotalLabel}>Total</Text>
                  <Text style={styles.orderSummaryTotalValue}>${safeToFixed(totalWithDelivery, 2, '0.00')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.checkoutButton, items.length === 0 && styles.checkoutButtonDisabled]}
                  onPress={handleCheckout}
                  disabled={items.length === 0}
                >
                  <Text style={styles.checkoutButtonText}>
                    Proceed to Checkout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
      </ScrollView>
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
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  breadcrumbLink: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  breadcrumbSeparator: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  breadcrumbCurrent: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 36,
    fontWeight: theme.typography.fontWeight.black as any,
    lineHeight: 36 * 1.2,
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
    flex: 1,
    minWidth: 0,
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
    justifyContent: 'center',
    gap: theme.spacing.xs / 2,
  },
  cartItemName: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  cartItemChef: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal as any,
  },
  cartItemPriceMobile: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  cartItemRight: {
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  cartItemPriceDesktop: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
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
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  quantityInput: {
    width: 24,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
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
  },
  orderSummaryDetails: {
    gap: theme.spacing.md,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderSummaryLabel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
  },
  orderSummaryValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.base,
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
  },
  orderSummaryTotalValue: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  checkoutButton: {
    width: '100%',
    height: 48,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
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
    backgroundColor: BORDER_COLOR,
    borderRadius: 9999,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  emptyCartEmoji: {
    fontSize: 64,
  },
  emptyCartTitle: {
    color: TEXT_DARK,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: theme.spacing.sm,
  },
  emptyCartText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  emptyCartButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    height: 48,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
});
