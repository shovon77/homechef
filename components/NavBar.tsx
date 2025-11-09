// components/NavBar.tsx
'use client'
import React from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'

// Colors matching homepage and navbar design
const PRIMARY_COLOR = '#2C4E4B';
const BG_LIGHT = '#FFFFFF';
const TEXT_DARK = '#0e1b18';
const BORDER_LIGHT = '#E5E7EB';
const MAXW = 1280; // max-w-7xl

export default function NavBar() {
  const router = useRouter()
  const { isAdmin, isChef, user } = useRole()
  const { items } = useCart()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        {/* Left Section: Logo */}
        <Link href="/" asChild>
          <TouchableOpacity 
            style={styles.logoContainer}
            accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}
          >
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>🍽️</Text>
            </View>
            <Text style={styles.logoText}>HomeChef</Text>
          </TouchableOpacity>
        </Link>

        {/* Center Section: Navigation */}
        <View style={styles.navCenter}>
          <Link href="/browse" asChild>
            <TouchableOpacity style={styles.navLink}>
              <Text style={styles.navLinkText}>Explore</Text>
            </TouchableOpacity>
          </Link>
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
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
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
  logoIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    fontSize: 24,
    color: PRIMARY_COLOR,
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
