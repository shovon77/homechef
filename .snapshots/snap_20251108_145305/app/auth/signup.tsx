import React from "react";
import { View, Text, ScrollView } from "react-native";
import { theme } from "../../constants/theme";
export default function SignUp() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text }}>Sign up</Text>
      <Text style={{ marginTop: 8, color: theme.colors.secondary }}>Auth UI coming soon.</Text>
    </ScrollView>
  );
}
