import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { theme } from "../../constants/theme";
import { cart } from "../../lib/cart";

const CONTAINER_MAX_WIDTH = 1200;

export default function NavBar() {
  const router = useRouter();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const updateCount = () => setItemCount(cart.get().length);
    updateCount();
    const interval = setInterval(updateCount, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ width:'100%', backgroundColor: theme.colors.surface, borderBottomWidth:1, borderBottomColor: theme.colors.border }}>
      <View style={{ width:'100%', maxWidth: MAXW, alignSelf:'center', paddingHorizontal:16, paddingVertical:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          {/* Brand */}
          <Link href="/" asChild>
            <TouchableOpacity accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}>
              <Text style={{ color: theme.colors.brandText, fontSize:18, fontWeight:'900', letterSpacing:0.2 }}>
                HomeChef
              </Text>
            </TouchableOpacity>
          </Link>

          {/* Middle: Links */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
            <Link href="/" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Home</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/dishes" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Browse</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/chefs" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Chefs</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Right: Auth + Cart */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Link href="/login" asChild>
              <TouchableOpacity style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Login</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/signup" asChild>
              <TouchableOpacity style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: theme.colors.primary,
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Sign up</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/cart" asChild>
              <TouchableOpacity style={{
                position: "relative",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 16 }}>🛒</Text>
                {itemCount > 0 && (
                  <View style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 11 }}>
                      {itemCount > 99 ? "99+" : itemCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  )
}
