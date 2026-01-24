'use client';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
  
  useEffect(() => {
    setIdx(initial);
  }, [initial]);
  const resolvedActiveColor = activeColor ?? theme.colors.text;
  const resolvedIndicatorColor = indicatorColor ?? theme.colors.primary;
  return (
    <View style={styles.container}>
      {/* Underline-style tabs matching design mockups */}
      <View style={styles.tabBarWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
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
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  tabBarWrapper: {
    marginBottom: theme.spacing.lg,
  },
  tabBarContent: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: 4,
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
    backgroundColor: '#FE734C',
    borderRadius: 8,
  },
  tabText: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});

