import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../lib/theme';

type StarsProps = {
  value: number; // 0-5
  size?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
  style?: ViewStyle;
  color?: string;
};

/**
 * Star rating component matching design system
 * Read-only and editable variants
 * Based on design mockups in /design directory
 */
export function Stars({ value, size = 20, editable = false, onChange, style, color }: StarsProps) {
  const starColor = color || theme.colors.warning;
  const fullStars = Math.floor(value);
  const hasHalfStar = value - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const handlePress = (index: number) => {
    if (editable && onChange) {
      onChange(index + 1);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <TouchableOpacity
          key={`full-${i}`}
          onPress={() => handlePress(i)}
          disabled={!editable}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Text style={[styles.star, { fontSize: size, color: starColor }]}>★</Text>
        </TouchableOpacity>
      ))}
      {hasHalfStar && (
        <TouchableOpacity
          key="half"
          onPress={() => handlePress(fullStars)}
          disabled={!editable}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Text style={[styles.star, { fontSize: size, color: starColor }]}>⯪</Text>
        </TouchableOpacity>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <TouchableOpacity
          key={`empty-${i}`}
          onPress={() => handlePress(fullStars + (hasHalfStar ? 1 : 0) + i)}
          disabled={!editable}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Text style={[styles.star, { fontSize: size, color: theme.colors.subtle }]}>☆</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    lineHeight: 20,
  },
});

