import React from 'react';
import { Platform, ScrollView, View, ViewProps, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

type ScreenProps = ViewProps & {
  scroll?: boolean;
  contentPadding?: number;
  children: React.ReactNode;
};

export default function Screen({
  scroll = false,
  contentPadding = 16,
  style,
  children,
  ...rest
}: ScreenProps) {
  const baseViewStyle: any = [
    {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    style,
  ];

  if (!scroll) {
    return (
      <View style={baseViewStyle} {...rest}>
        {children}
      </View>
    );
  }

  const scrollStyle: any = StyleSheet.flatten([
    { flex: 1 },
    style,
  ]);

  return (
    <ScrollView
      style={scrollStyle}
      contentContainerStyle={{ padding: contentPadding, paddingBottom: 160, flexGrow: 1 }}
      scrollEnabled
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

// Export named export for backward compatibility
export { Screen };

