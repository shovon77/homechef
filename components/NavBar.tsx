// components/NavBar.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet, Image, useWindowDimensions } from 'react-native'
import { Link, useRouter, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'
import { NAVBAR_HEIGHT } from '../constants/layout'
import { theme } from '../lib/theme'

// Web-only imports for animations
let motion: any = null;
let Compass: any = null;
let Menu: any = null;
let X: any = null;
if (Platform.OS === 'web') {
  try {
    motion = require('framer-motion');
    const lucide = require('lucide-react');
    Compass = lucide.Compass;
    Menu = lucide.Menu;
    X = lucide.X;
  } catch (e) {
    // Fallback if not available
  }
}

// Colors matching homepage and navbar design
const PRIMARY_COLOR = '#FE734C';
const BG_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const BORDER_LIGHT = '#E5E7EB';
const MAXW = 1280; // max-w-7xl

// Generic NavButton component with animation support
function NavButton({ href, label, isActive, icon: Icon }: { href: string, label: string, isActive: boolean, icon?: any }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const activeColor = '#FE734C'; // Updated brand color

  // Web version with framer-motion animations
  if (Platform.OS === 'web' && motion) {
    const MotionDiv = motion.div;
    const MotionSpan = motion.span;
    
    // Merge all styles into single objects - NO arrays for DOM elements
    const linkStyle = { textDecoration: 'none', outline: 'none' };
    const containerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isMobile ? '4px' : '8px',
      paddingInline: isMobile ? '4px' : '10px',
      paddingBlock: '6px',
      borderRadius: '10px',
      position: 'relative',
      color: isActive ? activeColor : TEXT_DARK,
      cursor: 'pointer',
    };
    const textStyle = {
      fontWeight: '600',
      color: isActive ? activeColor : TEXT_DARK,
      fontFamily: theme.typography.fontFamily.body,
      fontSize: '14px',
    };
    const underlineStyle = {
      position: 'absolute',
      left: '8px',
      right: '8px',
      bottom: '-4px',
      height: '2.5px',
      borderRadius: '2px',
      background: 'linear-gradient(90deg, rgba(254,115,76,1) 0%, rgba(254,115,76,1) 100%)',
      pointerEvents: 'none' as const,
    };
    
    return (
      <Link href={href} style={linkStyle} aria-current={isActive ? 'page' : undefined} role="link">
        <MotionDiv
          initial={false}
          whileHover={{ scale: 1.05 }}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          style={containerStyle}
        >
          {Icon && <Icon size={18} strokeWidth={2.2} color={isActive ? activeColor : TEXT_DARK} />}
          <span style={textStyle}>{label}</span>
          <MotionSpan
            layoutId={`nav-underline-${label}`} // Unique layoutId per button
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
    <Link href={href} asChild>
      <TouchableOpacity 
        style={StyleSheet.flatten([
          styles.navLink,
          isMobile && { paddingHorizontal: 4, paddingVertical: 4 },
          isActive && { borderBottomWidth: 2, borderBottomColor: activeColor }
        ])}
      >
        <Text style={StyleSheet.flatten([
          styles.navLinkText, 
          isActive && { color: activeColor, fontWeight: '600' }
        ])}>
          {label}
        </Text>
      </TouchableOpacity>
    </Link>
  );
}

export default function NavBar() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isMobile = width < 768
  const { isAdmin, isChef, user, profile } = useRole()
  const { items } = useCart()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const pathname = usePathname?.() || '';
  const isExploreActive = pathname.startsWith('/browse') || pathname.startsWith('/explore');
  const isDashboardActive = pathname.startsWith('/admin') || pathname.startsWith('/chef');
  
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [hasReadyOrder, setHasReadyOrder] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Native Icon Fallbacks
  const MenuIcon = () => (
    <View style={{ width: 24, height: 24, justifyContent: 'space-around', paddingVertical: 4 }}>
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: '#FE734C', borderRadius: 1 }} />
    </View>
  )
  const CloseIcon = () => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: '#FE734C', transform: [{ rotate: '-45deg' }] }} />
    </View>
  )

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
      <View style={StyleSheet.flatten([styles.container, isMobile && styles.containerMobile])}>
        {/* Left Section: Logo */}
        <Link href="/" asChild>
          <TouchableOpacity 
            style={StyleSheet.flatten([styles.logoContainer, isMobile && styles.logoContainerMobile])}
            accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}
          >
            <Image 
              source={require('../assets/HClogo2.png')}
              style={StyleSheet.flatten([styles.logoImage, isMobile && styles.logoImageMobile])}
              resizeMode="contain"
            />
            <Text style={StyleSheet.flatten([styles.logoText, isMobile && styles.logoTextMobile])}>
              <Text style={{ color: '#33393A' }}>Your</Text>
              <Text style={{ color: '#FE734C' }}>HomeChef</Text>
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Center Section: Navigation */}
        <View style={StyleSheet.flatten([styles.navCenter, isMobile && styles.navCenterMobile])}>
          <NavButton href="/browse" label="Explore" isActive={isExploreActive} icon={Compass} />
          {hasActiveOrder ? (
            <Link href="/orders/track" asChild>
              <TouchableOpacity style={StyleSheet.flatten([styles.navLink, { flexDirection: 'row', alignItems: 'center', gap: 6 }])}>
                <Text style={StyleSheet.flatten([styles.navLinkText, { fontWeight: '700' }])}>{isMobile ? '' : 'Track Order'}</Text>
                {hasReadyOrder ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR }} /> : null}
              </TouchableOpacity>
            </Link>
          ) : null}
          {/* Dashboard button: only show for admin or chef */}
          {(isAdmin || isChef) && (
            <NavButton 
              href={isAdmin ? '/admin' : '/chef'} 
              label={isAdmin ? (isMobile ? 'Dash' : 'Dashboard') : 'Sales'} 
              isActive={isDashboardActive} 
            />
          )}
        </View>

        {/* Right Section: Actions */}
        <View style={StyleSheet.flatten([styles.rightSection, isMobile && styles.rightSectionMobile])}>
          {isMobile ? (
            <>
              <Link href="/cart" asChild>
                <TouchableOpacity style={styles.cartButton}>
                  <Image 
                    source={require('../assets/shopping-cart.png')} 
                    style={styles.cartIconImage}
                    resizeMode="contain"
                  />
                  {cartQty > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartQty}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
              <TouchableOpacity 
                onPress={() => setIsMenuOpen(!isMenuOpen)}
                style={styles.iconButton}
              >
                {isMenuOpen ? (
                  Platform.OS === 'web' && X ? <X color="#FE734C" size={24} /> : <CloseIcon />
                ) : (
                  Platform.OS === 'web' && Menu ? <Menu color="#FE734C" size={24} /> : <MenuIcon />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  // Role-aware profile routing
                  if (isAdmin) {
                        router.push('/profile');
                  } else if (isChef) {
                        // Navigate to the Profile tab in the Chef Dashboard
                        router.push('/chef?tab=profile');
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
              <Link href="/auth" asChild>
                  <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Login</Text>
                </TouchableOpacity>
              </Link>
          )}

          <Link href="/cart" asChild>
            <TouchableOpacity style={styles.cartButton}>
              <Image 
                source={require('../assets/shopping-cart.png')} 
                style={styles.cartIconImage}
                resizeMode="contain"
              />
              {cartQty > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartQty}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
            </>
          )}
        </View>
      </View>

      {isMobile && loggedIn && profile?.location ? (
        <View style={styles.mobileLocationBar}>
          <Image 
            source={require('../design/placeholder.png')} 
            style={styles.mobileLocationIcon} 
            resizeMode="contain" 
          />
          <Text style={styles.mobileLocationText} numberOfLines={1}>
            {profile.location}
          </Text>
        </View>
      ) : null}

      {/* Mobile Menu Overlay */}
      {isMobile && isMenuOpen && (
        <View style={styles.mobileMenu}>
          {loggedIn ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setIsMenuOpen(false);
                  if (isAdmin) {
                    router.push('/profile');
                  } else if (isChef) {
                    router.push('/chef?tab=profile');
                  } else {
                    router.push('/profile');
                  }
                }}
                style={styles.mobileMenuItem}
              >
                <Image source={require('../assets/user.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Profile</Text>
              </TouchableOpacity>
              

              <TouchableOpacity
                onPress={async () => { 
                  setIsMenuOpen(false);
                  await supabase.auth.signOut(); 
                  router.push('/auth');
                }}
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
              >
                <Image source={require('../assets/logout.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={StyleSheet.flatten([styles.mobileMenuText, { color: '#FE734C' }])}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Link href="/auth" asChild>
              <TouchableOpacity 
                style={StyleSheet.flatten([styles.mobileMenuItem, { borderBottomWidth: 0 }])}
                onPress={() => setIsMenuOpen(false)}
              >
                {/* Assuming user icon for login or could import another one */}
                 <Image source={require('../assets/user.png')} style={styles.menuIcon} resizeMode="contain" />
                <Text style={styles.mobileMenuText}>Login</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    ...Platform.select({
      web: {
        zIndex: 1000,
        backgroundColor: BG_LIGHT,
      },
      default: {
        backgroundColor: BG_LIGHT,
      },
    }),
    borderBottomWidth: 1,
    borderBottomColor: '#FE734C',
  },
  container: {
    width: '100%',
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    tintColor: '#FE734C',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#33393A',
    letterSpacing: -0.015,
    lineHeight: 28,
    fontFamily: theme.typography.fontFamily.display,
  },
  navCenter: {
    ...Platform.select({
      web: {
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: '-50%' }],
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
    fontFamily: theme.typography.fontFamily.body,
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
    backgroundColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.015,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  secondaryButton: {
    minWidth: 84,
    maxWidth: 480,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FE734C',
    borderWidth: 1,
    borderColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.015,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
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
  cartIconImage: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
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
    fontFamily: theme.typography.fontFamily.body,
  },
  // Mobile styles
  containerMobile: {
    paddingHorizontal: 8,
  },
  logoContainerMobile: {
    gap: 4,
    marginLeft: -4, // Pull logo slightly left
  },
  logoImageMobile: {
    width: 24,
    height: 24,
  },
  logoTextMobile: {
    fontSize: 14,
    lineHeight: 20,
  },
  navCenterMobile: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  rightSectionMobile: {
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
  },
  iconButtonImage: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
  },
  secondaryButtonMobile: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FE734C',
    borderWidth: 1,
    borderColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileMenu: {
    position: 'absolute',
    top: NAVBAR_HEIGHT,
    right: 0,
    width: '50%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_LIGHT,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
      web: { boxShadow: '-4px 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    }),
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: '#FE734C',
  },
  mobileMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.body,
  },
  mobileLocationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    gap: 4,
    width: '100%',
  },
  mobileLocationIcon: {
    width: 14,
    height: 14,
    tintColor: '#FE734C',
  },
  mobileLocationText: {
    fontSize: 12,
    color: '#33393A',
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
  },
})
