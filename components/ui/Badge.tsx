import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../lib/theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'default';
type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/**
 * Badge/Chip component matching design system
 * Used for filters, statuses, tags
 */
export function Badge({ label, variant = 'default', size = 'md', style, textStyle }: BadgeProps) {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <View style={[styles.base, variantStyles.container, sizeStyles.container, style]}>
      <Text style={[styles.text, variantStyles.text, sizeStyles.text, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

function getVariantStyles(variant: BadgeVariant) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: theme.colors.primaryLight,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        text: {
          color: theme.colors.primary,
        },
      };
    case 'success':
      return {
        container: {
          backgroundColor: 'rgba(25, 230, 128, 0.1)',
          borderWidth: 1,
          borderColor: theme.colors.success,
        },
        text: {
          color: theme.colors.success,
        },
      };
    case 'warning':
      return {
        container: {
          backgroundColor: 'rgba(255, 183, 0, 0.1)',
          borderWidth: 1,
          borderColor: theme.colors.warning,
        },
        text: {
          color: theme.colors.warning,
        },
      };
    case 'error':
      return {
        container: {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1,
          borderColor: theme.colors.error,
        },
        text: {
          color: theme.colors.error,
        },
      };
    default:
      return {
        container: {
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        text: {
          color: theme.colors.text,
        },
      };
  }
}

function getSizeStyles(size: BadgeSize) {
  switch (size) {
    case 'sm':
      return {
        container: {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.sm,
        },
        text: {
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.medium,
        },
      };
    case 'md':
      return {
        container: {
          paddingVertical: theme.spacing.xs + 2,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
        },
        text: {
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.semibold,
        },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
  text: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

