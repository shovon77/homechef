import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Platform } from 'react-native';
import { theme, elev } from '../../lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
};

/**
 * Button component matching design system
 * Based on design mockups in /design directory
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.text.color} />
      ) : (
        <Text style={[styles.text, variantStyles.text, sizeStyles.text, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function getVariantStyles(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: theme.colors.primary,
          ...elev('primary'),
        },
        text: {
          color: theme.colors.primaryContrast,
        },
      };
    case 'secondary':
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
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        text: {
          color: theme.colors.primary,
        },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
        },
        text: {
          color: theme.colors.text,
        },
      };
  }
}

function getSizeStyles(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return {
        container: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          minHeight: 36,
        },
        text: {
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.bold,
        },
      };
    case 'md':
      return {
        container: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          minHeight: 44, // WCAG touch target
        },
        text: {
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.bold,
        },
      };
    case 'lg':
      return {
        container: {
          paddingVertical: theme.spacing.md + 2,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.lg,
          minHeight: 48,
        },
        text: {
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.extrabold,
        },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
});

