'use client';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureProfile } from '../../lib/ensureProfile';
import { ensureSession } from '../../lib/session';
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
  
  // Step 2 fields
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState('');
  const [specialties, setSpecialties] = useState('');
  
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [existingApplication, setExistingApplication] = useState<{ id: string; status: string } | null>(null);
  const [isAlreadyChef, setIsAlreadyChef] = useState(false);

  useEffect(() => {
    // Check if user is already logged in, if so get their email and check status
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        setEmail(data.user.email || '');
        
        // Check if user is already a chef
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_chef')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (profile?.is_chef) {
          setIsAlreadyChef(true);
          return;
        }
        
        // Check for existing application
        const { data: existingApp } = await supabase
          .from('chef_applications')
          .select('id, status')
          .eq('user_id', data.user.id)
          .eq('status', 'submitted')
          .maybeSingle();
        
        if (existingApp) {
          setExistingApplication(existingApp);
        }
      }
    });
  }, []);

  const canProceedToStep2 = fullName && email && password;
  const canSubmit = bio && location;

  function handleNext() {
    if (step === 1 && canProceedToStep2) {
      setStep(2);
    }
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      // Extract form values
      const name = fullName || businessName || 'Chef';
      const short_bio = bio || null;
      
      // 1) signUp or signIn
      const su = await supabase.auth.signUp({ email, password });
      
      if (su.error && !/registered/i.test(su.error.message ?? '')) {
        throw su.error;
      }
      
      if (su.error && /registered/i.test(su.error.message ?? '')) {
        const si = await supabase.auth.signInWithPassword({ email, password });
        if (si.error) throw si.error;
      }

      // 2) ensure session
      const session = await ensureSession(supabase, email, password);
      if (!session) {
        throw new Error('Session not established. Please sign in and try again.');
      }

      // 3) ensure profile
      const profileResult = await ensureProfile(supabase);
      if (!profileResult.ok) {
        console.warn('ensureProfile warning:', profileResult.error);
        // Continue anyway - profile might already exist
      }

      // 4) insert application
      const ins = await supabase
        .from('chef_applications')
        .insert([{
          user_id: session.user.id,
          name,
          email,
          phone: phone || null,
          location: location || null,
          short_bio,
          experience: experience || null,
          cuisine_specialty: specialties || null,
          status: 'submitted',
        }])
        .select('id')
        .single();

      if (ins.error) throw ins.error;
      if (!ins.data?.id) throw new Error('Failed to create application');

      // 5) go to submitted page
      router.replace(`/chef-apply/submitted?id=${ins.data.id}`);
    } catch (e: any) {
      console.error('Chef application submit failed:', e);
      const errorMsg = e?.message || 'Could not submit application';
      Alert.alert('Error', errorMsg);
      setMsg(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  const progress = step === 1 ? 50 : 100; // Step 1 of 2 = 50%, Step 2 of 2 = 100%
  const stepTitle = step === 1 ? 'Personal Info' : 'About You';

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            {/* Safety Checks */}
            {isAlreadyChef && (
              <View style={styles.noticeBanner}>
                <Text style={styles.noticeText}>You're already a chef.</Text>
                <TouchableOpacity onPress={() => router.push('/chef')}>
                  <Text style={styles.noticeLink}>Go to Chef Dashboard →</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {existingApplication && !isAlreadyChef && (
              <View style={styles.noticeBanner}>
                <Text style={styles.noticeText}>
                  Your request is under review (ID: {existingApplication.id.substring(0, 8)}...). We'll notify you when it's approved.
                </Text>
                <TouchableOpacity onPress={() => router.push(`/chef-apply/submitted?id=${existingApplication.id}`)}>
                  <Text style={styles.noticeLink}>View Application →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>Step {step} of 2: {stepTitle}</Text>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>

            <View style={styles.form}>
              {step === 1 ? (
                <>
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
                      style={[styles.nextButton, (!canProceedToStep2 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep2 || busy}
                    >
                      <Text style={styles.nextButtonText}>Next Step</Text>
                      <Text style={styles.nextButtonIcon}>→</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Step 2: About You */}
                  <Text style={styles.sectionTitle}>Tell Us About Yourself</Text>

                  <View style={styles.formGrid}>
                    {/* Location Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Location *</Text>
                      </View>
                      <TextInput
                        value={location}
                        onChangeText={setLocation}
                        placeholder="City, State (e.g., San Francisco, CA)"
                        style={styles.input}
                        autoCapitalize="words"
                      />
                    </View>

                    {/* Bio Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Short Bio *</Text>
                      </View>
                      <TextInput
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about your cooking background, specialties, and what makes your food special..."
                        style={[styles.input, styles.textArea]}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>

                    {/* Experience Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Cooking Experience (Optional)</Text>
                      </View>
                      <TextInput
                        value={experience}
                        onChangeText={setExperience}
                        placeholder="e.g., 10 years of home cooking, professional chef, etc."
                        style={styles.input}
          />
        </View>

                    {/* Specialties Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Cuisine Specialties (Optional)</Text>
                      </View>
                      <TextInput
                        value={specialties}
                        onChangeText={setSpecialties}
                        placeholder="e.g., Italian, Mexican, Asian Fusion, Vegan"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.backButton, busy && styles.backButtonDisabled]}
                      onPress={handleBack}
                      disabled={busy}
                    >
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canSubmit || busy) && styles.nextButtonDisabled]}
                      onPress={submit}
                      disabled={!canSubmit || busy}
                    >
                      <Text style={styles.nextButtonText}>
                        {busy ? 'Submitting…' : 'Submit Application'}
                      </Text>
        </TouchableOpacity>
                  </View>
                </>
              )}

              {msg && (
                <Text style={[styles.message, msg.startsWith('Thanks') ? styles.messageSuccess : styles.messageError]}>
                  {msg}
                </Text>
              )}
            </View>
      </View>
    </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.md,
    }),
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
    width: '100%',
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
  textArea: {
    height: 120,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  trustIcon: {
    fontSize: theme.typography.fontSize.base,
    marginRight: theme.spacing.xs,
  },
  trustText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: BACKGROUND_LIGHT,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  backButtonDisabled: {
    opacity: 0.6,
  },
  backButtonText: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
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
    flex: 1,
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
  noticeBanner: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  noticeText: {
    color: '#92400e',
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  noticeLink: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold as any,
    textDecorationLine: 'underline',
  },
});
