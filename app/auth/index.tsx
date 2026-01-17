'use client';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Animated, Easing, Image, Alert } from 'react-native';
import { useRouter, Link, usePathname } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';
import { getAuthRedirect, getEmailRedirect } from '../../lib/authRedirect';
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
  const pathname = usePathname();
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

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

  // Only redirect if user is logged in AND we're actually on the auth page
  // This prevents background redirects when token refreshes occur
  useEffect(() => {
    const isOnAuthPage = pathname === '/auth' || pathname === '/auth/';
    if (!loading && user && isOnAuthPage) {
      // Double-check session exists before redirecting to avoid logout loop
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          redirectAfterLogin({ is_admin: isAdmin, is_chef: isChef, role });
        }
      });
    }
  }, [loading, user, isChef, isAdmin, role, pathname]);

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

  async function doResetPassword() {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address first.');
      return;
    }

    setResettingPassword(true);
    setErr(null);
    try {
      const redirectTo = getEmailRedirect();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });
      
      if (error) throw error;
      
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for a password reset link. Click the link to reset your password.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setResettingPassword(false);
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
        {/* Welcome Text */}
        <Text style={{ color:C.text, fontSize:28, fontWeight:'900', fontFamily: theme.typography.fontFamily.display, marginBottom: 2 }}>
          {mode === 'signin' ? (
            <>
              Welcome back<Text style={{ color:C.primary }}>!</Text>
            </>
          ) : (
            <>
              Welcome<Text style={{ color:C.primary }}>!</Text>
            </>
          )}
        </Text>
        {mode === 'signup' && (
          <Text style={{ color:C.subtext, fontFamily: theme.typography.fontFamily.body, marginBottom: 1 }}>
            Order homemade meals or share your dishes
          </Text>
        )}
        {mode === 'signin' && (
          <Text style={{ color:C.subtext, fontFamily: theme.typography.fontFamily.body, marginBottom: 16 }}>
            Continue ordering or managing your dishes
          </Text>
        )}

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
              {mode === 'signin' && (
                <TouchableOpacity onPress={doResetPassword} disabled={resettingPassword}>
                  <Text style={{ color:C.primary, fontSize:12, fontFamily: theme.typography.fontFamily.body, textDecorationLine: 'underline' }}>
                    {resettingPassword ? 'Sending...' : 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              )}
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
              paddingVertical:13, 
              paddingHorizontal:24,
              borderRadius:12, 
              alignItems:'center',
              alignSelf: 'center',
              minWidth: 120,
              maxWidth: 200
            }}>
            <Text style={{ color:'#FFFFFF', fontWeight:'900', fontFamily: theme.typography.fontFamily.display }}>
              {busy ? 'Please wait…' : (mode === 'signin' ? 'Login' : 'Sign-up')}
            </Text>
          </TouchableOpacity>

          {/* Toggle sign-in / sign-up */}
          <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={{ color:C.link, textAlign:'center', marginTop:6, fontFamily: theme.typography.fontFamily.body }}>
              {mode === 'signin' ? 'New to YourHomeChef? Sign-up' : 'Already have a profile? Login.'}
            </Text>
          </TouchableOpacity>
        </View>

        {err ? <Text style={{ color:'tomato', marginTop:4, fontFamily: theme.typography.fontFamily.body }}>{err}</Text> : null}

        {/* Terms of Service */}
        <Text style={{ color:C.subtext, fontSize:12, textAlign:'center', marginTop:16, fontFamily: theme.typography.fontFamily.body }}>
          By continuing, you agree to our{' '}
          <Link href="/terms" asChild>
            <Text style={{ color:C.primary, textDecorationLine: 'underline' }}>Terms of Service</Text>
          </Link>
          .
        </Text>
      </Animated.View>
    </Screen>
  );
}
