import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { theme } from "../../constants/theme";
import { Link } from "expo-router";

export default function CheckoutCancel() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, alignItems: "center", justifyContent: "center", minHeight: "100%" }}>
      <View style={{ maxWidth: 500, width: "100%", gap: 16 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6", padding: 24, alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 48 }}>❌</Text>
          <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text, textAlign: "center" }}>
            Payment Cancelled
          </Text>
          <Text style={{ color: theme.colors.secondary, textAlign: "center", marginTop: 8 }}>
            Your checkout was cancelled. No charges were made. Your cart items are still saved.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Link href="/cart" asChild>
            <TouchableOpacity style={{ backgroundColor: theme.colors.primary, padding: 14, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}>Return to Cart</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/" asChild>
            <TouchableOpacity style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
              <Text style={{ color: theme.colors.white, fontWeight: "800", textAlign: "center" }}>Continue Shopping</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

