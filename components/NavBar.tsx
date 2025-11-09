// components/NavBar.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { theme } from '../lib/theme'
import { supabase } from '../lib/supabase'     // components -> ../lib
import { useRole } from '../hooks/useRole'
import { useCart } from '../context/CartContext'

const MAXW = 1200

export default function NavBar() {
  const router = useRouter()
  const { role, isAdmin, isChef, user } = useRole()
  const { items } = useCart()
  const loggedIn = !!user
  const cartQty = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <View style={{ width:'100%', backgroundColor: theme.colors.surface, borderBottomWidth:1, borderBottomColor: theme.colors.border }}>
      <View style={{ width:'100%', maxWidth: MAXW, alignSelf:'center', paddingHorizontal:16, paddingVertical:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          {/* Brand */}
          <Link href="/" asChild>
            <TouchableOpacity accessibilityRole={Platform.OS === 'web' ? 'link' : undefined}>
              <Text style={{ color: theme.colors.brandText, fontSize:18, fontWeight:'900', letterSpacing:0.2 }}>
                HomeChef
              </Text>
            </TouchableOpacity>
          </Link>

          {/* Middle */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            {[
              { href:'/', label:'Home' },
              { href:'/browse', label:'Browse' },
            ].map(i => (
              <Link key={i.href} href={i.href} asChild>
                <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:10, borderRadius:8 }}>
                  <Text style={{ color: theme.colors.textMuted, fontWeight:'700' }}>{i.label}</Text>
                </TouchableOpacity>
              </Link>
            ))}
            {/* Dashboard button: only show for admin or chef */}
            {(isAdmin || isChef) && (
              <TouchableOpacity 
                onPress={() => router.push(isAdmin ? '/admin' : '/chef')} 
                style={{ paddingVertical:8, paddingHorizontal:10, borderRadius:8 }}
              >
                <Text style={{ color: theme.colors.textMuted, fontWeight:'700' }}>Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            {loggedIn ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    // Role-aware profile routing
                    if (isAdmin) {
                      router.push('/admin/profile');
                    } else if (isChef) {
                      router.push('/chef/profile');
                    } else {
                      router.push('/profile');
                    }
                  }}
                  style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor: theme.colors.primary }}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontWeight:'800' }}>
                    Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await supabase.auth.signOut(); router.push('/auth') }}
                  style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight:'800' }}>Logout</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Link href="/auth/chef" asChild>
                  <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor: theme.colors.primary }}>
                    <Text style={{ color: theme.colors.onPrimary, fontWeight:'800' }}>Sign up as a Chef</Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/auth" asChild>
                  <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}>
                    <Text style={{ color: theme.colors.text, fontWeight:'800' }}>Login</Text>
                  </TouchableOpacity>
                </Link>
              </>
            )}

            <Link href="/cart" asChild>
              <TouchableOpacity style={{ 
                paddingVertical:8, 
                paddingHorizontal:12, 
                borderRadius:10, 
                borderWidth:1, 
                borderColor: theme.colors.border, 
                backgroundColor: theme.colors.surfaceAlt,
                position: 'relative',
              }}>
                <Text style={{ color: theme.colors.text, fontWeight:'800' }}>Cart</Text>
                {cartQty > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{cartQty}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  )
}
