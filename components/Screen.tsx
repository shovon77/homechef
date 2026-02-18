import React from 'react';
import { View, ScrollView, ViewProps, ViewStyle, StyleSheet, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import NavBar from './NavBar';
import Footer from './Footer';

type ScreenProps = ViewProps & {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  scrollViewContentStyle?: ViewStyle | ViewStyle[];
  scrollRef?: any; // Optional ref for programmatic scrolling
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
  scrollRef,
  contentPadding,
  noHeader = false,
  noFooter = false,
  fixedFooterHeight = 0,
}: ScreenProps) {
  const pathname = usePathname?.() || '';
  const isChefDashboard = pathname.startsWith('/chef');
  const BG_LIGHT = '#F2F0EF';
  
  const baseStyle = StyleSheet.flatten([{ flex: 1, backgroundColor: '#ffffff' }, style]);

  const content = StyleSheet.flatten([
    { flex: 1 },
    contentPadding != null ? { padding: contentPadding } : null,
    contentStyle,
  ]);

  const headerWrapperStyle = isChefDashboard
    ? { 
        zIndex: 100, 
        backgroundColor: BG_LIGHT, 
        borderBottomWidth: 0, 
        borderRightWidth: 0, 
        borderLeftWidth: 0, 
        borderTopWidth: 0,
        paddingTop: 0,
        marginTop: 0,
        ...Platform.select({
          web: {
            borderBottomWidth: '0px',
            borderTopWidth: '0px',
            borderLeftWidth: '0px',
            borderRightWidth: '0px',
          },
        }),
      }
    : { 
        zIndex: 100, 
        backgroundColor: 'transparent', 
        borderBottomWidth: 0, 
        borderRightWidth: 0, 
        borderLeftWidth: 0, 
        borderTopWidth: 0 
      };

  const scrollBg = isChefDashboard ? BG_LIGHT : (baseStyle.backgroundColor || '#ffffff');
  const scrollWrapStyle = isChefDashboard
    ? {
        flex: 1,
        backgroundColor: BG_LIGHT,
        overflow: 'hidden' as const,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
        ...(Platform.OS === 'web' ? { overflowX: 'hidden' as const } : {}),
      }
    : { flex: 1, ...(Platform.OS === 'web' ? { overflowX: 'hidden' as const } : {}) };
  return (
    <View style={baseStyle}>
      {!noHeader && (
        <View style={headerWrapperStyle} data-testid={isChefDashboard ? 'chef-dashboard-navbar-wrapper' : undefined}>
          <NavBar />
        </View>
      )}
      <View style={scrollWrapStyle} data-testid={isChefDashboard ? 'chef-dashboard-scroll-wrapper' : undefined}>
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={[
            { flexGrow: 1, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, backgroundColor: scrollBg, borderTopWidth: 0, borderTopColor: 'transparent' }, 
            scrollViewContentStyle
          ]}
          style={{ flex: 1, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, backgroundColor: scrollBg, borderTopWidth: 0 }}
          contentInsetAdjustmentBehavior="never"
        >
        <View style={[content, { minHeight: '100%', justifyContent: 'space-between' }, isChefDashboard && { backgroundColor: BG_LIGHT, borderTopWidth: 0, borderTopColor: 'transparent' }]} data-testid={isChefDashboard ? 'chef-dashboard-scroll-content' : undefined}>
          <View style={[{ flexGrow: 1, flexShrink: 0 }, isChefDashboard && { backgroundColor: BG_LIGHT, borderTopWidth: 0, borderTopColor: 'transparent' }]}>
            {children}
          </View>
          {!noFooter && (
            <View style={{
              marginTop: -60,
              marginLeft: contentStyle?.paddingLeft ? -contentStyle.paddingLeft : 
                (contentStyle?.paddingHorizontal ? -contentStyle.paddingHorizontal : 
                (contentPadding != null && contentPadding > 0 ? -contentPadding : 
                (scrollViewContentStyle?.paddingLeft ? -scrollViewContentStyle.paddingLeft :
                (scrollViewContentStyle?.paddingHorizontal ? -scrollViewContentStyle.paddingHorizontal : 0)))),
              marginRight: contentStyle?.paddingRight ? -contentStyle.paddingRight : 
                (contentStyle?.paddingHorizontal ? -contentStyle.paddingHorizontal : 
                (contentPadding != null && contentPadding > 0 ? -contentPadding :
                (scrollViewContentStyle?.paddingRight ? -scrollViewContentStyle.paddingRight :
                (scrollViewContentStyle?.paddingHorizontal ? -scrollViewContentStyle.paddingHorizontal : 0)))),
              ...(Platform.OS === 'web' ? {
                width: '100vw',
                maxWidth: '100vw',
                marginLeft: 'calc(-50vw + 50%)',
              } : {}),
            } as any}>
              <Footer />
            </View>
          )}
        </View>
        {/* Spacer for fixed bottom elements */}
        {fixedFooterHeight > 0 && <View style={{ height: fixedFooterHeight }} />}
        </ScrollView>
      </View>
    </View>
  );
}

export { Screen };

