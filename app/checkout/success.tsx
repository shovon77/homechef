import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCart } from "../../context/CartContext";
import { theme } from "../../lib/theme";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function CheckoutSuccess() {
  const router = useRouter();
  const { session_id, orderId } = useLocalSearchParams<{ session_id?: string; orderId?: string }>();
  const { clearCart } = useCart();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    // Only clear cart if payment is actually confirmed
    if (!cleared && (session_id || orderId)) {
      (async () => {
        // Try to verify payment status from order if orderId is available
        if (orderId) {
          const orderIdNum = Number(orderId);
          if (Number.isFinite(orderIdNum)) {
            const { data: order } = await supabase
              .from('orders')
              .select('payment_status')
              .eq('id', orderIdNum)
              .maybeSingle();
            
            if (order?.payment_status === 'succeeded') {
              clearCart();
              setCleared(true);
              return;
            }
          }
        }
        
        // If we have a session_id, assume payment succeeded (Stripe redirects here on success)
        if (session_id) {
          clearCart();
          setCleared(true);
        }
      })();
    }
  }, [session_id, orderId, cleared, clearCart]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F2F0EF' }} contentContainerStyle={{ padding: 16, alignItems: "center", justifyContent: "center", minHeight: "100%" }}>
      <View style={{ maxWidth: 500, width: "100%", gap: 16 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6", padding: 24, alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text, textAlign: "center", fontFamily: theme.typography.fontFamily.display }}>
            Payment Successful!
          </Text>
          <Text style={{ color: theme.colors.secondary, textAlign: "center", marginTop: 8, fontFamily: theme.typography.fontFamily.body }}>
            Thank you for your order. Your payment has been processed successfully.
          </Text>
          {session_id && (
            <Text style={{ color: "#9aa4af", fontSize: 12, marginTop: 8, fontFamily: theme.typography.fontFamily.body }}>
              Session ID: {session_id}
            </Text>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Link href="/" asChild>
            <TouchableOpacity style={{ backgroundColor: theme.colors.primary, padding: 14, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center", fontFamily: theme.typography.fontFamily.body }}>Continue Shopping</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/dishes" asChild>
            <TouchableOpacity style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
              <Text style={{ color: theme.colors.white, fontWeight: "800", textAlign: "center", fontFamily: theme.typography.fontFamily.body }}>Browse More Dishes</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

