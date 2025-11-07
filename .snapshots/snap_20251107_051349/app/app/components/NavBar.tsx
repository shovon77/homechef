// app/components/NavBar.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { theme } from '../../constants/theme'   // ✅ from app/components -> ../../constants
import { supabase } from '../../lib/supabase'   // ✅ from app/components -> ../../lib

const MAXW = 1200

export default function NavBar() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      const em = data.session?.user?.email ?? null
      setEmail(em)
      if (em && data.session?.user?.id) {
        const prof = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle()
        setRole(prof.data?.role ?? null)
      } else {
        setRole(null)
      }
    }
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const loggedIn = !!email

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
              { href:'/chefs', label:'Chefs' },
              { href:'/dishes', label:'Dishes' },
            ].map(i => (
              <Link key={i.href} href={i.href} asChild>
                <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:10, borderRadius:8 }}>
                  <Text style={{ color: theme.colors.textMuted, fontWeight:'700' }}>{i.label}</Text>
                </TouchableOpacity>
              </Link>
            ))}
            <TouchableOpacity onPress={() => router.push('/chef/dashboard')} style={{ paddingVertical:8, paddingHorizontal:10, borderRadius:8 }}>
              <Text style={{ color: theme.colors.textMuted, fontWeight:'700' }}>Dashboard</Text>
            </TouchableOpacity>
          </View>

          {/* Right */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            {loggedIn ? (
              <>
                <TouchableOpacity
                  onPress={() => router.push(role === 'admin' ? '/admin' : '/chef/dashboard')}
                  style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor: theme.colors.primary }}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontWeight:'800' }}>
                    {role === 'admin' ? 'Admin' : 'Profile'}
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
                <Link href="/signup" asChild>
                  <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor: theme.colors.primary }}>
                    <Text style={{ color: theme.colors.onPrimary, fontWeight:'800' }}>Sign up</Text>
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
              <TouchableOpacity style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}>
                <Text style={{ color: theme.colors.text, fontWeight:'800' }}>Cart</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  )
}
