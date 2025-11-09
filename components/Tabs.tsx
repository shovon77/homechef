'use client';
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { theme } from '../lib/theme';

export function Tabs({ tabs, initial = 0, onTabChange }: {
  tabs: { key: string; title: string; content: JSX.Element }[];
  initial?: number;
  onTabChange?: (key: string) => void;
}) {
  const [idx, setIdx] = useState(initial);
  return (
    <View style={styles.container}>
      {/* Underline-style tabs matching design mockups */}
      <View style={styles.tabBar}>
        {tabs.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => {
              setIdx(i);
              onTabChange?.(t.key);
            }}
            style={[styles.tab, i === idx && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === idx }}
          >
            <Text style={[styles.tabText, i === idx && styles.tabTextActive]}>
              {t.title}
            </Text>
            {i === idx && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>{tabs[idx]?.content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  tab: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    position: 'relative',
    minHeight: 44, // WCAG touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    // Active state handled by indicator
  },
  tabText: {
    color: theme.colors.subtle,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
  },
  content: {
    flex: 1,
  },
});

