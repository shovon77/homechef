import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";

// Supabase allowed redirect URLs needed:
// - Web: ${window.location.origin}/auth/callback (e.g., http://localhost:8081/auth/callback, https://yourdomain.com/auth/callback)
// - Native: homechef://auth/callback

export default function UserAuth() {
  const redirectTo = Platform.select({
    web: `${window.location.origin}/auth/callback`,
    default: "homechef://auth/callback",
  });

  const signIn = async (provider: "google" | "facebook") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo || undefined },
    });
    if (error) console.log("OAuth error:", error);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: "900", marginBottom: 16 }}>Sign up / Sign in</Text>
      <TouchableOpacity onPress={() => signIn("google")} style={{ backgroundColor: theme.colors.primary, padding: 14, borderRadius: 12, marginBottom: 12, width: 260, alignItems: "center" }}>
        <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => signIn("facebook")} style={{ backgroundColor: "#1877F2", padding: 14, borderRadius: 12, width: 260, alignItems: "center" }}>
        <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Continue with Facebook</Text>
      </TouchableOpacity>
      <Text style={{ color: "#9aa4af", marginTop: 12, fontSize: 12 }}>
        Configure providers in Supabase Auth → URL: {redirectTo}
      </Text>
    </View>
  );
}
