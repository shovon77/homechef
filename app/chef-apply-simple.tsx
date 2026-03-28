import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";
import { useRouter } from "expo-router";

export default function SignupChef() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (picked.canceled) return;
    const file = picked.assets[0];
    const uri = file.uri;
    const name = uri.split("/").pop() || ("chef-" + Date.now() + ".jpg");
    const path = `chefs/${name}`;
    const res = await fetch(uri);
    const blob = await res.blob();

    const { error: upErr } = await supabase
      .storage
      .from("public-assets")
      .upload(path, blob, { upsert: true, contentType: file.mimeType || "image/jpeg" });
    if (upErr) { Alert.alert("Upload failed", upErr.message); return; }

    const { data } = await supabase.storage.from("public-assets").getPublicUrl(path);
    setAvatarUrl(data?.publicUrl || null);
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert("Validation", "Name is required.");
    if (!email.trim()) return Alert.alert("Validation", "Email is required.");

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from("chefs")
        .insert({
          name,
          location: location || null,
          bio: bio || null,
          avatar: avatarUrl || null,
          email: email || null,
          phone: phone || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("Chef signup error:", error);
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Submitted!", "Your chef application was received.");
      // If you want to jump to the new chef profile when approved, keep them on home for now:
      router.push("/");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 20, gap: 12, maxWidth: 720, alignSelf: "center", width: "100%" }}>
        <Text style={{ color: theme.colors.white, fontSize: 24, fontWeight: "900" }}>
          Chef sign-up
        </Text>

        <TextInput
          placeholder="Full name *"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }}
        />
        <TextInput
          placeholder="Email *"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }}
        />
        <TextInput
          placeholder="Phone"
          placeholderTextColor="#94a3b8"
          keyboardType={Platform.OS === "web" ? "text" : "phone-pad"}
          value={phone}
          onChangeText={setPhone}
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }}
        />
        <TextInput
          placeholder="Location (e.g., Scarborough, ON)"
          placeholderTextColor="#94a3b8"
          value={location}
          onChangeText={setLocation}
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }}
        />
        <TextInput
          placeholder="Short bio"
          placeholderTextColor="#94a3b8"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10, minHeight: 90 }}
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={pickAvatar}
            style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 12, borderRadius: 10 }}
          >
            <Text style={{ color: "#e2e8f0", fontWeight: "700" }}>
              {avatarUrl ? "Change avatar" : "Upload avatar"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={submit}
            disabled={saving}
            style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10, opacity: saving ? 0.7 : 1 }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "800" }}>
              {saving ? "Submitting…" : "Submit application"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: "#9aa4af", marginTop: 6, fontSize: 12 }}>
          Storage bucket required: <Text style={{ fontWeight: "800" }}>public-assets</Text> (public).
        </Text>
      </View>
    </ScrollView>
  );
}
