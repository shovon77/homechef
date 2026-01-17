import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { theme } from '../lib/theme'

export const FOOTER_HEIGHT = 62

export default function Footer() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isMobile = width < 768

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
            source={require('../assets/AppLogoWordFinal2026.png')}
            style={[
              styles.brandLogo,
              { 
                width: isMobile ? Math.min(400, width - 40) : 560,
                height: isMobile ? (Math.min(400, width - 40) / 5) : 112 
              }
            ]}
            resizeMode="contain"
          />
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
    borderTopColor: '#FFFFFF',
    backgroundColor: '#F2F0EF',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
  },
  inner: {
    gap: 4,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -100,
  },
  brandLogo: {
    backgroundColor: 'transparent',
  },
  copy: {
    color: '#334155',
    fontFamily: theme.typography.fontFamily.body,
  },
  links: {
    marginTop: 4,
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
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
})
