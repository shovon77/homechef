import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Image, useWindowDimensions, ImageSourcePropType } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { theme } from '../lib/theme'
import { useFooterSocialUrls } from '../hooks/useFooterSocialUrls'
import type { FooterSocialUrlKey } from '../lib/footerSocialSettings'

export const FOOTER_HEIGHT = 62

const SOCIAL_ICON_W = 32
const SOCIAL_ICON_H = 32

type SocialDef = {
  urlKey: FooterSocialUrlKey
  label: string
  source: ImageSourcePropType
}

/** Order: FB → IG → YT → WA → LI */
const SOCIAL_DEFS: SocialDef[] = [
  { urlKey: 'facebook', label: 'Facebook', source: require('../assets/facebook.png') },
  { urlKey: 'instagram', label: 'Instagram', source: require('../assets/instagram (1).png') },
  { urlKey: 'youtube', label: 'YouTube', source: require('../assets/youtube (1).png') },
  { urlKey: 'whatsapp', label: 'WhatsApp', source: require('../assets/whatsapp (1).png') },
  { urlKey: 'linkedin', label: 'LinkedIn', source: require('../assets/linkedin (1).png') },
]

function openExternalUrl(url: string) {
  if (!url) return
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    Linking.openURL(url)
  }
}

export default function Footer() {
  const router = useRouter()
  const pathname = usePathname?.() || ''
  const { width } = useWindowDimensions()
  const isMobile = width < 768
  const iconW = isMobile ? 28 : SOCIAL_ICON_W
  const iconH = isMobile ? 28 : SOCIAL_ICON_H
  const socialUrls = useFooterSocialUrls()

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
        <View style={styles.socialRow}>
          {SOCIAL_DEFS.map(def => {
            const url = socialUrls[def.urlKey]
            const hasUrl = url.length > 0
            return (
              <TouchableOpacity
                key={def.urlKey}
                onPress={() => openExternalUrl(url)}
                disabled={!hasUrl}
                style={[styles.socialButton, !hasUrl && styles.socialButtonDisabled]}
                accessibilityRole="link"
                accessibilityLabel={def.label}
                accessibilityState={{ disabled: !hasUrl }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Image
                  source={def.source}
                  style={[styles.socialIcon, { width: iconW, height: iconH }]}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </TouchableOpacity>
            )
          })}
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
    alignSelf: 'flex-start',
    width: 'auto',
    marginLeft: -12,
  },
  brandLogo: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginLeft: -8,
  },
  brandName: {
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontSize: 24,
    lineHeight: 32,
    marginLeft: -12,
  },
  brandNameYour: {
    color: '#33393A',
  },
  brandNameHomeChef: {
    color: theme.colors.primary,
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
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.normal as any,
    fontSize: 14,
  },
  socialRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    padding: 4,
  },
  socialIcon: {
    tintColor: theme.colors.primary,
  },
  socialButtonDisabled: {
    opacity: 0.38,
  },
  legal: {
    marginTop: 12,
    marginBottom: 0,
    color: '#33393A',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
})
