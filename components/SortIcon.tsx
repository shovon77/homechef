import React from 'react';
import { View } from 'react-native';

export function SortIcon({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-around', paddingVertical: size * 0.17 }}>
      <View style={{ height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

