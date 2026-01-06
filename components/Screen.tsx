import React from 'react';
import { View, ScrollView, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import NavBar from './NavBar';
import Footer from './Footer';

type ScreenProps = ViewProps & {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  scrollViewContentStyle?: ViewStyle | ViewStyle[];
  scroll?: boolean; // kept for compatibility
  contentPadding?: number;
  noHeader?: boolean;
  noFooter?: boolean;
  fixedFooterHeight?: number; // Height of fixed/floating element at bottom
};

export default function Screen({
  children,
  style,
  contentStyle,
  scrollViewContentStyle,
  contentPadding,
  noHeader = false,
  noFooter = false,
  fixedFooterHeight = 0,
}: ScreenProps) {
  const baseStyle = StyleSheet.flatten([{ flex: 1, backgroundColor: '#ffffff' }, style]);

  const content = StyleSheet.flatten([
    { flex: 1 },
    contentPadding != null ? { padding: contentPadding } : null,
    contentStyle,
  ]);

  return (
    <View style={baseStyle}>
      {!noHeader && (
        <View style={{ zIndex: 100 }}>
          <NavBar />
        </View>
      )}
      <ScrollView contentContainerStyle={[{ flexGrow: 1 }, scrollViewContentStyle]}>
        <View style={content}>
          {children}
        </View>
        {!noFooter && <Footer />}
        {/* Spacer for fixed bottom elements */}
        {fixedFooterHeight > 0 && <View style={{ height: fixedFooterHeight }} />}
      </ScrollView>
    </View>
  );
}

export { Screen };

