import React from 'react';
import { View } from 'react-native';

export function SortIcon({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  const height = size * 0.25; // Height of each pill
  const gap = size * 0.15; // Gap between pills
  const strokeWidth = size * 0.08; // Thickness of the line

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', gap: gap }}>
      <View style={{
        width: '100%',
        height: height,
        borderRadius: 999,
        borderWidth: strokeWidth,
        borderColor: color,
      }} />
      <View style={{
        width: '100%',
        height: height,
        borderRadius: 999,
        borderWidth: strokeWidth,
        borderColor: color,
      }} />
    </View>
  );
}

