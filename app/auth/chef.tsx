'use client';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';
import { Screen } from '../../components/Screen';
import { theme } from '../../lib/theme';

// Colors from HTML design
const PRIMARY_COLOR = '#2A9D8F';
const BACKGROUND_LIGHT = '#F4F4F4';
const CARD_LIGHT = '#FFFFFF';
const BORDER_LIGHT = '#e2e8f0';
const TEXT_LIGHT = '#264653';
const TEXT_MUTED = '#6b7280';

export default function ChefSignup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in, if so get their email
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email || '');
      } else {
        // If not logged in, allow them to proceed (they'll sign up during the process)
      }
    });
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      let user;
      
      // Check if user is already logged in
      const { data: existingUser } = await supabase.auth.getUser();
      
      if (!existingUser?.user) {
        // Create new account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) throw signUpError;
        if (!signUpData?.user) throw new Error('Failed to create account');
        
        user = signUpData.user;
      } else {
        user = existingUser.user;
      }

      // Ensure base rows exist
      await ensureUser();

      // Upsert chef profile
      await supabase.from('chefs').upsert({
        id: undefined,
        user_id: user.id,
        name: fullName || businessName || (user.user_metadata?.name || user.email?.split('@')[0]),
        phone: phone || null,
        is_active: false,
      });

      // Mark user/profile as is_chef
      await supabase.from('users').upsert({ id: user.id, is_chef: true }, { onConflict: 'id' });
      await supabase.from('profiles').upsert({ id: user.id, is_chef: true, role: 'chef' }, { onConflict: 'id' });

      setMsg('Thanks! Your chef profile was submitted. An admin will review it.');
      setTimeout(() => router.replace('/'), 2000);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const progress = 25; // Step 1 of 4

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <View style={styles.container}>
        {/* Page Heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>Become a HomeChef</Text>
          <Text style={styles.subtitle}>
            Join our community and start selling your delicious homemade meals.
          </Text>
        </View>

        {/* Main Form Container Card */}
        <View style={styles.card}>
          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Step {step} of 4: Personal Info</Text>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.form}>
            {/* Section Header */}
            <Text style={styles.sectionTitle}>Let's Get Started</Text>

            {/* Form Fields Grid */}
            <View style={styles.formGrid}>
              {/* Full Name Field */}
              <View style={styles.field}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>Full Name</Text>
                </View>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>

              {/* Business/Kitchen Name Field */}
              <View style={styles.field}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>Business / Kitchen Name</Text>
                </View>
                <TextInput
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="e.g., Jane's Kitchen"
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>

              {/* Email Field */}
              <View style={[styles.field, styles.fieldFull]}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>Email Address</Text>
                </View>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!busy}
                />
              </View>

              {/* Phone Number Field */}
              <View style={styles.field}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>Phone Number</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(123) 456-7890"
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Password Field */}
              <View style={[styles.field, styles.passwordField]}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>Password</Text>
                </View>
                <View style={styles.passwordContainer}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create a strong password"
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.passwordToggleIcon}>
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Trust Signal */}
            <View style={styles.trustSignal}>
              <Text style={styles.trustIcon}>🔒</Text>
              <Text style={styles.trustText}>Your data is secure and encrypted.</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.nextButton, busy && styles.nextButtonDisabled]}
                onPress={submit}
                disabled={busy || !fullName || !email || !password}
              >
                <Text style={styles.nextButtonText}>
                  {busy ? 'Submitting…' : 'Next Step'}
                </Text>
                <Text style={styles.nextButtonIcon}>→</Text>
              </TouchableOpacity>
            </View>

            {msg && (
              <Text style={[styles.message, msg.startsWith('Thanks') ? styles.messageSuccess : styles.messageError]}>
                {msg}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.md,
    }),
  },
  heading: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
    maxWidth: 800,
  },
  title: {
    color: TEXT_LIGHT,
    fontSize: Platform.select({ web: 48, default: 36 }),
    fontWeight: theme.typography.fontWeight.black as any,
    letterSpacing: -0.02,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.lg,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: CARD_LIGHT,
    borderRadius: theme.radius.xl,
    padding: Platform.select({ web: theme.spacing['2xl'], default: theme.spacing.lg }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressSection: {
    marginBottom: theme.spacing['2xl'],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  progressText: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
  },
  form: {
    gap: theme.spacing['2xl'],
  },
  sectionTitle: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  formGrid: {
    flexDirection: 'column',
    marginBottom: -theme.spacing.xl,
    ...Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
      },
    }),
  },
  field: {
    marginBottom: theme.spacing.xl,
    width: '100%',
    ...Platform.select({
      web: {
        width: '48%',
        marginRight: '4%',
      },
    }),
  },
  fieldLabel: {
    marginBottom: theme.spacing.sm,
  },
  fieldFull: {
    width: '100%',
    marginRight: 0,
    ...Platform.select({
      web: {
        width: '100%',
        marginRight: 0,
      },
    }),
  },
  label: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
  },
  input: {
    width: '100%',
    height: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_LIGHT,
    paddingHorizontal: theme.spacing.md,
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
  },
  passwordField: {
    width: '100%',
    ...Platform.select({
      web: {
        width: '48%',
        marginRight: '4%',
      },
    }),
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_LIGHT,
    paddingHorizontal: theme.spacing.md,
    paddingRight: 48,
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
  },
  passwordToggle: {
    position: 'absolute',
    right: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  passwordToggleIcon: {
    fontSize: 20,
    color: TEXT_MUTED,
  },
  trustSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  trustIcon: {
    fontSize: theme.typography.fontSize.base,
  },
  trustText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    height: 48,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.sm,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  nextButtonIcon: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  message: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  messageSuccess: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  messageError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
});
