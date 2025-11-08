import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function StarRating({
  value,
  onChange,
  size = 22,
  readonly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readonly?: boolean;
}) {
  const stars = [1,2,3,4,5];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {stars.map(n => {
        const filled = n <= Math.round(value || 0);
        const char = filled ? "★" : "☆";
        const color = filled ? "#FFD056" : "#9aa4af";
        const Btn = readonly ? View : TouchableOpacity;
        return (
          <Btn key={n} onPress={readonly ? undefined : () => onChange?.(n)}>
            <Text style={{ fontSize: size, color }}>{char}</Text>
          </Btn>
        );
      })}
      {!!value && <Text style={{ marginLeft: 6, color: "#cbd5e1" }}>{value.toFixed(1)}</Text>}
    </View>
  );
}
