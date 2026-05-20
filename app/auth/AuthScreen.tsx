'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Animated, Easing, Image, Alert, useWindowDimensions } from 'react-native';
import { useRouter, Link, usePathname, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';
import { getAuthRedirect, getPasswordResetRedirect, goToPasswordResetScreen, redirectAfterLogin } from '../../lib/authRedirect';
import {
  clearPendingPasswordReset,
  hasPendingPasswordReset,
  markPendingPasswordReset,
} from '../../lib/passwordResetSession';
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
  brandBlack: '#33393A',
};

export type AuthScreenProps = {
  initialMode: 'signin' | 'signup';
};

export default function AuthScreen({ initialMode }: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams<{ mode?: string; auth_error?: string; auth_message?: string }>();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  // Button press animation
  const googleButtonScale = useRef(new Animated.Value(1)).current;

  const { loading, user, isChef, isAdmin, role } = useRole();

  const normalizeEmail = (v: string) => String(v || '').trim().toLowerCase();
  const emailNormalized = useMemo(() => normalizeEmail(email), [email]);
  const isPasswordResetMode = useMemo(() => {
    if (initialMode !== 'signin') return false;
    const raw = searchParams.mode;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === 'reset' || hasPendingPasswordReset();
  }, [initialMode, searchParams.mode]);
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
    // 5 criteria: 8+ chars, uppercase, lowercase, number, symbol
    const count =
      (passwordPolicy.minLenOk ? 1 : 0) +
      (passwordPolicy.hasLower ? 1 : 0) +
      (passwordPolicy.hasUpper ? 1 : 0) +
      (passwordPolicy.hasNumber ? 1 : 0) +
      (passwordPolicy.hasSymbol ? 1 : 0);
    const pct = (count / 5) * 100;
    const label =
      count === 5 ? 'Strong' :
      count === 4 ? 'Good' :
      count === 3 ? 'Fair' :
      count === 2 ? 'Weak' :
      count === 1 ? 'Very weak' : '';
    const color =
      count === 5 ? '#16A34A' :
      count >= 4 ? '#22C55E' :
      count >= 3 ? '#F59E0B' :
      '#EF4444';
    return { count, pct, label, color };
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

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const rawMsg = searchParams.auth_message;
    const message = Array.isArray(rawMsg) ? rawMsg[0] : rawMsg;
    if (message) {
      setErr(decodeURIComponent(message));
    }
  }, [searchParams.auth_message]);

  useEffect(() => {
    if (!isPasswordResetMode) {
      setRecoveryChecked(false);
      setHasRecoverySession(false);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setHasRecoverySession(Boolean(session?.user));
      setRecoveryChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isPasswordResetMode]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY' || initialMode !== 'signin') return;
      if (hasPendingPasswordReset()) return;
      markPendingPasswordReset();
      goToPasswordResetScreen();
    });
    return () => subscription.unsubscribe();
  }, [initialMode]);

  // Only redirect if user is logged in AND we're actually on the auth page
  // This prevents background redirects when token refreshes occur
  useEffect(() => {
    const customerAuthPaths = new Set([
      '/auth',
      '/auth/',
      '/login',
      '/login/',
      '/signup',
      '/signup/',
    ]);
    const isOnAuthPage = pathname != null && customerAuthPaths.has(pathname);
    if (!loading && user && isOnAuthPage && !isPasswordResetMode) {
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
  }, [loading, user, isChef, isAdmin, role, pathname, isPasswordResetMode]);

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

      if (mode === 'signup') {
        const fn = firstName.trim();
        const ln = lastName.trim();
        if (!fn || !ln) {
          setErr('Please enter your first name and last name.');
          return;
        }
        if (!passwordPolicy.meets) {
          setErr('Please choose a stronger password that meets the requirements below.');
          return;
        }
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: emailNormalized, password });
        if (error) throw error;
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const phoneVal = phone.trim();
        const res = await ensureUser({
          ...(fullName ? { name: fullName } : {}),
          ...(phoneVal ? { phone: phoneVal } : {}),
        });
        if (res?.error) console.warn('ensureUser:', res.error);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailNormalized, password });
        if (error) throw error;
        const res = await ensureUser();
        if (res?.error) console.warn('ensureUser:', res.error);
      }
      
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

  async function doUpdatePassword() {
    setErr(null);
    setBusy(true);
    try {
      if (!passwordPolicy.meets) {
        setErr('Please choose a stronger password that meets the requirements below.');
        return;
      }
      if (password !== confirmPassword) {
        setErr('Passwords do not match.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPendingPasswordReset();
      const res = await ensureUser();
      if (res?.error) console.warn('ensureUser:', res.error);
      Alert.alert('Password updated', 'Your password has been saved. Taking you to the app…', [
        {
          text: 'OK',
          onPress: () => redirectAfterLogin({ is_admin: isAdmin, is_chef: isChef, role }),
        },
      ]);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doResetPassword() {
    if (!emailIsValid) {
      Alert.alert('Error', 'Please enter a valid email address first.');
      return;
    }

    setResettingPassword(true);
    setErr(null);
    try {
      const redirectTo = getPasswordResetRedirect();
      const { error } = await supabase.auth.resetPasswordForEmail(emailNormalized, {
        redirectTo,
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

  if (loading && !user && !isPasswordResetMode) {
    // Initial load state, keep blank or spinner
    return null;
  }

  const inputStyle = {
    backgroundColor: '#FAFCFB' as const,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    padding: 12,
    borderRadius: 12,
    fontFamily: theme.typography.fontFamily.body,
    ...Platform.select({
      web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any },
      default: {},
    }),
  };

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
        // Match spacing below widget to spacing above
        marginBottom: 8,
        gap:16
      }}>
        {isPasswordResetMode ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', fontFamily: theme.typography.fontFamily.display, marginBottom: 2 }}>
              Set a new password
            </Text>
            <Text style={{ color: C.subtext, fontFamily: theme.typography.fontFamily.body, marginBottom: 8 }}>
              Choose a strong password for your account.
            </Text>

            {!recoveryChecked ? null : !hasRecoverySession ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: C.subtext, fontFamily: theme.typography.fontFamily.body }}>
                  This reset link is invalid or has expired. Request a new link from the login page.
                </Text>
                <TouchableOpacity
                  testID="auth-reset-back"
                  onPress={() => router.replace('/login')}
                  style={{ alignSelf: 'center', paddingVertical: 10 }}
                >
                  <Text style={{ color: C.primary, fontFamily: theme.typography.fontFamily.body }}>Back to login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: C.subtext, fontWeight: '700', fontFamily: theme.typography.fontFamily.display }}>New password</Text>
                  <TextInput
                    testID="auth-reset-password"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder={passwordFocused ? '' : '••••••••'}
                    secureTextEntry
                    style={inputStyle}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: C.subtext, fontWeight: '700', fontFamily: theme.typography.fontFamily.display }}>Confirm password</Text>
                  <TextInput
                    testID="auth-reset-confirm"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    style={inputStyle}
                  />
                </View>
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
                      {passwordPolicy.len > 0 ? `${passwordStrength.count}/5` : ' '}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <TouchableOpacity
                    testID="auth-reset-submit"
                    onPress={doUpdatePassword}
                    disabled={busy || passwordStrength.count < 5}
                    style={{
                      backgroundColor: busy ? '#FFCCBC' : passwordStrength.count < 5 ? '#D1D5DB' : C.primary,
                      paddingVertical: 13,
                      paddingHorizontal: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      minWidth: 160,
                    }}
                  >
                    <Text style={{ color: passwordStrength.count < 5 ? '#6B7280' : '#FFFFFF', fontWeight: '300' as any, fontFamily: theme.typography.fontFamily.body }}>
                      {busy ? 'Saving…' : 'Save password'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
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
              testID="auth-google"
              onPress={doGoogle}
              disabled={googleLoading}
              activeOpacity={0.7}
              style={{
                backgroundColor: googleLoading ? '#F5F5F5' : '#FFFFFF',
                borderWidth: 1, borderColor: '#F2F0EF',
                paddingVertical:12, paddingHorizontal:16,
                borderRadius:12, alignItems:'center',
                flexDirection:'row', justifyContent:'center', gap:10,
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
          <View style={{ flex:1, height:1, backgroundColor:'#FFFFFF' }} />
          <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>OR</Text>
          <View style={{ flex:1, height:1, backgroundColor:'#FFFFFF' }} />
        </View>

        {/* Email / Password */}
        <View style={{ gap:10 }}>
          {mode === 'signup' && (
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>First name</Text>
                <TextInput
                  testID="auth-first-name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  style={{
                    backgroundColor:'#FAFCFB',
                    borderWidth:1, borderColor:C.border,
                    color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body,
                    ...Platform.select({ web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any }, default: {} }),
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Last name</Text>
                <TextInput
                  testID="auth-last-name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  style={{
                    backgroundColor:'#FAFCFB',
                    borderWidth:1, borderColor:C.border,
                    color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body,
                    ...Platform.select({ web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any }, default: {} }),
                  }}
                />
              </View>
            </View>
          )}
          {mode === 'signup' && (
            <View style={{ gap: 6 }}>
              <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Phone number</Text>
              <TextInput
                testID="auth-phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={{
                  backgroundColor:'#FAFCFB',
                  borderWidth:1, borderColor:C.border,
                  color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body,
                  ...Platform.select({ web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any }, default: {} }),
                }}
              />
            </View>
          )}
          <View style={{ gap:6 }}>
            <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Email</Text>
            <TextInput
              testID="auth-email"
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
                color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body,
                ...Platform.select({ web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any }, default: {} }),
              }}
            />
            {mode === 'signin' && resetSentTo && resetSentTo === emailNormalized ? (
              <Text style={{ color: C.brandBlack, fontFamily: theme.typography.fontFamily.body, fontSize: 12 }}>
                A password reset email has been sent.
              </Text>
            ) : null}
          </View>

          {mode === 'signin' && (
            <View style={{ alignItems: 'flex-end', justifyContent: 'center', minHeight: 28 }}>
              <TouchableOpacity testID="auth-forgot-password" onPress={doResetPassword} disabled={resettingPassword}>
                <Text style={{ color: C.brandBlack, fontSize: 12, fontFamily: theme.typography.fontFamily.body }}>
                  {resettingPassword ? 'Sending...' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ gap:6 }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={{ color:C.subtext, fontWeight:'700', fontFamily: theme.typography.fontFamily.display }}>Password</Text>
            </View>
            <TextInput
              testID="auth-password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder={passwordFocused ? '' : '••••••••'}
              secureTextEntry
              style={{
                backgroundColor:'#FAFCFB',
                borderWidth:1, borderColor:C.border,
                color:C.text, padding:12, borderRadius:12, fontFamily: theme.typography.fontFamily.body,
                ...Platform.select({ web: { outlineStyle: 'none' as any, outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' as any }, default: {} }),
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
                    {passwordPolicy.len > 0 ? `${passwordStrength.count}/5` : ' '}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ gap: 4, alignItems: 'center', paddingVertical: 10 }}>
            <TouchableOpacity
              testID="auth-submit"
              onPress={doEmailPassword}
              disabled={busy || (mode === 'signup' && passwordStrength.count < 5)}
              style={{
                backgroundColor: busy ? '#FFCCBC' : (mode === 'signup' && passwordStrength.count < 5) ? '#D1D5DB' : C.primary,
                paddingVertical:13, 
                paddingHorizontal:24,
                borderRadius:12, 
                alignItems:'center',
                alignSelf: 'center',
                minWidth: 120,
                maxWidth: 200,
              }}>
              <Text style={{ color: (mode === 'signup' && passwordStrength.count < 5) ? '#6B7280' : '#FFFFFF', fontWeight:'300' as any, fontFamily: theme.typography.fontFamily.body }}>
                {busy ? 'Please wait…' : (mode === 'signin' ? 'Login' : 'Sign-up')}
              </Text>
            </TouchableOpacity>

            {/* Toggle sign-in / sign-up */}
            <TouchableOpacity
              testID="auth-toggle"
              onPress={() => {
                if (mode === 'signin') router.replace('/signup');
                else router.replace('/login');
              }}
            >
              <Text style={{ color: C.primary, textAlign:'center', fontFamily: theme.typography.fontFamily.body }}>
                {mode === 'signin' ? 'New to YourHomeChef? Sign-up.' : 'Already have a profile? Login.'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms of Service - tight spacing from toggle */}
          <Text style={{ color:C.subtext, fontSize:12, textAlign:'center', marginTop: -6, fontFamily: theme.typography.fontFamily.body }}>
            By continuing, you agree to our{' '}
            <Link href="/terms" asChild>
              <Text style={{ color:C.primary }}>Terms of Service</Text>
            </Link>
            .
          </Text>
        </View>
          </>
        )}

        {err ? <Text style={{ color:'tomato', marginTop:4, fontFamily: theme.typography.fontFamily.body }}>{err}</Text> : null}
      </Animated.View>
    </Screen>
  );
}
