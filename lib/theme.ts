/**
 * HomeChef Design System Theme
 * 
 * Extracted from design mockups in /design/stitch_homechef_hub_homepage/
 * 
 * Design Tokens:
 * - Primary: #19e680 (bright green) - main brand color
 * - Background: #112119 (dark green) - dark mode default
 * - Surface: #1C2A23 (dark surface for cards)
 * - Text: #F5F5F5 (light text), #98A2B3 (muted)
 * - Font: Plus Jakarta Sans
 * 
 * Component Mapping:
 * - Buttons: primary (#19e680), secondary (surfaceAlt), outline, ghost
 * - Cards: surface background with border or elevation
 * - Inputs: surface background with border, focus ring
 * - Tabs: underline style with primary accent
 * - Badges: primary/error/success variants
 * 
 * Migration Notes:
 * - Old theme.colors.* → theme.colors.* (same structure, updated values)
 * - Use theme utilities: cardStyle(), panelStyle(), elev() for consistency
 * - All pages should use <Screen> wrapper for consistent background
 */

import { Platform, ViewStyle, TextStyle } from 'react-native';

export const theme = {
  colors: {
    // Backgrounds
    background: '#112119', // Dark green (dark mode default)
    backgroundLight: '#f6f8f7', // Light gray-green (light mode - not used yet)
    surface: '#1C2A23', // Dark surface for cards/panels
    surfaceLight: '#FFFFFF', // White surface (light mode)
    card: '#1C2A23', // Card background (same as surface for now)
    
    // Primary brand
    primary: '#3E6A55', // Dark green (matches HTML design)
    primaryContrast: '#FFFFFF', // White text on primary
    primaryLight: 'rgba(62, 106, 85, 0.1)', // Primary with opacity
    
    // Secondary/Accent
    secondary: '#2DA97B', // Muted green (fallback)
    accent: '#19e680', // Same as primary
    
    // Semantic
    success: '#19e680',
    warning: '#ffb700',
    error: '#ef4444',
    info: '#0ea5e9',
    
    // Text
    text: '#F5F5F5', // Primary text (dark mode)
    heading: '#F5F5F5', // Headings
    subtle: '#98A2B3', // Muted/secondary text
    disabled: '#667085', // Disabled text
    textLight: '#101828', // Dark text (light mode)
    
    // Borders
    border: '#344054', // Default border
    borderLight: '#EAECF0', // Light border
    borderDark: '#1d4d35', // Darker border variant
    
    // Legacy compatibility (keep for existing code)
    surfaceAlt: 'rgba(25, 230, 128, 0.1)',
    brandText: '#F5F5F5',
    textMuted: '#98A2B3',
    white: '#FFFFFF',
    onPrimary: '#0B1F17',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
  },
  
  shadows: {
    sm: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {},
    }),
    md: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      },
      default: {},
    }),
    lg: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      },
      default: {},
    }),
    primary: Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#19e680',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 8px rgba(25, 230, 128, 0.3)',
      },
      default: {},
    }),
  },
  
  typography: {
    fontFamily: {
      display: 'Plus Jakarta Sans, Noto Sans, sans-serif',
      body: 'Plus Jakarta Sans, system-ui, sans-serif',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 22,
      '3xl': 24,
      '4xl': 28,
      '5xl': 32,
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: -0.033,
      normal: -0.015,
      wide: 0.015,
    },
  },
};

// Utility helpers for common styles
export const cardStyle = (elevated = false): ViewStyle => ({
  backgroundColor: theme.colors.card,
  borderRadius: theme.radius.xl,
  borderWidth: elevated ? 0 : 1,
  borderColor: theme.colors.border,
  ...(elevated ? theme.shadows.lg : {}),
});

export const panelStyle = (): ViewStyle => ({
  backgroundColor: theme.colors.surface,
  borderRadius: theme.radius.xl,
  borderWidth: 1,
  borderColor: theme.colors.border,
});

export const elev = (level: 'sm' | 'md' | 'lg' | 'primary' = 'md'): ViewStyle => {
  return theme.shadows[level] || {};
};

export const textStyle = (variant: 'heading' | 'body' | 'subtitle' | 'caption' = 'body'): TextStyle => {
  switch (variant) {
    case 'heading':
      return {
        color: theme.colors.heading,
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: theme.typography.fontWeight.black,
        lineHeight: theme.typography.fontSize['3xl'] * theme.typography.lineHeight.tight,
        letterSpacing: theme.typography.letterSpacing.tight,
      };
    case 'subtitle':
      return {
        color: theme.colors.text,
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.normal,
      };
    case 'caption':
      return {
        color: theme.colors.subtle,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.normal,
        lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
      };
    default: // body
      return {
        color: theme.colors.text,
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.normal,
        lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
      };
  }
};

export default theme;

