import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../lib/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
};

/**
 * Input component matching design system
 * Based on design mockups in /design directory
 */
export function Input({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  placeholderTextColor,
  ...props
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        placeholderTextColor={placeholderTextColor || theme.colors.textMuted}
        style={[
          styles.input,
          error && styles.inputError,
          inputStyle,
        ]}
      />
      {error && (
        <Text style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.base,
    minHeight: 48,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
});

