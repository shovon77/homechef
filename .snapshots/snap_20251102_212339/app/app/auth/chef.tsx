import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";

export default function ChefSignup() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { Alert.alert("Permission required"); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (picked.canceled) return;
    const file = picked.assets[0];
    const uri = file.uri;
    const name = uri.split("/").pop() || ("chef-" + Date.now() + ".jpg");
    const path = `chefs/${name}`;
    const res = await fetch(uri);
    const blob = await res.blob();
    const { error } = await supabase.storage.from("public-assets").upload(path, blob, { upsert: true, contentType: file.mimeType || "image/jpeg" });
    if (error) { Alert.alert("Upload failed", error.message); return; }
    const { data } = await supabase.storage.from("public-assets").getPublicUrl(path);
    setAvatarUrl(data?.publicUrl || null);
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert("Name is required");
    setSaving(true);
    const { error } = await supabase.from("chefs").insert({
      name, location: location || null, bio: bio || null, avatar: avatarUrl || null,
    });
    setSaving(false);
    if (error) return Alert.alert("Save failed", error.message);
    Alert.alert("Success", "Chef profile submitted!");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20, gap: 12, maxWidth: 720, alignSelf: "center", width: "100%" }}>
      <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: "900" }}>Chef sign-up</Text>

      <TextInput placeholder="Full name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName}
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }} />
      <TextInput placeholder="Location (e.g., Scarborough, ON)" placeholderTextColor="#94a3b8" value={location} onChangeText={setLocation}
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10 }} />
      <TextInput placeholder="Short bio" placeholderTextColor="#94a3b8" value={bio} onChangeText={setBio} multiline numberOfLines={3}
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: theme.colors.white, padding: 12, borderRadius: 10, minHeight: 90 }} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={pickAvatar} style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 12, borderRadius: 10 }}>
          <Text style={{ color: "#e2e8f0", fontWeight: "700" }}>{avatarUrl ? "Change avatar" : "Upload avatar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={submit} disabled={saving}
          style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10, opacity: saving ? 0.7 : 1 }}>
          <Text style={{ color: theme.colors.white, fontWeight: "800" }}>{saving ? "Saving..." : "Create profile"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ color: "#9aa4af", marginTop: 6, fontSize: 12 }}>
        Ensure storage bucket "public-assets" exists and is public.
      </Text>
    </View>
  );
}
