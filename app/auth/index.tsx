'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Animated, Easing, Image, Alert } from 'react-native';
import { useRouter, Link, usePathname } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';
import { getAuthRedirect, getEmailRedirect } from '../../lib/authRedirect';
import { redirectAfterLogin } from '../../lib/authRedirect';
import Screen from '../../components/Screen';
import { useRole } from '../../hooks/useRole';
import { theme } from '../../lib/theme';

const INVALID_CREDENTIALS_MESSAGE = 'Inavlid email/password provided';

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
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Button press animation
  const googleButtonScale = useRef(new Animated.Value(1)).current;

  const { loading, user, isChef, isAdmin, role } = useRole();

  const normalizeEmail = (v: string) => String(v || '').trim().toLowerCase();
  const emailNormalized = useMemo(() => normalizeEmail(email), [email]);
  const emailIsValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized),
    [emailNormalized]
  );

  const getPasswordPolicy = (pwd: string) => {
    const p = String(pwd || '');
    const hasLower = /[a-z]/.test(p);
    const hasUpper = /[A-Z]/.test(p);
    const hasNumber = /\d/.test(p);
    const hasSymbol = /[^A-Za-z0-9]/.test(p);
    const len = p.length;
    const minLenOk = len >= 8;
    const meets = minLenOk && hasLower && hasUpper && hasNumber && hasSymbol;
    return { len, minLenOk, hasLower, hasUpper, hasNumber, hasSymbol, meets };
  };

  const passwordPolicy = useMemo(() => getPasswordPolicy(password), [password]);
  const passwordStrength = useMemo(() => {
    // Score out of 5: length + 4 character classes
    const classes =
      (passwordPolicy.hasLower ? 1 : 0) +
      (passwordPolicy.hasUpper ? 1 : 0) +
      (passwordPolicy.hasNumber ? 1 : 0) +
      (passwordPolicy.hasSymbol ? 1 : 0);
    const lenScore = passwordPolicy.len >= 12 ? 1 : passwordPolicy.len >= 8 ? 0.6 : passwordPolicy.len >= 6 ? 0.3 : 0;
    const raw = (classes / 4) * 0.8 + lenScore * 0.2; // 0..1
    const pct = Math.round(raw * 100);
    const label =
      pct >= 80 ? 'Strong' :
      pct >= 60 ? 'Good' :
      pct >= 40 ? 'Weak' :
      passwordPolicy.len > 0 ? 'Very weak' : '';
    const color =
      pct >= 80 ? '#16A34A' :
      pct >= 60 ? '#22C55E' :
      pct >= 40 ? '#F59E0B' :
      '#EF4444';
    return { pct, label, color };
  }, [passwordPolicy]);

  const isInvalidCredentialsError = (e: any) => {
    const msg = String(e?.message || '');
    return (
      /invalid\s+login\s+credentials/i.test(msg) ||
      /invalid\s+email\s*\/?\s*password/i.test(msg) ||
      /invalid\s+email\s+or\s+password/i.test(msg) ||
      e?.status === 400
    );
  };

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
      // Always check session exists before redirecting to avoid logout loop
      // This prevents redirecting during logout when context still has cached user
      // Add a delay to give time for logout to complete
      const timeoutId = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          // Only redirect if session actually exists and is valid
          // Check multiple times to ensure we're not redirecting during logout
          if (session && session.user && session.access_token) {
            // Double-check after another small delay to ensure session is stable
            setTimeout(() => {
              supabase.auth.getSession().then(({ data: { session: checkSession } }) => {
                if (checkSession && checkSession.user && checkSession.access_token) {
                  redirectAfterLogin({ is_admin: isAdmin, is_chef: isChef, role });
                }
              });
            }, 200);
          }
        });
      }, 800); // Wait 800ms to give logout time to clear session
      
      return () => clearTimeout(timeoutId);
    }
  }, [loading, user, isChef, isAdmin, role, pathname]);

  async function doGoogle() {
    setErr(null);
    setGoogleLoading(true);
    
    // Animate button press
    Animated.sequence([
      Animated.timing(googleButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(googleButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
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
      if (!emailIsValid) {
        setErr('Please enter a valid email address.');
        return;
      }

      if (mode === 'signup' && !passwordPolicy.meets) {
        setErr('Please choose a stronger password that meets the requirements below.');
        return;
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: emailNormalized, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailNormalized, password });
        if (error) throw error;
      }
      const res = await ensureUser();
      if (res?.error) console.warn('ensureUser:', res.error);
      
      // Redirect will be handled by useEffect
    } catch (e:any) {
      if (mode === 'signin' && isInvalidCredentialsError(e)) {
        setErr(INVALID_CREDENTIALS_MESSAGE);
      } else {
        setErr(e.message || String(e));
      }
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

      // Show inline confirmation under the email field (only for the current email).
      setResetSentTo(emailNormalized);
      
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for a password reset link. Click the link to reset your password.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      setResetSentTo(null);
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
      fixedFooterHeight={72}
    >
      <Animated.View style={{
        transform:[{ translateY: cardSlide }],
        opacity: cardOp,
        width:'100%', maxWidth:480,
        backgroundColor:C.panel,
        borderWidth:1, borderColor:C.border,
        borderRadius:18, padding:24,
        // Keep the card above the footer overlap area
        marginBottom: Platform.select({ web: 28, default: 44 }),
        ...Platform.select({
          web: { boxShadow: '0 8px 14px rgba(0,0,0,0.08)' },
          ios: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:14, shadowOffset:{width:0,height:8} },
          android: { elevation:2 },
          default: { elevation:2 },
        }),
        gap:16
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
          <Animated.View style={{ transform: [{ scale: googleButtonScale }] }}>
            <TouchableOpacity
              onPress={doGoogle}
              disabled={googleLoading}
              activeOpacity={0.7}
              style={{
                backgroundColor: googleLoading ? '#F5F5F5' : '#FFFFFF',
                borderWidth:1, borderColor:C.border,
                paddingVertical:12, paddingHorizontal:16,
                borderRadius:12, alignItems:'center',
                flexDirection:'row', justifyContent:'center', gap:10,
                ...Platform.select({
                  web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
                  ios: { shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2} },
                  android: { elevation:1 },
                  default: { elevation:1 },
                }),
                opacity: googleLoading ? 0.7 : 1,
              }}>
              <Image
                source={{ uri:'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                style={{ width:18, height:18 }}
              />
              <Text style={{ color:C.text, fontWeight:'800', fontFamily: theme.typography.fontFamily.display }}>
                {googleLoading ? 'Continuing...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
              onChangeText={(v) => {
                setEmail(v);
                // Hide the "sent" message when the email changes.
                const next = normalizeEmail(v);
                if (resetSentTo && resetSentTo !== next) setResetSentTo(null);
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor:'#FAFCFB',
                borderWidth:1, borderColor:C.border,
                color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body
              }}
            />
            {mode === 'signin' && resetSentTo && resetSentTo === emailNormalized ? (
              <Text style={{ color: '#33393A', fontFamily: theme.typography.fontFamily.body, fontSize: 12 }}>
                A password reset email has been sent.
              </Text>
            ) : null}
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
            {mode === 'signup' && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.subtext, fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>
                  Use at least 8 characters, including an uppercase letter, lowercase letter, number, and symbol.
                </Text>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${passwordStrength.pct}%`, backgroundColor: passwordStrength.color }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: passwordStrength.color, fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>
                    {passwordStrength.label ? `Strength: ${passwordStrength.label}` : ' '}
                  </Text>
                  <Text style={{ color: C.subtext, fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>
                    {passwordPolicy.len > 0 ? `${passwordPolicy.len}/8+` : ' '}
                  </Text>
                </View>
              </View>
            )}
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
