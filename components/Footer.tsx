import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image, useWindowDimensions } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { theme } from '../lib/theme'

export const FOOTER_HEIGHT = 62

export default function Footer() {
  const router = useRouter()
  const pathname = usePathname?.() || ''
  const { width } = useWindowDimensions()
  const isMobile = width < 768

  const handleContact = () => {
    const email = 'thereforyou.yhc@gmail.com'
    const subject = 'Contact YourHomeChef'
    const body = 'Hello YourHomeChef team,'
    
    if (Platform.OS === 'web') {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } else {
      Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <View style={styles.inner}>
          <View style={styles.brandContainer} collapsable={false}>
            <Image 
              key={pathname || 'footer-logo'}
              source={require('../assets/YHC-New-Logo-Only.png')}
              style={[styles.brandLogo, { width: isMobile ? 80 : 108, height: isMobile ? 56 : 74, minWidth: 40, minHeight: 28 }]}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>
              <Text style={styles.brandNameYour}>Your</Text><Text style={styles.brandNameHomeChef}>HomeChef</Text>
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
            <Text style={styles.link}>Legal</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.legal}>© 2025 YourHomeChef. All rights reserved.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF',
    backgroundColor: '#F2F0EF',
    paddingLeft: 48,
    paddingRight: 48,
    paddingTop: 24,
    paddingBottom: 0,
    ...Platform.select({
      web: {
        overflow: 'visible',
      },
    }),
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 0,
    paddingBottom: 0,
  },
  inner: {
    gap: 12,
    alignItems: 'flex-start',
    width: '100%',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    marginLeft: -4,
    paddingLeft: 0,
    alignSelf: 'flex-start',
    width: 'auto',
  },
  brandLogo: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginLeft: -12,
  },
  brandName: {
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontSize: 24,
    lineHeight: 32,
    marginLeft: -4,
  },
  brandNameYour: {
    color: '#33393A',
  },
  brandNameHomeChef: {
    color: '#FE734C',
  },
  copy: {
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  links: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontSize: 14,
  },
  legal: {
    marginTop: 12,
    marginBottom: 0,
    color: '#33393A',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
})
