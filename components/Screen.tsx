import React from 'react';
import { View, ScrollView, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import NavBar from './NavBar';
import Footer from './Footer';

type ScreenProps = ViewProps & {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  scroll?: boolean; // kept for compatibility
  contentPadding?: number;
  noHeader?: boolean;
  noFooter?: boolean;
};

export default function Screen({
  children,
  style,
  contentStyle,
  contentPadding,
  noHeader = false,
  noFooter = false,
}: ScreenProps) {
  const baseStyle = StyleSheet.flatten([{ flex: 1, backgroundColor: '#ffffff' }, style]);

  const content = StyleSheet.flatten([
    { flex: 1 },
    contentPadding != null ? { padding: contentPadding } : null,
    contentStyle,
  ]);

  return (
    <View style={baseStyle}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {!noHeader && <NavBar />}
        <View style={content}>
          {children}
        </View>
        {!noFooter && <Footer />}
      </ScrollView>
    </View>
  );
}

export { Screen };

