import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { theme } from '../lib/theme'

export const FOOTER_HEIGHT = 88

export default function Footer() {
  const router = useRouter()

  const handleContact = () => {
    const email = 'support@homechef.com'
    const subject = 'Contact HomeChef'
    const body = 'Hello HomeChef team,'
    
    if (Platform.OS === 'web') {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } else {
      Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.brandContainer}>
          <Image 
            source={require('../assets/HClogo2.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>
            <Text style={{ color: '#33393A' }}>Your</Text>
            <Text style={{ color: '#FE734C' }}>HomeChef</Text>
          </Text>
        </View>
        <Text style={styles.copy}>YourHomeChef is a marketplace connecting independent home chefs with local customers. All food is prepared by the chefs.</Text>
      </View>
      <View style={styles.links}>
        <TouchableOpacity onPress={() => router.push('/about')}>
          <Text style={styles.link}>About Us</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/faq')}>
          <Text style={styles.link}>FAQ</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleContact}>
          <Text style={styles.link}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/terms')}>
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.legal}>© 2025 YourHomeChef. All rights reserved.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#F2F0EF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  inner: {
    gap: 6,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    tintColor: '#FE734C',
  },
  brand: {
    fontWeight: '900',
    fontSize: 24,
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.display,
    letterSpacing: -0.015,
    lineHeight: 28,
  },
  copy: {
    color: '#334155',
    fontFamily: theme.typography.fontFamily.body,
  },
  links: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: 'bold',
  },
  legal: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
})
