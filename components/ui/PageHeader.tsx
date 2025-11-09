import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme, textStyle } from '../../lib/theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
};

/**
 * Page header component matching design system
 * Consistent title + optional subtitle + actions layout
 */
export function PageHeader({ title, subtitle, actions, style, titleStyle, subtitleStyle }: PageHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
        )}
      </View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...textStyle('heading'),
    fontSize: theme.typography.fontSize['4xl'],
    marginBottom: subtitle ? theme.spacing.xs : 0,
  },
  subtitle: {
    ...textStyle('subtitle'),
    color: theme.colors.subtle,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});

