import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import "../styles/global.css";
import NavBar from "./components/NavBar";
import { theme } from "../constants/theme";
import { CartProvider } from "../context/CartContext";

export default function RootLayout() {
  return (
    <CartProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <NavBar />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </View>
    </CartProvider>
  );
}
