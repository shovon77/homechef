import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { theme } from "../constants/theme";
import { Link } from "expo-router";
import { useResponsiveColumns } from "../utils/responsive";
import { useCart } from "../context/CartContext";
import { getChefById } from "../lib/db";

export default function CartScreen() {
  const { items, setQuantity, removeFromCart, clearCart, total, cartChefId } = useCart();
  const [loading, setLoading] = useState(false);
  const [chefName, setChefName] = useState<string | null>(null);
  const { width } = useResponsiveColumns();
  const isMobile = width < 768;

  const subtotal = total;

  // Load chef name if cartChefId exists
  useEffect(() => {
    if (cartChefId) {
      getChefById(cartChefId).then(chef => {
        if (chef) {
          setChefName(chef.name);
        }
      });
    } else {
      setChefName(null);
    }
  }, [cartChefId]);

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert("Cart is empty", "Please add items to your cart before checkout.");
      return;
    }

    setLoading(true);
    try {
      // Transform items to match API format (qty instead of quantity)
      const apiItems = items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        image: item.image,
      }));

      // Call the API to create a checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: apiItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = data.url;
        } else {
          Alert.alert("Checkout", "Please use the web version to complete checkout.");
        }
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert("Checkout Error", error.message || "Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text, marginBottom: 24 }}>Your Cart</Text>

        {/* Show chef name if cart has items from a chef */}
        {items.length > 0 && cartChefId && chefName && (
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, fontWeight: '700' }}>
              Order from:
            </Text>
            <Link href={{ pathname: "/chef/[id]", params: { id: String(cartChefId) } }} asChild>
              <TouchableOpacity>
                <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '900' }}>
                  {chefName}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}

        {items.length === 0 ? (
          <View style={{ 
            padding: 32, 
            backgroundColor: theme.colors.surface, 
            borderRadius: 16, 
            borderWidth: 1, 
            borderColor: "rgba(255,255,255,0.10)",
            alignItems: "center",
            gap: 16
          }}>
            <Text style={{ fontSize: 48 }}>🛒</Text>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "700" }}>Your cart is empty</Text>
            <Text style={{ color: theme.colors.muted, textAlign: "center" }}>Add some delicious dishes to get started!</Text>
          <Link href="/" asChild>
              <TouchableOpacity style={{ 
                marginTop: 8, 
                backgroundColor: theme.colors.primary, 
                paddingVertical: 12, 
                paddingHorizontal: 24, 
                borderRadius: 12,
                shadowColor: theme.colors.primary,
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 8,
                elevation: 5,
              }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Browse Dishes</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : (
          <>
            <View style={{ gap: 16, marginBottom: 24 }}>
              {items.map((it) => {
                const itemTotal = (it.price || 0) * it.quantity;
                return (
                  <View 
                    key={String(it.id)} 
                    style={{ 
                      backgroundColor: theme.colors.surface, 
                      borderRadius: 16, 
                      borderWidth: 1, 
                      borderColor: "rgba(255,255,255,0.10)", 
                      padding: isMobile ? 12 : 16, 
                      flexDirection: isMobile ? "column" : "row", 
                      gap: 16,
                      shadowColor: "#000",
                      shadowOpacity: 0.1,
                      shadowOffset: { width: 0, height: 2 },
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <Image 
                      source={{ uri: (it.image as string) || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=60&auto=format" }} 
                      style={{ width: isMobile ? 80 : 100, height: isMobile ? 80 : 100, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }} 
                    />
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={{ flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-start", gap: isMobile ? 8 : 0 }}>
            <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "900", color: theme.colors.text, fontSize: isMobile ? 16 : 18, marginBottom: 4 }}>
                            {it.name || "Item"}
                          </Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: isMobile ? 14 : 16, fontWeight: "700" }}>
                            ${typeof it.price === "number" ? it.price.toFixed(2) : "0.00"} each
                          </Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => removeFromCart(it.id)} 
                          style={{ 
                            backgroundColor: "rgba(229, 62, 62, 0.15)", 
                            paddingHorizontal: 12, 
                            paddingVertical: 6, 
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "rgba(229, 62, 62, 0.3)",
                            alignSelf: isMobile ? "flex-start" : "flex-start",
                          }}
                        >
                          <Text style={{ color: "#E53E3E", fontWeight: "800", fontSize: 12 }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={{ flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginTop: 8, gap: isMobile ? 12 : 0 }}>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 14, fontWeight: "700" }}>Quantity:</Text>
                          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                            <TouchableOpacity 
                              onPress={() => setQuantity(it.id, Math.max(0, it.quantity - 1))} 
                              style={{ 
                                backgroundColor: "rgba(255,255,255,0.1)", 
                                width: 36, 
                                height: 36, 
                                borderRadius: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.15)",
                              }}
                            >
                              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.colors.text }}>-</Text>
                            </TouchableOpacity>
                            <Text style={{ 
                              minWidth: 32, 
                              textAlign: "center", 
                              color: theme.colors.text, 
                              fontWeight: "900",
                              fontSize: 16 
                            }}>
                              {it.quantity}
                            </Text>
                            <TouchableOpacity 
                              onPress={() => setQuantity(it.id, it.quantity + 1)} 
                              style={{ 
                                backgroundColor: "rgba(255,255,255,0.1)", 
                                width: 36, 
                                height: 36, 
                                borderRadius: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.15)",
                              }}
                            >
                              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.colors.text }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: isMobile ? 16 : 18 }}>
                          ${itemTotal.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ 
              backgroundColor: theme.colors.surface, 
              borderRadius: 16, 
              borderWidth: 1, 
              borderColor: "rgba(255,255,255,0.10)", 
              padding: 24, 
              gap: 16,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 8,
              elevation: 3,
            }}>
              <View style={{ 
                flexDirection: "row", 
                justifyContent: "space-between", 
                alignItems: "center",
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.10)",
              }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 16, fontWeight: "700" }}>Subtotal</Text>
                <Text style={{ fontWeight: "900", color: theme.colors.text, fontSize: 24 }}>
                  ${subtotal.toFixed(2)}
                </Text>
              </View>
              
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                  onPress={handleCheckout} 
                  disabled={loading}
                  style={{ 
                    backgroundColor: loading ? "rgba(229, 57, 53, 0.6)" : theme.colors.primary, 
                    paddingVertical: 16, 
                    borderRadius: 12,
                    opacity: loading ? 0.7 : 1,
                    shadowColor: theme.colors.primary,
                    shadowOpacity: 0.4,
                    shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center", fontSize: 18 }}>
                    {loading ? "Processing..." : "Proceed to Checkout"}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => clearCart()} 
                  style={{ 
                    backgroundColor: "rgba(255,255,255,0.05)", 
                    paddingVertical: 12, 
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  <Text style={{ color: theme.colors.textMuted, fontWeight: "800", textAlign: "center", fontSize: 14 }}>
                    Clear Cart
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        <View style={{ height: 32 }} />
        </View>
    </ScrollView>
  );
}
