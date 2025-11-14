// components/NavBar.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet, Image } from 'react-native'
import { Link, useRouter, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'
import { NAVBAR_HEIGHT } from '../constants/layout'
import { money } from '../lib/money'

// Web-only imports for animations
let motion: any = null;
let Compass: any = null;
if (Platform.OS === 'web') {
  try {
    motion = require('framer-motion');
    const lucide = require('lucide-react');
    Compass = lucide.Compass;
  } catch (e) {
    // Fallback if not available
  }
}

// Colors matching homepage and navbar design
const PRIMARY_COLOR = '#2C4E4B';
const BG_LIGHT = '#FFFFFF';
const TEXT_DARK = '#0e1b18';
const BORDER_LIGHT = '#E5E7EB';
const MAXW = 1280; // max-w-7xl

// Animated ExploreLink component (web-only with fallback for native)
function ExploreLink() {
  const pathname = usePathname?.() || '';
  const isActive = pathname.startsWith('/browse') || pathname.startsWith('/explore');
  const activeColor = '#1dbf73'; // Brand green

  // Web version with framer-motion animations
  if (Platform.OS === 'web' && motion && Compass) {
    const MotionDiv = motion.div;
    const MotionSpan = motion.span;
    
    // Merge all styles into single objects - NO arrays for DOM elements
    const linkStyle = { textDecoration: 'none', outline: 'none' };
    const containerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      paddingInline: '10px',
      paddingBlock: '6px',
      borderRadius: '10px',
      position: 'relative',
      color: isActive ? activeColor : TEXT_DARK,
      cursor: 'pointer',
    };
    const textStyle = {
      fontWeight: '600',
      color: isActive ? activeColor : TEXT_DARK,
    };
    const underlineStyle = {
      position: 'absolute',
      left: '8px',
      right: '8px',
      bottom: '-4px',
      height: '2.5px',
      borderRadius: '2px',
      background: 'linear-gradient(90deg, rgba(29,191,115,1) 0%, rgba(22,160,133,1) 100%)',
      pointerEvents: 'none' as const,
    };
    
    return (
      <Link href="/browse" style={linkStyle} aria-current={isActive ? 'page' : undefined} role="link">
        <MotionDiv
          initial={false}
          whileHover={{ scale: 1.05 }}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          style={containerStyle}
        >
          <Compass size={18} strokeWidth={2.2} color={isActive ? activeColor : TEXT_DARK} />
          <span style={textStyle}>Explore</span>
          <MotionSpan
            layoutId="nav-underline"
            initial={{ width: 0, opacity: 0, x: -8 }}
            animate={{
              width: isActive ? '100%' : '0%',
              opacity: isActive ? 1 : 0,
              x: 0,
            }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={underlineStyle}
          />
        </MotionDiv>
      </Link>
    );
  }

  // Native fallback (regular link) - style arrays are OK for React Native components
  return (
    <Link href="/browse" asChild>
      <TouchableOpacity 
        style={StyleSheet.flatten([
          styles.navLink,
          isActive && { borderBottomWidth: 2, borderBottomColor: activeColor }
        ])}
      >
        <Text style={StyleSheet.flatten([
          styles.navLinkText, 
          isActive && { color: activeColor, fontWeight: '600' }
        ])}>
          Explore
        </Text>
      </TouchableOpacity>
    </Link>
  );
}

export default function NavBar() {
  const router = useRouter()
  const { isAdmin, isChef, user } = useRole()
  const { items } = useCart()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [hasReadyOrder, setHasReadyOrder] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status')
          .eq('user_id', user.id)
          .in('status', ['requested', 'pending', 'ready', 'paid'])
        if (mounted && !error) {
          const statuses = (data ?? []).map((row: any) => row.status)
          setHasActiveOrder(statuses.length > 0)
          setHasReadyOrder(statuses.includes('ready'))
        } else if (mounted) {
          setHasActiveOrder(false)
          setHasReadyOrder(false)
        }
      } catch (err) {
        if (mounted) {
          setHasActiveOrder(false)
          setHasReadyOrder(false)
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        {/* Left Section: Logo */}
        <Link href="/" asChild>
          <TouchableOpacity 
            style={styles.logoContainer}
            accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}
          >
            <Image 
              source={require('../design/stitch_homechef_hub_homepage/HCLogo.png/HClogo2.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>HomeChef</Text>
          </TouchableOpacity>
        </Link>

        {/* Center Section: Navigation */}
        <View style={styles.navCenter}>
          <ExploreLink />
          {hasActiveOrder ? (
            <Link href="/orders/track" asChild>
              <TouchableOpacity style={[styles.navLink, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Text style={[styles.navLinkText, { fontWeight: '700' }]}>Track Order</Text>
                {hasReadyOrder ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR }} /> : null}
              </TouchableOpacity>
            </Link>
          ) : null}
          {/* Dashboard button: only show for admin or chef */}
          {(isAdmin || isChef) && (
            <TouchableOpacity 
              onPress={() => router.push(isAdmin ? '/admin' : '/chef')}
              style={styles.navLink}
            >
              <Text style={styles.navLinkText}>Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right Section: Actions */}
        <View style={styles.rightSection}>
          {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  // Role-aware profile routing
                  if (isAdmin) {
                    router.push('/admin');
                  } else if (isChef) {
                    router.push('/chef');
                  } else {
                    router.push('/profile');
                  }
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { 
                  await supabase.auth.signOut(); 
                  router.push('/auth');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Link href="/auth/chef" asChild>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Sign up as Chef</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/auth" asChild>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Login</Text>
                </TouchableOpacity>
              </Link>
            </>
          )}

          <Link href="/cart" asChild>
            <TouchableOpacity style={styles.cartButton}>
              <Text style={styles.cartIcon}>🛒</Text>
              {cartQty > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartQty}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: NAVBAR_HEIGHT,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      },
      default: {
        backgroundColor: BG_LIGHT,
      },
    }),
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  container: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, // px-6
    paddingVertical: 16, // py-4
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_DARK,
    letterSpacing: -0.015,
    lineHeight: 28,
  },
  navCenter: {
    ...Platform.select({
      web: {
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: -50 }],
        overflow: 'visible', // Ensure underline isn't clipped
      },
      default: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_DARK,
    lineHeight: 20,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    minWidth: 84,
    maxWidth: 480,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.015,
    lineHeight: 20,
  },
  secondaryButton: {
    minWidth: 84,
    maxWidth: 480,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: 0.015,
    lineHeight: 20,
  },
  cartButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIcon: {
    fontSize: 24,
    color: TEXT_DARK,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: BG_LIGHT,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
})
