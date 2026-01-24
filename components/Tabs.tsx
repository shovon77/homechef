'use client';
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
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
  const scrollViewRef = useRef<ScrollView>(null);
  const tabPositions = useRef<{ [key: number]: { x: number; width: number } }>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const { width } = useWindowDimensions();
  
  useEffect(() => {
    setIdx(initial);
    setLayoutReady(false);
  }, [initial]);

  // Trigger scroll on mount if active tab position is already known
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tabPositions.current[idx] && scrollViewRef.current) {
        const tabInfo = tabPositions.current[idx];
        const tabCenter = tabInfo.x + (tabInfo.width / 2);
        const scrollPosition = tabCenter - (width / 2);
        scrollViewRef.current?.scrollTo({
          x: Math.max(0, scrollPosition),
          animated: false, // No animation on initial load
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Scroll to center the active tab when layout is ready
    if (layoutReady && scrollViewRef.current && tabPositions.current[idx]) {
      const tabInfo = tabPositions.current[idx];
      const tabCenter = tabInfo.x + (tabInfo.width / 2);
      const scrollPosition = tabCenter - (width / 2);
      scrollViewRef.current?.scrollTo({
        x: Math.max(0, scrollPosition),
        animated: true,
      });
    }
  }, [idx, width, layoutReady]);

  const resolvedActiveColor = activeColor ?? theme.colors.text;
  const resolvedIndicatorColor = indicatorColor ?? theme.colors.primary;
  return (
    <View style={styles.container}>
      {/* Underline-style tabs matching design mockups */}
      <View style={styles.tabBarWrapper}>
        <ScrollView 
          ref={scrollViewRef}
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
              onLayout={(event) => {
                const { x, width: tabWidth } = event.nativeEvent.layout;
                tabPositions.current[i] = { x, width: tabWidth };
                // When the active tab's layout is measured, trigger scroll
                if (i === idx) {
                  setTimeout(() => setLayoutReady(true), 150);
                }
              }}
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

