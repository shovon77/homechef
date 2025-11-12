'use client';
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

type TabConfig = { key: string; title: string; content: JSX.Element }[];

type TabsProps = {
  tabs: TabConfig;
  initial?: number;
  onTabChange?: (key: string) => void;
  activeColor?: string;
  indicatorColor?: string;
};

export function Tabs({ tabs, initial = 0, onTabChange, activeColor, indicatorColor }: TabsProps) {
  const [idx, setIdx] = useState(initial);
  const resolvedActiveColor = activeColor ?? theme.colors.text;
  const resolvedIndicatorColor = indicatorColor ?? theme.colors.primary;
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
            <Text style={[styles.tabText, i === idx && { color: resolvedActiveColor }]}>
              {t.title}
            </Text>
            {i === idx && <View style={[styles.tabIndicator, { backgroundColor: resolvedIndicatorColor }]} />}
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
    gap: theme.spacing.md,
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
    borderRadius: theme.radius.sm,
  },
  content: {
    flex: 1,
  },
});

