import React from 'react';
import { SafeAreaView, View, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../lib/theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  useScrollView?: boolean;
  scrollViewProps?: any;
};

/**
 * Screen wrapper component that provides consistent layout structure
 * - Uses SafeAreaView with flex: 1
 * - Optionally wraps children in ScrollView
 * - Accepts style and contentStyle props for customization
 */
export function Screen({ 
  children, 
  style, 
  contentStyle,
  useScrollView = false,
  scrollViewProps = {}
}: ScreenProps) {
  const containerStyle: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: theme.colors.background },
    style,
  ];

  if (useScrollView) {
    return (
      <SafeAreaView style={containerStyle}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle}>
      <View style={[{ flex: 1 }, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

