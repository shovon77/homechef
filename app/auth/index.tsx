'use client';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Animated, Easing, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';
import { getAuthRedirect } from '../../lib/authRedirect';
import { redirectAfterLogin } from '../../lib/authRedirect';
import Screen from '../../components/Screen';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../lib/theme';

/** Light brand palette */
const C = {
  bg: '#F2F0EF',
  panel: '#FFFFFF',
  border: '#E3EEE8',
  text: '#0B1F17',
  subtext: '#555555',
  primary: '#FE734C',
  primaryHi: '#FE734C',
  link: '#FE734C',
};

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const { loading, user, isChef, isAdmin, role } = useRole();

  // Entrance animation
  const cardSlide = useRef(new Animated.Value(15)).current;
  const cardOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardSlide, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardOp, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      redirectAfterLogin({ is_admin: isAdmin, is_chef: isChef, role });
    }
  }, [loading, user, isChef, isAdmin, role]);

  async function doGoogle() {
    setErr(null);
    const redirectTo = getAuthRedirect();
    console.log('Google Auth Redirect:', redirectTo);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
  }

  async function doEmailPassword() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const res = await ensureUser();
      if (res?.error) console.warn('ensureUser:', res.error);
      
      // Redirect will be handled by useEffect
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !user) {
    // Initial load state, keep blank or spinner
    return null; 
  }

  return (
    <Screen 
      style={{ backgroundColor: C.bg }}
      contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <Animated.View style={{
        transform:[{ translateY: cardSlide }],
        opacity: cardOp,
        width:'100%', maxWidth:480,
        backgroundColor:C.panel,
        borderWidth:1, borderColor:C.border,
        borderRadius:18, padding:24,
        shadowColor:'#000', shadowOpacity:0.08, shadowRadius:14, shadowOffset:{width:0,height:8},
        elevation:2, gap:16
      }}>
        {/* Brand */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <Image 
            source={require('../../assets/HClogo2.png')}
            style={{ width:40, height:40, tintColor: C.primary }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 24, fontWeight: '900', fontFamily: theme.typography.fontFamily.display }}>
            <Text style={{ color: C.text }}>Your</Text>
            <Text style={{ color: C.primary }}>HomeChef</Text>
          </Text>
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#FE734C' }} />
          <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        </View>

        <Text style={{ color:C.text, fontSize:28, fontWeight:'900', fontFamily: theme.typography.fontFamily.display }}>
          {mode === 'signin' ? 'Welcome back' : 'Join HomeChef'}
        </Text>
        <Text style={{ color:C.subtext, fontFamily: theme.typography.fontFamily.body }}>
          {mode === 'signin'
            ? 'Log in to order homemade meals or list your own dishes.'
            : 'Create an account to order or become a chef and start selling.'}
        </Text>

        {/* Google Button with real icon */}
        <View>
          <TouchableOpacity
            onPress={doGoogle}
            activeOpacity={0.8}
            style={{
              backgroundColor:'#FFFFFF',
              borderWidth:1, borderColor:C.border,
              paddingVertical:12, paddingHorizontal:16,
              borderRadius:12, alignItems:'center',
              flexDirection:'row', justifyContent:'center', gap:10,
              shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2}
            }}>
            <Image
              source={{ uri:'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
              style={{ width:18, height:18 }}
            />
            <Text style={{ color:C.text, fontWeight:'800', fontFamily: theme.typography.fontFamily.display }}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <View style={{ flex:1, height:1, backgroundColor:C.border }} />
          <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>OR</Text>
          <View style={{ flex:1, height:1, backgroundColor:C.border }} />
        </View>

        {/* Email / Password */}
        <View style={{ gap:10 }}>
          <View style={{ gap:6 }}>
            <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor:'#FAFCFB',
                borderWidth:1, borderColor:C.border,
                color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body
              }}
            />
          </View>

          <View style={{ gap:6 }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Password</Text>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{
                backgroundColor:'#FAFCFB',
                borderWidth:1, borderColor:C.border,
                color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body
              }}
            />
          </View>

          <TouchableOpacity
            onPress={doEmailPassword}
            disabled={busy}
            style={{
              backgroundColor: busy ? '#FFCCBC' : C.primary,
              paddingVertical:13, borderRadius:12, alignItems:'center'
            }}>
            <Text style={{ color:'#FFFFFF', fontWeight:'900', fontFamily: theme.typography.fontFamily.display }}>
              {busy ? 'Please wait…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </Text>
          </TouchableOpacity>

          {/* Toggle sign-in / sign-up */}
          <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={{ color:C.link, textAlign:'center', marginTop:6, fontFamily: theme.typography.fontFamily.body }}>
              {mode === 'signin' ? 'New to HomeChef? Create an account' : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          {/* Chef sign-up */}
          <TouchableOpacity onPress={() => router.push('/auth/chef')} style={{ marginTop:6 }}>
            <Text style={{ color:C.text, textAlign:'center', fontFamily: theme.typography.fontFamily.body }}>
              Want to sell dishes? <Text style={{ color:C.primaryHi, fontWeight:'900', fontFamily: theme.typography.fontFamily.display }}>Sign up as a Chef</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {err ? <Text style={{ color:'tomato', marginTop:4, fontFamily: theme.typography.fontFamily.body }}>{err}</Text> : null}
      </Animated.View>
    </Screen>
  );
}
