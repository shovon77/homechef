<<<<<<< HEAD
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { theme } from "../../constants/theme";
import { cart } from "../../lib/cart";

const CONTAINER_MAX_WIDTH = 1200;

export default function NavBar() {
  const router = useRouter();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const updateCount = () => setItemCount(cart.get().length);
    updateCount();
    const interval = setInterval(updateCount, 500);
    return () => clearInterval(interval);
  }, []);
=======
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
>>>>>>> origin/main

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

<<<<<<< HEAD
          {/* Middle: Links */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
            <Link href="/" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Home</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/dishes" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Browse</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/chefs" asChild>
              <TouchableOpacity style={linkBtnStyle()}>
                <Text style={linkTextStyle()}>Chefs</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Right: Auth + Cart */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Link href="/login" asChild>
              <TouchableOpacity style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Login</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/signup" asChild>
              <TouchableOpacity style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: theme.colors.primary,
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Sign up</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/cart" asChild>
              <TouchableOpacity style={{
                position: "relative",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 16 }}>🛒</Text>
                {itemCount > 0 && (
                  <View style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: theme.colors.white, fontWeight: "900", fontSize: 11 }}>
                      {itemCount > 99 ? "99+" : itemCount}
                    </Text>
                  </View>
                )}
=======
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
>>>>>>> origin/main
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  )
}
