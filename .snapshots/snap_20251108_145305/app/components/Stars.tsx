import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  value: number;             // 0..5
  onChange?: (v: number) => void; // if provided, stars are clickable
  size?: number;
  color?: string;
  gap?: number;
};

export default function Stars({ value = 0, onChange, size = 18, color = "#fbbf24", gap = 2 }: Props) {
  const stars = [1,2,3,4,5];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      {stars.map(n => (
        <TouchableOpacity key={n} disabled={!onChange} onPress={() => onChange?.(n)}>
          <Text
            style={{
              fontSize: size,
              lineHeight: size * 1.1,
              color,
              userSelect: "none" as any
            }}
          >
            {n <= Math.round(value) ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
