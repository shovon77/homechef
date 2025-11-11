import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export const FOOTER_HEIGHT = 88

export default function Footer() {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.brand}>🍽️ HomeChef</Text>
        <Text style={styles.copy}>Your marketplace for authentic homemade meals.</Text>
      </View>
      <View style={styles.links}>
        <Text style={styles.link}>About Us</Text>
        <Text style={styles.link}>FAQ</Text>
        <Text style={styles.link}>Contact</Text>
        <Text style={styles.link}>Terms of Service</Text>
      </View>
      <Text style={styles.legal}>© 2025 HomeChef. All rights reserved.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  inner: {
    gap: 6,
  },
  brand: {
    fontWeight: '700',
    fontSize: 16,
    color: '#0f172a',
  },
  copy: {
    color: '#334155',
  },
  links: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    color: '#0f766e',
  },
  legal: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
  },
})
