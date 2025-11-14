import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image } from 'react-native'
import { useRouter } from 'expo-router'

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
            source={require('../design/stitch_homechef_hub_homepage/HCLogo.png/HClogo2.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>HomeChef</Text>
        </View>
        <Text style={styles.copy}>Your marketplace for authentic homemade meals.</Text>
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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
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
