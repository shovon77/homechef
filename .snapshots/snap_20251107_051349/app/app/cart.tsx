import React from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { useCart } from "../context/CartContext";
import { theme } from "../constants/theme";
import { Link } from "expo-router";

export default function CartScreen() {
  const cart = useCart();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text, marginBottom: 8 }}>Your cart</Text>

      {cart.items.length === 0 ? (
        <View style={{ padding: 16, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6" }}>
          <Text style={{ color: theme.colors.secondary }}>Your cart is empty.</Text>
          <Link href="/" asChild>
            <TouchableOpacity style={{ marginTop: 10, backgroundColor: theme.colors.primary, padding: 10, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Browse dishes</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : (
        cart.items.map((it) => (
          <View key={String(it.id)} style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6", padding: 12, flexDirection: "row", gap: 12 }}>
            <Image source={{ uri: (it.image as string) || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=60&auto=format" }} style={{ width: 72, height: 72, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: theme.colors.text }}>{it.name}</Text>
              <Text style={{ color: theme.colors.secondary }}>${typeof it.price === "number" ? it.price.toFixed(2) : it.price}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => cart.setQty(it.id, Math.max(0, it.qty - 1))} style={{ backgroundColor: "#E5E7EB", paddingHorizontal: 10, borderRadius: 8 }}>
                  <Text>-</Text>
                </TouchableOpacity>
                <Text style={{ alignSelf: "center" }}>{it.qty}</Text>
                <TouchableOpacity onPress={() => cart.setQty(it.id, it.qty + 1)} style={{ backgroundColor: "#E5E7EB", paddingHorizontal: 10, borderRadius: 8 }}>
                  <Text>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => cart.remove(it.id)} style={{ alignSelf: "center", backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: "#991B1B", fontWeight: "800" }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {cart.items.length > 0 && (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6", padding: 16, gap: 10 }}>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>Total: ${cart.total.toFixed(2)}</Text>
          <TouchableOpacity onPress={() => cart.clear()} style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}>Checkout (stub)</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
