import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { theme } from '../lib/theme';

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
          ...(theme.shadows.primary as ViewStyle),
        },
        text: {
          color: theme.colors.onPrimary,
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
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: theme.borderRadius.md,
        },
        text: {
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.bold,
        },
      };
    case 'md':
      return {
        container: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: theme.borderRadius.lg,
        },
        text: {
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.bold,
        },
      };
    case 'lg':
      return {
        container: {
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: theme.borderRadius.lg,
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
    minHeight: 40,
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

