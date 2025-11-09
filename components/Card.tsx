import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../lib/theme';

type CardVariant = 'default' | 'elevated' | 'outlined';

type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  padding?: keyof typeof theme.spacing;
};

/**
 * Card component matching design system
 * Based on design mockups in /design directory
 */
export function Card({ children, variant = 'default', style, padding = 'lg' }: CardProps) {
  const variantStyles = getVariantStyles(variant);
  const paddingValue = theme.spacing[padding];

  return (
    <View style={[styles.base, variantStyles, { padding: paddingValue }, style]}>
      {children}
    </View>
  );
}

function getVariantStyles(variant: CardVariant): ViewStyle {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
    case 'elevated':
      return {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        ...theme.shadows.lg,
      };
    case 'outlined':
      return {
        backgroundColor: 'transparent',
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

