import React from "react";
import { View, TextInput, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
};

export function SearchBarGlass({
  value,
  onChange,
  onSubmit,
  placeholder = "Search dishes or chefs…",
}: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor:
          Platform.OS === "web" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.7)",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: "rgba(230,236,242,0.9)",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        // web-only blur; native will just look frosted with alpha
        ...(Platform.OS === "web" ? ({ backdropFilter: "blur(10px)" } as any) : null),
      }}
    >
      <Ionicons name="search" size={18} color="#334155" />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        style={{ flex: 1, fontSize: 16, color: "#0F172A" }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}
export default SearchBarGlass;
