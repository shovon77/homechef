'use client';
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';

export function Tabs({ tabs, initial = 0 }: {
  tabs: { key: string; title: string; content: JSX.Element }[];
  initial?: number;
}) {
  const [idx, setIdx] = useState(initial);
  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {tabs.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setIdx(i)}
            style={{
              backgroundColor: i === idx ? theme.colors.primary : theme.colors.surface,
              borderWidth: 1,
              borderColor: i === idx ? theme.colors.primary : 'rgba(255,255,255,0.15)',
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}>
            <Text style={{ color: theme.colors.white, fontWeight: '800' }}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>{tabs[idx]?.content}</View>
    </View>
  );
}

