import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { Link } from "expo-router";

export default function Login() {
  const [email, setEmail] = useState("");

  const sendMagicLink = async () => {
    if (!email.includes("@")) return Alert.alert("Enter a valid email");
    
    const redirectTo = Platform.select({
      web: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      default: "homechef://auth/callback",
    });
    
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check your email", "We sent you a sign-in link.");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text, marginBottom: 12 }}>Log in</Text>
      <Text style={{ color: theme.colors.secondary, marginBottom: 20 }}>Use your email to receive a magic link.</Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#EEF2F6" }}>
        <TextInput
          placeholder="your@email.com"
          placeholderTextColor={theme.colors.muted}
          style={{ fontSize: 16, color: theme.colors.text }}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <TouchableOpacity onPress={sendMagicLink} style={{ marginTop: 14, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>Send magic link</Text>
      </TouchableOpacity>

      <Link href="/" asChild>
        <TouchableOpacity style={{ marginTop: 16, alignSelf: "center" }}>
          <Text style={{ color: theme.colors.secondary }}>← Back to home</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
