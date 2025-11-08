import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Link } from "expo-router";
import { theme } from "../constants/theme";

export default function ProfileScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text }}>Profile</Text>
      <Text style={{ color: theme.colors.secondary }}>You’re not logged in.</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Link href="/auth/login" asChild>
          <TouchableOpacity style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>Log in</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/auth/signup" asChild>
          <TouchableOpacity style={{ backgroundColor: "#111827", padding: 12, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>Sign up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}
