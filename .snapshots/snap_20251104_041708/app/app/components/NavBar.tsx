import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { theme } from "../../constants/theme";

// Optional CartContext (won't crash if missing)
let useCart: any = () => ({ items: [] });
try { useCart = require("../../context/CartContext").useCart; } catch {}

const CONTAINER_MAX_WIDTH = 1200;

export default function NavBar() {
  const router = useRouter();
  const { items } = useCart();

  return (
    <View style={{
      width: "100%",
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      <View style={{
        width: "100%",
        maxWidth: CONTAINER_MAX_WIDTH,
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}>
        <View style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          {/* Left: Brand (text-only, no image) */}
          <Link href="/" asChild>
            <TouchableOpacity
              accessibilityRole={Platform.OS === "web" ? "link" : undefined}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{
                color: theme.colors.white,
                fontSize: 18,
                fontWeight: "900",
                letterSpacing: 0.2,
              }}>
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
            <Link href="/browse" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Browse</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/chefs" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Chefs</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/dishes" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Dishes</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Right: Auth + Cart */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800" }}>
                  Cart{items?.length ? ` (${items.length})` : ""}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

function linkBtnStyle() {
  return { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 } as const;
}
function linkTextStyle() {
  return { color: "#e5e7eb", fontWeight: "700" } as const;
}
