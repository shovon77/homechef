import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../lib/supabase";
import { theme } from "../../../constants/theme";
import { useRole } from "../../../hooks/useRole";
import { getProfile } from "../../../lib/db";
import { uploadAvatar } from "../../../lib/storage";
import type { Profile } from "../../../lib/types";

export default function AdminProfilePage() {
  const router = useRouter();
  const { loading: roleLoading, user, isAdmin } = useRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace("/");
      return;
    }

    if (user) {
      loadProfile();
    }
  }, [user, roleLoading, isAdmin]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const prof = await getProfile(user.id);
      if (prof) {
        setProfile(prof);
        setName(prof.name || "");
        setEmail(prof.email || "");
        setPhotoUrl(prof.photo_url || null);
      }
    } catch (e: any) {
      console.error("Error loading profile:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Validation", "Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const updateData: { name: string; photo_url?: string | null } = {
        name: name.trim(),
      };
      
      if (photoUrl !== profile?.photo_url) {
        updateData.photo_url = photoUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      await loadProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAvatar() {
    if (!user) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Please grant camera roll permissions to upload photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingAvatar(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const url = await uploadAvatar(blob, user.id);
      setPhotoUrl(url);
      Alert.alert("Success", "Avatar uploaded successfully. Click 'Save Changes' to update your profile.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (roleLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAdmin || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>Admin access required</Text>
      </View>
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || email[0]?.toUpperCase() || "?";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }} contentContainerStyle={{ padding: 20 }}>
      <View style={{ maxWidth: 600, width: "100%", alignSelf: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text, marginBottom: 24 }}>Admin Profile</Text>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            padding: 24,
            gap: 20,
          }}
        >
          {/* Avatar */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.colors.primary,
                }}
              />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.colors.white, fontSize: 32, fontWeight: "900" }}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleUploadAvatar}
              disabled={uploadingAvatar}
              style={{
                marginTop: 8,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: theme.colors.primary,
                opacity: uploadingAvatar ? 0.7 : 1,
              }}
            >
              <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 12 }}>
                {uploadingAvatar ? "Uploading..." : "Upload Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Admin badge */}
          <View style={{ alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 14 }}>Admin</Text>
            </View>
          </View>

          {/* Name field */}
          <View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: 12,
                color: theme.colors.text,
                fontSize: 16,
              }}
            />
          </View>

          {/* Email field (read-only) */}
          <View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Email</Text>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>{email || "No email"}</Text>
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? "rgba(229, 57, 53, 0.6)" : theme.colors.primary,
              paddingVertical: 14,
              borderRadius: 10,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ color: theme.colors.white, fontWeight: "900", textAlign: "center", fontSize: 16 }}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

