import React from 'react';
import { ScrollView, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { FOOTER_HEIGHT } from './Footer';

type ScreenProps = ViewProps & {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  scroll?: boolean; // kept for compatibility
  contentPadding?: number;
};

export default function Screen({
  children,
  style,
  contentStyle,
  contentPadding,
}: ScreenProps) {
  const baseStyle = StyleSheet.flatten([{ flex: 1 }, style]);

  const content = StyleSheet.flatten([
    { flexGrow: 1, paddingBottom: FOOTER_HEIGHT + 24 },
    contentPadding != null ? { padding: contentPadding } : null,
    contentStyle,
  ]);

  return (
    <ScrollView style={baseStyle} contentContainerStyle={content}>
      {children}
    </ScrollView>
  );
}

export { Screen };

