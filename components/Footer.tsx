import React from 'react'
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native'
import { Link } from 'expo-router'
import { theme } from '../lib/theme'

export default function Footer() {
  return (
    <View style={styles.footer}>
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <Text style={styles.logoIcon}>🍽️</Text>
          <Text style={styles.brand}>HomeChef</Text>
        </View>
        <Text style={styles.description}>
          Your marketplace for authentic homemade meals.
        </Text>
      </View>
      <View style={styles.linksRow}>
        <Link href="/about" asChild>
          <TouchableOpacity><Text style={styles.link}>About Us</Text></TouchableOpacity>
        </Link>
        <Link href="/faq" asChild>
          <TouchableOpacity><Text style={styles.link}>FAQ</Text></TouchableOpacity>
        </Link>
        <Link href="#" asChild>
          <TouchableOpacity><Text style={styles.link}>Contact</Text></TouchableOpacity>
        </Link>
        <Link href="/terms" asChild>
          <TouchableOpacity><Text style={styles.link}>Terms of Service</Text></TouchableOpacity>
        </Link>
      </View>
      <Text style={styles.copyright}>© 2025 HomeChef. All rights reserved.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.lg,
    }),
    paddingVertical: theme.spacing['2xl'],
    alignItems: 'center',
    gap: theme.spacing['2xl'],
  },
  content: {
    maxWidth: 1280,
    width: '100%',
    alignItems: Platform.select({
      web: 'stretch' as const,
      default: 'center' as const,
    }),
    gap: theme.spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  logoIcon: {
    fontSize: 28,
  },
  brand: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  description: {
    color: '#555555',
    fontSize: theme.typography.fontSize.sm,
    maxWidth: 480,
  },
  linksRow: {
    flexDirection: Platform.select({
      web: 'row',
      default: 'column',
    }),
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    alignItems: 'center',
  },
  link: {
    color: '#333333',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  copyright: {
    color: '#6B7280',
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    width: '100%',
  },
})
