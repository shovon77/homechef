'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet, ScrollView, Alert, Modal, Image, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { ensureProfile } from '../../lib/ensureProfile';
import { ensureSession } from '../../lib/session';
import { Screen } from '../../components/Screen';
import { theme } from '../../lib/theme';
import LocationPicker from '../../components/LocationPicker';
import FilePicker from '../../components/FilePicker';
import { uploadToBucket } from '../../lib/upload';
import { createNotification } from '../../lib/notifications';

// Storage key for chef onboarding form data
const CHEF_FORM_STORAGE_KEY = 'chef_onboarding_form_data';

// Helper functions for cross-platform storage
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          return window.localStorage.getItem(key);
        }
        return null;
      } else {
        return await AsyncStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Storage getItem error:', e);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Storage setItem error:', e);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage removeItem error:', e);
    }
  },
};

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F4F4F4';
const CARD_LIGHT = '#FFFFFF';
const BORDER_LIGHT = '#e2e8f0';
const TEXT_LIGHT = '#264653';
const TEXT_MUTED = '#6b7280';

export default function ChefSignup() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [cuisineType, setCuisineType] = useState<string[]>([]);
  const [showCuisineDropdown, setShowCuisineDropdown] = useState(false);

  // Cuisine types list
  const cuisineTypes = [
    'Italian',
    'Mexican',
    'Chinese',
    'Japanese',
    'Thai',
    'Indian',
    'Bengali',
    'French',
    'Mediterranean',
    'American',
    'Asian Fusion',
    'Vegan',
    'Vegetarian',
    'BBQ',
    'Seafood',
    'Desserts',
    'Bakery',
    'Middle Eastern',
    'Korean',
    'Vietnamese',
    'Greek',
    'Spanish',
    'Caribbean',
    'Soul Food',
    'Cajun',
    'Other'
  ];
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailCheckUnavailable, setEmailCheckUnavailable] = useState(false);
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 2 fields - Availability & Pickup
  const [pickupSlots, setPickupSlots] = useState<Array<{ day: string; timeWindow: string }>>([]);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTimeWindows, setSelectedTimeWindows] = useState<string[]>([]);
  
  // Step 3 fields - Dish Management
  type DishItem = {
    id: string; // temporary ID for local state
    name: string;
    price: number;
    portion?: string;
    description?: string;
    ingredients?: string;
    image?: string; // preview URL
    file?: File | null;
  };
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [savingDish, setSavingDish] = useState(false);
  
  // Step 4 fields (formerly Step 3)
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [agreed, setAgreed] = useState(false);
  
  // Step 4 - Agreement checkboxes
  const [foodSafetyAcknowledged, setFoodSafetyAcknowledged] = useState(false);
  const [allergensDisclosed, setAllergensDisclosed] = useState(false);
  const [platformInspectionUnderstood, setPlatformInspectionUnderstood] = useState(false);
  
  // Terms modal state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsType, setTermsType] = useState<'agreement' | 'fee' | 'payout' | null>(null);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Track which agreements have been accepted
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [payoutAccepted, setPayoutAccepted] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const hasLoadedFromStorage = useRef(false);
  const [existingApplication, setExistingApplication] = useState<{ id: string; status: string } | null>(null);
  const [isAlreadyChef, setIsAlreadyChef] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loadingBanner, setLoadingBanner] = useState(true);

  const normalizeCanadianPhoneTenDigits = (input: string): string => {
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    if (digits.length === 10) return digits;
    return '';
  };

  // Canadian phone numbers are NANP (+1) numbers.
  // Enforce 10 digits with NANP rules: area code and exchange cannot start with 0/1.
  const isValidCanadianPhone = (input: string): boolean => {
    const ten = normalizeCanadianPhoneTenDigits(input);
    if (!ten) return false;
    const areaFirst = ten[0];
    const exchangeFirst = ten[3];
    if (!areaFirst || !exchangeFirst) return false;
    if (areaFirst < '2' || exchangeFirst < '2') return false;
    return true;
  };

  const phoneIsValid = useMemo(() => isValidCanadianPhone(phone), [phone]);
  const phoneE164 = useMemo(() => {
    const ten = normalizeCanadianPhoneTenDigits(phone);
    return ten ? `+1${ten}` : '';
  }, [phone]);

  const normalizeEmail = (v: string) => String(v || '').trim().toLowerCase();
  const isValidEmail = (v: string) => {
    const e = normalizeEmail(v);
    if (!e) return false;
    // Simple, pragmatic email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  };

  const emailNormalized = useMemo(() => normalizeEmail(email), [email]);
  const emailIsValid = useMemo(() => {
    if (isLoggedIn) return emailNormalized.length > 0;
    return isValidEmail(emailNormalized);
  }, [isLoggedIn, emailNormalized]);

  const emailOk = useMemo(() => {
    if (isLoggedIn) return emailIsValid;
    // If we can't validate existence due to permissions, fall back to format-only here.
    const existsOk = emailCheckUnavailable ? true : !emailExists;
    return emailIsValid && existsOk && !emailChecking;
  }, [isLoggedIn, emailIsValid, emailExists, emailChecking, emailCheckUnavailable]);

  // When logged out, check if an account already exists for the provided email.
  // Best-effort: if the query is blocked by RLS, we fall back to signup-time checks.
  useEffect(() => {
    if (isLoggedIn) return;
    setEmailExists(false);
    setEmailCheckUnavailable(false);
    if (!emailIsValid) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const e = emailNormalized;
        const [profilesRes, chefsRes] = await Promise.all([
          supabase.from('profiles').select('id').eq('email', e).maybeSingle(),
          supabase.from('chefs').select('id').eq('email', e).maybeSingle(),
        ]);

        if (cancelled) return;

        const profilesErr = (profilesRes as any)?.error;
        const chefsErr = (chefsRes as any)?.error;

        // If both checks fail (likely RLS), mark as unavailable so we don't block onboarding.
        if (profilesErr && chefsErr) {
          setEmailCheckUnavailable(true);
          setEmailExists(false);
          return;
        }

        const found = !!(profilesRes?.data?.id || chefsRes?.data?.id);
        setEmailExists(found);
      } catch (e) {
        if (!cancelled) {
          setEmailCheckUnavailable(true);
          setEmailExists(false);
        }
      } finally {
        if (!cancelled) setEmailChecking(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isLoggedIn, emailIsValid, emailNormalized]);

  useEffect(() => {
    // Check if user is already logged in, if so get their email and check status
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user ?? null;
      setIsLoggedIn(!!user);
      if (user) {
        setEmail(user.email || '');
        
        // Check if user is already a chef
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_chef')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile?.is_chef) {
          setIsAlreadyChef(true);
          return;
        }
        
        // Check for existing application
        const { data: existingApp } = await supabase
          .from('chef_applications')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'submitted')
          .maybeSingle();
        
        if (existingApp) {
          setExistingApplication(existingApp);
        }
      } else {
        setIsAlreadyChef(false);
      }
    });
  }, []);

  useEffect(() => {
    // Load Chef Onboarding banner from app_settings
    supabase.from('app_settings')
      .select('value')
      .eq('key', 'chef_onboarding_banner_url')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          setBannerUrl(data.value);
        }
        setLoadingBanner(false);
      })
      .catch(() => {
        setLoadingBanner(false);
      });
  }, []);

  // Load saved form data on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Check if user is logged in first
        const { data: { user } } = await supabase.auth.getUser();
        const saved = await storage.getItem(CHEF_FORM_STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.step) setStep(data.step);
          if (data.fullName) setFullName(data.fullName);
          if (data.brandName) setBrandName(data.brandName);
          if (data.briefDescription) setBriefDescription(data.briefDescription);
          if (data.cuisineType) setCuisineType(data.cuisineType);
          if (data.phone) setPhone(data.phone);
          // Only load email from storage if user is not logged in (email from auth takes precedence)
          if (data.email && !user?.email) setEmail(data.email);
          if (data.address) setAddress(data.address);
          if (data.password) setPassword(data.password);
          if (data.pickupSlots) setPickupSlots(data.pickupSlots);
          if (data.dishes) setDishes(data.dishes);
          if (data.bio) setBio(data.bio);
          if (data.location) setLocation(data.location);
          if (data.experience) setExperience(data.experience);
          if (data.specialties) setSpecialties(data.specialties);
          if (data.foodSafetyAcknowledged) setFoodSafetyAcknowledged(data.foodSafetyAcknowledged);
          if (data.allergensDisclosed) setAllergensDisclosed(data.allergensDisclosed);
          if (data.platformInspectionUnderstood) setPlatformInspectionUnderstood(data.platformInspectionUnderstood);
          if (data.agreementAccepted) setAgreementAccepted(data.agreementAccepted);
          if (data.feeAccepted) setFeeAccepted(data.feeAccepted);
          if (data.payoutAccepted) setPayoutAccepted(data.payoutAccepted);
        }
      } catch (e) {
        console.warn('Error loading saved form data:', e);
      } finally {
        hasLoadedFromStorage.current = true;
      }
    };
    loadSavedData();
  }, []);

  // Save form data whenever it changes (only after we've loaded from storage so we don't overwrite on refresh)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const saveData = async () => {
      try {
        const dataToSave = {
          step,
          fullName,
          brandName,
          briefDescription,
          cuisineType,
          phone,
          email,
          address,
          password,
          pickupSlots,
          dishes: dishes.map(d => ({ ...d, file: null })), // Don't save File objects
          bio,
          location,
          experience,
          specialties,
          foodSafetyAcknowledged,
          allergensDisclosed,
          platformInspectionUnderstood,
          agreementAccepted,
          feeAccepted,
          payoutAccepted,
        };
        await storage.setItem(CHEF_FORM_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        console.warn('Error saving form data:', e);
      }
    };
    saveData();
  }, [step, fullName, brandName, briefDescription, cuisineType, phone, email, address, password, pickupSlots, dishes, bio, location, experience, specialties, foodSafetyAcknowledged, allergensDisclosed, platformInspectionUnderstood, agreementAccepted, feeAccepted, payoutAccepted]);

  const canProceedToStep2 = fullName && brandName && briefDescription && cuisineType.length > 0 && phoneIsValid && emailOk && address;
  const canProceedToStep3 = pickupSlots.length > 0;
  const canProceedToStep4 = dishes.length > 0; // At least one dish required
  const canProceedToStep5 = foodSafetyAcknowledged && allergensDisclosed && platformInspectionUnderstood && agreementAccepted && feeAccepted && payoutAccepted;
  const canSubmit = true; // All validations are done in previous steps

  function handleNext() {
    if (step === 1 && canProceedToStep2) {
      setStep(2);
    } else if (step === 1) {
      setPhoneTouched(true);
      setEmailTouched(true);
      if (!phoneIsValid) {
        Alert.alert('Invalid phone number', 'Please enter a valid Canadian phone number (e.g., (416) 555-1234).');
      } else if (!emailIsValid) {
        Alert.alert('Invalid email', 'Please enter a valid email address (e.g., chef@example.com).');
      } else if (!emailCheckUnavailable && emailExists) {
        Alert.alert(
          'Account already exists',
          'An account with this email already exists. Please log in first, then continue the chef sign-up.',
          [{ text: 'Log in', onPress: () => router.push('/auth') }, { text: 'OK' }]
        );
      }
    } else if (step === 2 && canProceedToStep3) {
      setStep(3);
    } else if (step === 3 && canProceedToStep4) {
      setStep(4);
    } else if (step === 4 && canProceedToStep5) {
      setStep(5);
    }
  }

  // Dish management functions
  function createDish(d: { name: string; price: number; portion?: string; description?: string; ingredients?: string; file?: File | null; preview?: string }) {
    setSavingDish(true);
    try {
      const newDish: DishItem = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: d.name,
        price: d.price,
        portion: d.portion || '',
        description: d.description || '',
        ingredients: d.ingredients || '',
        image: d.preview || undefined,
        file: d.file || null,
      };
      setDishes(prev => [...prev, newDish]);
      setMsg('Dish added');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to add dish: ' + (e.message || String(e)));
    } finally {
      setSavingDish(false);
    }
  }

  function updateDish(id: string, p: { name?: string; price?: number | string; portion?: string; description?: string; ingredients?: string; file?: File | null; preview?: string }) {
    setSavingDish(true);
    try {
      const payload: Partial<DishItem> = {};
      if (typeof p.name !== 'undefined') payload.name = p.name;
      if (typeof p.price !== 'undefined' && p.price !== null && p.price !== '') {
        const n = Number(p.price);
        if (!Number.isFinite(n)) throw new Error('Price must be a number');
        payload.price = n;
      }
      if (typeof p.portion !== 'undefined') payload.portion = p.portion || '';
      if (typeof p.description !== 'undefined') payload.description = p.description || '';
      if (typeof p.ingredients !== 'undefined') payload.ingredients = p.ingredients || '';
      if (p.file) {
        payload.file = p.file;
        payload.image = p.preview || undefined;
      }

      setDishes(prev =>
        prev.map(d =>
          d.id === id ? { ...d, ...payload } : d
        )
      );

      setMsg('Dish updated');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update dish: ' + (e.message || String(e)));
    } finally {
      setSavingDish(false);
    }
  }

  function deleteDish(id: string) {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this dish?')) {
        setDishes(prev => prev.filter(d => d.id !== id));
        setMsg('Dish deleted');
        setTimeout(() => setMsg(null), 3000);
      }
      return;
    }

    Alert.alert('Delete Dish', 'Are you sure you want to delete this dish?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDishes(prev => prev.filter(d => d.id !== id));
          setMsg('Dish deleted');
          setTimeout(() => setMsg(null), 3000);
        }
      }
    ]);
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }
  
  // Days of the week
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Generate time windows in 1-hour slots from 8am to 9pm
  const timeWindows = useMemo(() => {
    const windows: Array<{ value: string; label: string }> = [];
    for (let hour = 8; hour <= 20; hour++) {
      const endHour = hour + 1;
      
      // Convert start hour to 12-hour format with leading zero
      const hour12Start = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const hour12StartPadded = hour12Start.toString().padStart(2, '0');
      const ampmStart = hour < 12 ? 'AM' : 'PM';
      
      // Convert end hour to 12-hour format with leading zero
      const hour12End = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
      const hour12EndPadded = hour12End.toString().padStart(2, '0');
      const ampmEnd = endHour < 12 ? 'AM' : 'PM';
      
      windows.push({
        value: `${hour.toString().padStart(2, '0')}:00-${endHour.toString().padStart(2, '0')}:00`,
        label: `${hour12StartPadded}:00 ${ampmStart} - ${hour12EndPadded}:00 ${ampmEnd}`,
      });
    }
    return windows;
  }, []);
  
  // Handle toggling time window selection
  const handleToggleTimeWindow = (timeWindow: string) => {
    if (selectedTimeWindows.includes(timeWindow)) {
      setSelectedTimeWindows(selectedTimeWindows.filter(tw => tw !== timeWindow));
    } else {
      setSelectedTimeWindows([...selectedTimeWindows, timeWindow]);
    }
  };
  
  // Handle adding pickup day/time window combinations
  const handleAddPickupSlots = () => {
    if (selectedDay && selectedTimeWindows.length > 0) {
      // Add all selected time windows for the selected day
      const newSlots = selectedTimeWindows
        .filter(timeWindow => {
          // Check if this exact combination already exists
          return !pickupSlots.some(
            slot => slot.day === selectedDay && slot.timeWindow === timeWindow
          );
        })
        .map(timeWindow => ({ day: selectedDay, timeWindow }));
      
      if (newSlots.length > 0) {
        setPickupSlots([...pickupSlots, ...newSlots]);
      }
      // Clear selections and close popup
      setSelectedTimeWindows([]);
      setShowPickupPicker(false);
    }
  };
  
  // Handle removing a pickup slot
  const handleRemovePickupSlot = (index: number) => {
    setPickupSlots(pickupSlots.filter((_, i) => i !== index));
  };

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const emailForAuth = emailNormalized;

      // Extract form values
      const chefName = brandName || fullName || 'Chef';
      const chefBio = briefDescription || bio || null;
      const chefLocation = address || location || null;
      const chefCuisine = cuisineType.length > 0 ? cuisineType.join(', ') : null;
      
      // 1) Check if user is already logged in
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
      
      let session = existingSession;
      
      // 2) If not logged in, try to sign up or sign in
      if (!session) {
        // Generate a random password for signup (user will reset it via email)
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!';
        
        // Try to sign up
        const su = await supabase.auth.signUp({ 
          email: emailForAuth, 
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?mode=reset`
          }
        });
        
        // If user already exists (422 error), prompt them to sign in first
        if (su.error) {
          const errorCode = su.error.status || 0;
          const errorMessage = su.error.message || '';
          
          if (errorCode === 422 || /user.*already.*registered|email.*already.*exists/i.test(errorMessage)) {
            Alert.alert(
              'Account Already Exists',
              'An account with this email already exists. Please sign in first, then complete the chef onboarding.',
              [
                { text: 'OK', onPress: () => router.push('/auth') }
              ]
            );
            return;
          }
          
          // For other errors, show the error
        throw su.error;
      }
      
        // If signup succeeded, try to establish session
        if (su.data?.user && !su.data.session) {
          // User created but no session - try to sign in with password
          const sessionResult = await ensureSession(supabase, emailForAuth, tempPassword);
          if (sessionResult) {
            session = {
              access_token: sessionResult.access_token,
              refresh_token: sessionResult.refresh_token,
              user: sessionResult.user,
            } as any;
          } else {
            // Session not established - user needs to verify email
            Alert.alert(
              'Check Your Email',
              'We sent you a verification email. Please verify your email address, then sign in to complete the chef onboarding.',
              [
                { text: 'OK', onPress: () => router.push('/auth') }
              ]
            );
            return;
          }
        } else if (su.data?.session) {
          session = su.data.session;
        }
      }
      
      // 3) Verify we have a session
      if (!session || !session.user) {
        throw new Error('Unable to establish user session. Please sign in first.');
      }

      // 3) ensure profile
      const profileResult = await ensureProfile(supabase);
      if (!profileResult.ok) {
        console.warn('ensureProfile warning:', profileResult.error);
        // Continue anyway - profile might already exist
      }

      // 4) Create or update chef record in chefs table
      // Check if chef already exists for this user
      const { data: existingChef } = await supabase
        .from('chefs')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      let chefId: number;
      
      if (existingChef) {
        // Update existing chef
        const { data: updatedChef, error: updateError } = await supabase
          .from('chefs')
          .update({
            name: chefName,
            email: emailNormalized || null,
            phone: phoneIsValid ? phoneE164 : (phone || null),
            location: chefLocation,
            bio: chefBio,
            cuisine: chefCuisine,
            pickup_availability: pickupSlots.length > 0 ? pickupSlots : null,
            status: 'pending', // Deactivated until admin approval
          user_id: session.user.id,
          })
          .eq('id', existingChef.id)
          .select('id')
          .single();
        
        if (updateError) throw updateError;
        if (!updatedChef?.id) throw new Error('Failed to update chef');
        chefId = updatedChef.id;
      } else {
        // Create new chef
        const { data: newChef, error: insertError } = await supabase
          .from('chefs')
          .insert({
            name: chefName,
            email: emailNormalized || null,
          phone: phoneIsValid ? phoneE164 : (phone || null),
            location: chefLocation,
            bio: chefBio,
            cuisine: chefCuisine,
            pickup_availability: pickupSlots.length > 0 ? pickupSlots : null,
            status: 'pending', // Deactivated until admin approval
            user_id: session.user.id,
          })
        .select('id')
        .single();

        if (insertError) throw insertError;
        if (!newChef?.id) throw new Error('Failed to create chef');
        chefId = newChef.id;
      }

      // 6) Update profile to mark user as chef
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ is_chef: true })
        .eq('id', session.user.id);
      
      if (profileUpdateError) {
        console.warn('Failed to update profile is_chef flag:', profileUpdateError);
        // Continue anyway - not critical
      }

      // 7) Create all dishes
      for (const dish of dishes) {
        try {
          // Insert dish record
          const { data: createdDish, error: dishError } = await supabase
            .from('dishes')
            .insert({
              chef_id: chefId,
              chef: chefName,
              name: dish.name,
              price: dish.price,
              description: dish.description || null,
              ingredients: dish.ingredients || null,
              portion: dish.portion || null,
            })
            .select('id')
            .single();
          
          if (dishError) {
            console.error(`Failed to create dish ${dish.name}:`, dishError);
            continue; // Skip this dish and continue with others
          }
          
          if (!createdDish?.id) {
            console.error(`Failed to get dish ID for ${dish.name}`);
            continue;
          }

          // Upload dish image if provided
          if (dish.file && createdDish.id) {
            try {
              const { publicUrl } = await uploadToBucket(
                'dish-images',
                dish.file,
                `chefs/${chefId}/dishes/${createdDish.id}`
              );
              
              // Update dish with image URL
              await supabase
                .from('dishes')
                .update({ image: publicUrl, thumbnail: publicUrl })
                .eq('id', createdDish.id);
            } catch (uploadError: any) {
              console.error(`Failed to upload image for dish ${dish.name}:`, uploadError);
              // Continue - dish is created, just without image
            }
          }
        } catch (dishErr: any) {
          console.error(`Error processing dish ${dish.name}:`, dishErr);
          // Continue with next dish
        }
      }

      // 8) Create chef_applications record if it doesn't exist
      const { data: existingApp } = await supabase
        .from('chef_applications')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      let applicationId: string | null = null;
      
      if (!existingApp) {
        // Create chef application record
        const { data: newApp, error: appError } = await supabase
          .from('chef_applications')
          .insert({
          user_id: session.user.id,
            name: chefName,
            email: emailNormalized || null,
          phone: phoneIsValid ? phoneE164 : (phone || null),
            location: chefLocation,
            short_bio: chefBio,
            cuisine_specialty: chefCuisine,
          status: 'submitted',
          })
        .select('id')
        .single();

        if (!appError && newApp) {
          applicationId = newApp.id;
        } else {
          console.warn('Failed to create chef_applications record:', appError);
        }
      } else {
        applicationId = existingApp.id;
      }

      // 9) Create notifications for all admin users about the new chef application
      try {
        // Get all admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_admin', true);
        
        if (!adminError && adminUsers && adminUsers.length > 0) {
          // Create notification for each admin user
          const notificationPromises = adminUsers.map(adminUser =>
            createNotification(
              adminUser.id,
              'chef_request',
              'New Chef Request',
              `A new chef application from ${chefName} is waiting for review.`,
              undefined,
              'chef_application'
            )
          );
          
          // Don't wait for all notifications to complete - fire and forget
          Promise.all(notificationPromises).catch(err => {
            console.error('Error creating notifications for admins:', err);
          });
        }
      } catch (notifError) {
        // Don't block the submission if notification creation fails
        console.error('Error creating notifications for admins:', notifError);
      }

      // 10) Clear saved form data and navigate to chef dashboard
      await storage.removeItem(CHEF_FORM_STORAGE_KEY);
      router.replace('/chef');
    } catch (e: any) {
      console.error('Chef onboarding submit failed:', e);
      const errorMsg = e?.message || 'Could not complete onboarding';
      Alert.alert('Error', errorMsg);
      setMsg(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  // Live, engaging progress (updates as fields are filled)
  const step1Checks = [
    fullName.trim().length > 0,
    brandName.trim().length > 0,
    briefDescription.trim().length > 0,
    cuisineType.length > 0,
    phoneIsValid,
    emailOk,
    address.trim().length > 0,
  ];
  const step1Done = step1Checks.filter(Boolean).length;
  const step1Total = step1Checks.length;
  const step1Ratio = step1Total ? step1Done / step1Total : 0;

  // Step 2 becomes "complete" with 1 slot, but gains extra progress with more slots.
  const step2Ratio =
    pickupSlots.length === 0
      ? 0
      : clamp01(0.7 + 0.3 * Math.min(1, pickupSlots.length / 3));

  // Step 3 becomes "complete" with 1 dish, but gains extra progress with more dishes.
  const step3Ratio =
    dishes.length === 0 ? 0 : clamp01(0.7 + 0.3 * Math.min(1, dishes.length / 3));

  const step4Checks = [
    agreementAccepted,
    feeAccepted,
    payoutAccepted,
    foodSafetyAcknowledged,
    allergensDisclosed,
    platformInspectionUnderstood,
  ];
  const step4Done = step4Checks.filter(Boolean).length;
  const step4Total = step4Checks.length;
  const step4Ratio = step4Total ? step4Done / step4Total : 0;

  const step5Ratio = step === 5 ? 1 : 0;

  const progress = Math.round((step1Ratio + step2Ratio + step3Ratio + step4Ratio + step5Ratio) * 20);

  const stepTitles = ['Personal Info', 'Availability & Pickup', 'Menu', 'Agreement', 'Review'];
  const stepTitle = stepTitles[step - 1] || '';

  const progressDetail =
    step === 1
      ? `${stepTitle} • ${step1Done}/${step1Total} complete`
      : step === 2
        ? `${stepTitle} • ${Math.min(pickupSlots.length, 3)}/3 pickup slots set`
        : step === 3
          ? `${stepTitle} • ${Math.min(dishes.length, 3)}/3 dishes added`
          : step === 4
            ? `${stepTitle} • ${step4Done}/${step4Total} acknowledgements`
            : `${stepTitle} • ready to submit`;

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Page Heading */}
          <View style={styles.heading}>
            {loadingBanner ? (
              <View style={[styles.headerImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E2E8F0' }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : bannerUrl ? (
              <Image 
                source={{ uri: bannerUrl }} 
                style={styles.headerImage}
                resizeMode="cover"
              />
            ) : (
              <Image 
                source={require('../../assets/Gemini_Generated_Image_4t6si4t6si4t6si4.png')} 
                style={styles.headerImage}
                resizeMode="contain"
              />
            )}
            <Text style={[styles.title, { fontSize: isMobile ? 30 : 48 }]}>Chef profile basics</Text>
            <Text style={styles.subtitle}>
              You control your menu & orders. There are no sign-up fees or commitments.
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
                <Text style={styles.progressText}>Chef setup progress</Text>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressSubtext}>{progressDetail}</Text>
            </View>

            <View style={styles.form}>
              {step === 1 ? (
                <>
                  {/* Form Fields */}
                    {/* Full Name Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Full name</Text>
                      </View>
                      <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Enter your full legal name"
                        style={[styles.input, focusedInput === 'fullName' && styles.inputFocused]}
                        autoCapitalize="words"
                        onFocus={() => setFocusedInput('fullName')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <Text style={styles.hint}>Enter your full legal name.</Text>
                    </View>

                    {/* Brand Name Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Brand name</Text>
                      </View>
                      <TextInput
                        value={brandName}
                        onChangeText={setBrandName}
                        placeholder="Enter your brand name"
                        style={[styles.input, focusedInput === 'brandName' && styles.inputFocused]}
                        autoCapitalize="words"
                        onFocus={() => setFocusedInput('brandName')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <Text style={styles.hint}>This is how customers will see you online.</Text>
                    </View>

                    {/* Brief Description Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Brief description</Text>
                      </View>
          <TextInput
                        value={briefDescription}
                        onChangeText={setBriefDescription}
                        placeholder="Tell us about yourself"
                        style={[styles.input, styles.textArea, focusedInput === 'briefDescription' && styles.inputFocused]}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        onFocus={() => setFocusedInput('briefDescription')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <Text style={styles.hint}>Briefly tell us about yourself.</Text>
        </View>

                    {/* Cuisine Type Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Cuisine type</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.input, styles.dropdownButton, focusedInput === 'cuisineType' && styles.inputFocused]}
                        onPress={() => {
                          setFocusedInput('cuisineType');
                          setShowCuisineDropdown(true);
                        }}
                      >
                        <Text style={[styles.dropdownButtonText, cuisineType.length === 0 && styles.dropdownPlaceholder]}>
                          {cuisineType.length > 0 ? cuisineType.join(', ') : 'Select cuisine types...'}
                        </Text>
                        <Text style={styles.dropdownArrow}>▼</Text>
                      </TouchableOpacity>
                      <Text style={styles.hint}>Choose one or multiple from the options.</Text>
                      
                      {/* Cuisine Dropdown Modal */}
                      <Modal
                        visible={showCuisineDropdown}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowCuisineDropdown(false)}
                      >
                        <TouchableOpacity
                          style={styles.modalOverlay}
                          activeOpacity={1}
                          onPress={() => setShowCuisineDropdown(false)}
                        >
                          <View style={styles.dropdownModal} onStartShouldSetResponder={() => true}>
                            <View style={styles.dropdownHeader}>
                              <Text style={styles.dropdownTitle}>Select cuisine types</Text>
                              <TouchableOpacity
                                onPress={() => setShowCuisineDropdown(false)}
                                style={styles.dropdownCloseButton}
                              >
                                <Text style={styles.dropdownCloseText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.dropdownList}>
                              {cuisineTypes.map((cuisine) => {
                                const isSelected = cuisineType.includes(cuisine);
                                return (
                                  <TouchableOpacity
                                    key={cuisine}
                                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                    onPress={() => {
                                      if (isSelected) {
                                        setCuisineType(cuisineType.filter(c => c !== cuisine));
                                      } else {
                                        setCuisineType([...cuisineType, cuisine]);
                                      }
                                    }}
                                  >
                                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                                      {cuisine}
                                    </Text>
                                    {isSelected && (
                                      <Text style={styles.dropdownCheckmark}>✓</Text>
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                            <TouchableOpacity
                              style={styles.dropdownDoneButton}
                              onPress={() => setShowCuisineDropdown(false)}
                            >
                              <Text style={styles.dropdownDoneText}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      </Modal>
                    </View>

                    {/* Phone Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Phone</Text>
                      </View>
          <TextInput
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (!phoneTouched) setPhoneTouched(true);
            }}
                        placeholder="(416) 555-1234"
                        style={[styles.input, focusedInput === 'phone' && styles.inputFocused]}
                        keyboardType="phone-pad"
                        onFocus={() => setFocusedInput('phone')}
                        onBlur={() => {
                          setFocusedInput(null);
                          setPhoneTouched(true);
                        }}
                      />
                      {phoneTouched && phone.trim().length > 0 && !phoneIsValid && (
                        <Text style={styles.validationError}>
                          Please enter a valid Canadian phone number (e.g., (416) 555-1234).
                        </Text>
                      )}
                      <Text style={styles.hint}>Share a contact number for customers.</Text>
                    </View>

                    {/* Email Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Email</Text>
                      </View>
                        <TextInput
                        value={email}
                        onChangeText={(v) => {
                          if (isLoggedIn) return;
                          setEmail(v);
                          if (!emailTouched) setEmailTouched(true);
                        }}
                        placeholder="you@example.com"
                        style={[
                          styles.input,
                          isLoggedIn && styles.inputReadOnly,
                          focusedInput === 'email' && styles.inputFocused,
                        ]}
                        keyboardType="email-address"
                          autoCapitalize="none"
                        editable={!isLoggedIn}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => {
                          setFocusedInput(null);
                          if (!isLoggedIn) setEmailTouched(true);
                        }}
                      />
                      {!isLoggedIn && emailChecking && emailIsValid && (
                        <Text style={styles.validationHint}>Checking email…</Text>
                      )}
                      {!isLoggedIn && emailTouched && email.trim().length > 0 && !emailIsValid && (
                        <Text style={styles.validationError}>
                          Please enter a valid email address.
                        </Text>
                      )}
                      {!isLoggedIn && emailTouched && emailIsValid && !emailCheckUnavailable && emailExists && (
                        <Text style={styles.validationError}>
                          An account with this email already exists. Please log in first, then continue chef sign-up.
                        </Text>
                      )}
                      <Text style={styles.hint}>Share a business email for reference.</Text>
                      </View>

                    {/* Address Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Address</Text>
                    </View>
                      <View style={styles.locationPickerContainer}>
                        <LocationPicker
                          value={address}
                          onChange={setAddress}
                          placeholder="Search for your address"
                        />
                  </View>
                      <Text style={styles.hint}>Share a detailed address for order pickups.</Text>
                      <Text style={styles.hint}>Your address is only available to customers after paid order confirmation</Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                        <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep2 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep2 || busy}
                    >
                      <Text style={styles.nextButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : step === 2 ? (
                <>
                  {/* Step 2: Availability & Pickup */}
                  <Text style={styles.sectionTitle}>Availability & pickup</Text>
                  <Text style={styles.sectionSubtitle}>You control when & where pickups happen.</Text>

                  {/* Pickup Days & Times Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                      <Text style={styles.label}>Pickup days & times</Text>
                      </View>
                    <TouchableOpacity
                      style={[styles.input, styles.dropdownButton]}
                      onPress={() => setShowPickupPicker(true)}
                    >
                      <Text style={[styles.dropdownButtonText, pickupSlots.length === 0 && styles.dropdownPlaceholder]}>
                        {pickupSlots.length > 0 
                          ? `${pickupSlots.length} slot(s) selected`
                          : 'Select pickup days & times...'}
                          </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                    <Text style={styles.hint}>Select the days and time windows when customers can pick up orders.</Text>
                    
                    {/* Display selected combinations */}
                    {pickupSlots.length > 0 && (
                      <View style={styles.selectedPickupTimes}>
                        <Text style={styles.selectedPickupTimesLabel}>Selected slots:</Text>
                        {(() => {
                          // Group slots by day
                          const slotsByDay: { [day: string]: string[] } = {};
                          pickupSlots.forEach(slot => {
                            if (!slotsByDay[slot.day]) {
                              slotsByDay[slot.day] = [];
                            }
                            slotsByDay[slot.day].push(slot.timeWindow);
                          });

                          // Helper function to find consecutive time windows and create ranges
                          const findConsecutiveRanges = (timeWindowValues: string[]): Array<{ start: string; end: string; indices: number[] }> => {
                            if (timeWindowValues.length === 0) return [];
                            
                            // Sort time windows by their hour value
                            const sorted = [...timeWindowValues].sort((a, b) => {
                              const hourA = parseInt(a.split(':')[0]);
                              const hourB = parseInt(b.split(':')[0]);
                              return hourA - hourB;
                            });
                            
                            const ranges: Array<{ start: string; end: string; indices: number[] }> = [];
                            let currentRange: { start: string; end: string; indices: number[] } | null = null;
                            
                            sorted.forEach((timeWindow, idx) => {
                              const hour = parseInt(timeWindow.split(':')[0]);
                              const endHour = parseInt(timeWindow.split('-')[1].split(':')[0]);
                              
                              if (!currentRange) {
                                currentRange = {
                                  start: timeWindow,
                                  end: timeWindow,
                                  indices: [timeWindowValues.indexOf(timeWindow)]
                                };
                              } else {
                                const lastEndHour = parseInt(currentRange.end.split('-')[1].split(':')[0]);
                                // Check if this time window is consecutive (starts where the last one ended)
                                if (hour === lastEndHour) {
                                  currentRange.end = timeWindow;
                                  currentRange.indices.push(timeWindowValues.indexOf(timeWindow));
                                } else {
                                  // Save current range and start a new one
                                  ranges.push(currentRange);
                                  currentRange = {
                                    start: timeWindow,
                                    end: timeWindow,
                                    indices: [timeWindowValues.indexOf(timeWindow)]
                                  };
                                }
                              }
                            });
                            
                            if (currentRange) {
                              ranges.push(currentRange);
                            }
                            
                            return ranges;
                          };

                          // Helper function to format time range
                          const formatTimeRange = (startWindow: string, endWindow: string): string => {
                            const startHour = parseInt(startWindow.split(':')[0]);
                            const endHour = parseInt(endWindow.split('-')[1].split(':')[0]);
                            
                            const startHour12 = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
                            const startHour12Padded = startHour12.toString().padStart(2, '0');
                            const startAmpm = startHour < 12 ? 'AM' : 'PM';
                            
                            const endHour12 = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
                            const endHour12Padded = endHour12.toString().padStart(2, '0');
                            const endAmpm = endHour < 12 ? 'AM' : 'PM';
                            
                            return `${startHour12Padded}:00 ${startAmpm} - ${endHour12Padded}:00 ${endAmpm}`;
                          };
                          
                          return Object.entries(slotsByDay).map(([day, timeWindowsForDay]) => {
                            const ranges = findConsecutiveRanges(timeWindowsForDay);
                            
                            return ranges.map((range, rangeIdx) => {
                              const isSingleSlot = range.start === range.end;
                              const timeLabel = isSingleSlot 
                                ? (timeWindows.find(tw => tw.value === range.start)?.label || range.start)
                                : formatTimeRange(range.start, range.end);
                              
                              // Find the first slot index for this range
                              const firstSlotIndex = pickupSlots.findIndex(s => s.day === day && s.timeWindow === range.start);
                              
                              return (
                                <View key={`${day}-${rangeIdx}`} style={styles.selectedPickupTimeItem}>
                                  <Text style={styles.selectedPickupTimeText}>{day}</Text>
                                  <Text style={styles.selectedPickupTimeText}>•</Text>
                                  <Text style={styles.selectedPickupTimeText}>{timeLabel}</Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      // Remove all slots in this range
                                      const slotsToRemove = range.indices.map(idx => timeWindowsForDay[idx]);
                                      setPickupSlots(pickupSlots.filter(s => 
                                        !(s.day === day && slotsToRemove.includes(s.timeWindow))
                                      ));
                                    }}
                                    style={styles.removeSlotButton}
                                  >
                                    <Text style={styles.removeSlotButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                              );
                            });
                          }).flat();
                        })()}
                    </View>
                    )}

                    {/* Pickup Days & Times Picker Modal */}
                    <Modal
                      visible={showPickupPicker}
                      transparent={true}
                      animationType="fade"
                      onRequestClose={() => setShowPickupPicker(false)}
                    >
                      <View style={styles.pickerModalOverlay}>
                        <View style={styles.pickerModalContent}>
                          <View style={styles.pickerModalHeader}>
                            <TouchableOpacity onPress={() => setShowPickupPicker(false)}>
                              <Text style={styles.pickerModalCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.pickerModalTitle}>Select Days & Time Windows</Text>
                            <TouchableOpacity onPress={() => {
                              handleAddPickupSlots();
                            }}>
                              <Text style={styles.pickerModalConfirm}>Add</Text>
                            </TouchableOpacity>
                      </View>
                          <View style={styles.inlinePickerContainer}>
                            {/* Days Picker Wheel */}
                            <View style={styles.inlinePickerWheel}>
                              <Text style={styles.inlinePickerLabel}>Day</Text>
                              <ScrollView 
                                style={styles.pickerWheelContainer}
                                contentContainerStyle={styles.pickerWheelContent}
                                showsVerticalScrollIndicator={false}
                              >
                                {daysOfWeek.map((day) => {
                                  const isSelected = selectedDay === day;
                                  return (
                                    <TouchableOpacity
                                      key={day}
                                      onPress={() => {
                                        setSelectedDay(day);
                                        // Reset time windows when day changes
                                        setSelectedTimeWindows([]);
                                      }}
                                      style={[styles.pickerWheelItem, isSelected && styles.pickerWheelItemSelected]}
                                    >
                                      <Text style={[styles.pickerWheelText, isSelected && styles.pickerWheelTextSelected]}>
                                        {day}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                  </View>

                            {/* Time Window Picker Wheel */}
                            <View style={styles.inlinePickerWheel}>
                              <Text style={styles.inlinePickerLabel}>Time Window</Text>
                              <ScrollView 
                                style={styles.pickerWheelContainer} 
                                contentContainerStyle={styles.pickerWheelContent}
                                showsVerticalScrollIndicator={false}
                              >
                                {timeWindows.map((timeWindow) => {
                                  const isSelected = selectedTimeWindows.includes(timeWindow.value);
                                  return (
                                    <TouchableOpacity
                                      key={timeWindow.value}
                                      onPress={() => handleToggleTimeWindow(timeWindow.value)}
                                      style={[styles.pickerWheelItem, isSelected && styles.pickerWheelItemSelected]}
                                    >
                                      <Text 
                                        style={[styles.pickerWheelText, isSelected && styles.pickerWheelTextSelected]}
                                        numberOfLines={1}
                                      >
                                        {timeWindow.label}
                                      </Text>
                                      {isSelected && (
                                        <Text style={styles.pickerWheelCheckmark}>✓</Text>
                                      )}
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                      </View>
                          </View>
                          <TouchableOpacity
                            style={[styles.addPickupTimeButton, (!selectedDay || selectedTimeWindows.length === 0) && styles.addPickupTimeButtonDisabled]}
                            onPress={handleAddPickupSlots}
                            disabled={!selectedDay || selectedTimeWindows.length === 0}
                          >
                            <Text style={styles.addPickupTimeButtonText}>
                              Add {selectedTimeWindows.length > 0 ? `${selectedTimeWindows.length} ` : ''}Slot{selectedTimeWindows.length !== 1 ? 's' : ''}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Modal>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.backButton, busy && styles.backButtonDisabled]}
                      onPress={handleBack}
                      disabled={busy}
                    >
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep3 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep3 || busy}
                    >
                      <Text style={styles.nextButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : step === 3 ? (
                <>
                  {/* Step 3: Dish Management */}
                  <Text style={[styles.sectionTitle, { borderBottomWidth: 0, paddingBottom: 0 }]}>Create your first dish!</Text>
                  <Text style={styles.sectionSubtitle}>Draft it first — nothing goes live yet.</Text>
                  
                  {msg && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: PRIMARY_COLOR + '20', borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                      <Image source={require('../../assets/success.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                      <Text style={{ color: TEXT_LIGHT, fontWeight: '700', flex: 1 }}>{msg}</Text>
                    </View>
                  )}

                  <NewDishForm onCreate={createDish} saving={savingDish} />

                  <View style={{ gap: 24, marginTop: 24 }}>
                    {dishes.length === 0 ? (
                      <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>No dishes yet. Add your first dish above.</Text>
                    ) : (
                      dishes.map(d => <DishEditor key={d.id} dish={d} onSave={(p) => updateDish(d.id, p)} onDelete={() => deleteDish(d.id)} saving={savingDish} />)
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.backButton, busy && styles.backButtonDisabled]}
                      onPress={handleBack}
                      disabled={busy}
                    >
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep4 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep4 || busy}
                    >
                      <Text style={styles.nextButtonText}>Continue</Text>
                    </TouchableOpacity>
                      </View>
                </>
              ) : step === 4 ? (
                <>
                  {/* Step 4: Food Safety & Payout Acknowledgement */}
                  {/* Food Safety & Payout Acknowledgement Section */}
                  <View style={[styles.field, styles.fieldFull, { marginTop: theme.spacing['2xl'] }]}>
                    <Text style={[styles.sectionTitle, { borderBottomColor: '#FFFFFF' }]}>Food safety & payout acknowledgement</Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base, marginBottom: theme.spacing.md }}>
                      You're responsible for preparation.
                    </Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base, marginBottom: theme.spacing.lg }}>
                      We securely handle payments.
                    </Text>

                    {/* Links */}
                    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg, alignItems: 'flex-start' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('agreement');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base }}>
                            Chef Participation Agreement
                          </Text>
                        </TouchableOpacity>
                        {agreementAccepted && <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('fee');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base }}>
                            Fee Schedule
                          </Text>
                        </TouchableOpacity>
                        {feeAccepted && <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, alignSelf: 'center' }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('payout');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base }}>
                            Payouts & Payments
                          </Text>
                        </TouchableOpacity>
                        {payoutAccepted && <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />}
                      </View>
                    </View>

                    {/* Checkboxes */}
                    <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.lg }}>
                      <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => setAllergensDisclosed(!allergensDisclosed)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, allergensDisclosed && styles.checkboxChecked]}>
                          <Image source={require('../../assets/success.png')} style={{ width: 22, height: 22, tintColor: allergensDisclosed ? PRIMARY_COLOR : TEXT_LIGHT }} resizeMode="contain" />
                        </View>
                        <Text style={[styles.checkboxLabel, isMobile && { fontSize: theme.typography.fontSize.sm }]}>
                          I'll clearly list ingredients & allergens
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => setFoodSafetyAcknowledged(!foodSafetyAcknowledged)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, foodSafetyAcknowledged && styles.checkboxChecked]}>
                          <Image source={require('../../assets/success.png')} style={{ width: 22, height: 22, tintColor: foodSafetyAcknowledged ? PRIMARY_COLOR : TEXT_LIGHT }} resizeMode="contain" />
                        </View>
                        <Text style={[styles.checkboxLabel, isMobile && { fontSize: theme.typography.fontSize.sm }]}>
                          I'll prepare food safely and responsibly
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => setPlatformInspectionUnderstood(!platformInspectionUnderstood)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, platformInspectionUnderstood && styles.checkboxChecked]}>
                          <Image source={require('../../assets/success.png')} style={{ width: 22, height: 22, tintColor: platformInspectionUnderstood ? PRIMARY_COLOR : TEXT_LIGHT }} resizeMode="contain" />
                        </View>
                        <Text style={[styles.checkboxLabel, isMobile && { fontSize: theme.typography.fontSize.sm }]}>
                          I understand the platform doesn't inspect food
                        </Text>
                      </TouchableOpacity>
                    </View>
        </View>

                  {/* Terms Modal */}
                  <Modal
                    visible={showTermsModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => {
                      setShowTermsModal(false);
                      setTermsType(null);
                      setTermsScrolledToBottom(false);
                      setTermsAccepted(false);
                    }}
                  >
                    <View style={styles.termsModalOverlay}>
                      <View style={styles.termsModalContent}>
                        <View style={styles.termsModalHeader}>
                          <Text style={styles.termsModalTitle}>
                            {termsType === 'agreement' && 'Chef Participation Agreement'}
                            {termsType === 'fee' && 'Fee Schedule'}
                            {termsType === 'payout' && 'Payouts & Payments'}
                          </Text>
                          <TouchableOpacity onPress={() => {
                            setShowTermsModal(false);
                            setTermsType(null);
                            setTermsScrolledToBottom(false);
                            setTermsAccepted(false);
                          }}>
                            <Text style={styles.termsModalClose}>✕</Text>
                          </TouchableOpacity>
                      </View>
                        <ScrollView 
                          style={styles.termsModalBody}
                          onScroll={(event) => {
                            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                            const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
                            if (isAtBottom && !termsScrolledToBottom) {
                              setTermsScrolledToBottom(true);
                            }
                          }}
                          scrollEventThrottle={16}
                        >
                          {termsType === 'agreement' && (
                            <Text style={styles.termsModalText}>{`
PARTICIPATION AGREEMENT
(Marketplace Platform – Ontario, Canada)

This Home Chef Participation Agreement ("Agreement") governs your access to and use of the YourHomeChef marketplace platform. By creating a chef account, listing meals, or accepting orders on the Platform, you agree to be bound by this Agreement.

1. Purpose & Relationship of the Parties

1.1 The Platform operates an online marketplace that facilitates connections between independent food preparers ("Chefs") and customers seeking prepared meals.
1.2 The Chef acts solely as an independent contractor and is not an employee, partner, joint venturer, agent, or representative of the Platform.
1.3 The Platform does not prepare, cook, package, or handle food, and does not control the methods, ingredients, or preparation of food beyond general marketplace requirements for safety and compliance.

2. Compliance With Laws & Food Safety

2.1 The Chef acknowledges and agrees that they are solely responsible for complying at all times with all applicable federal, provincial, and municipal laws, regulations, and guidelines.
2.2 The Platform does not inspect, verify, or approve kitchens or food preparation methods. The Chef is solely responsible for the location, equipment, and preparation of food.
2.3 The Platform may suspend or terminate the Chef's access immediately if it believes the Chef is operating in violation of any applicable law.

3. Food Handler Certification

3.1 Food safety certifications may or may not be held by Chefs. The Platform does not verify or require certifications for listing meals.
3.2 The Chef acknowledges that compliance with local laws and safety practices is their responsibility.
3.3 Failure to follow applicable laws or unsafe practices may result in suspension or removal from the Platform.

4. Kitchen & Preparation Requirements

4.1 By listing meals on the Platform, the Chef confirms responsibility for:

• Kitchen cleanliness
• Ingredient sourcing
• Allergen disclosure
• Packaging and labeling accuracy

4.2 The Chef acknowledges that Platform approval does not constitute an inspection or endorsement of the Chef's kitchen or food preparation standards.

5. Quality, Safety & Incident Reporting

5.1 The Chef agrees to promptly notify the Platform of:

• Any customer complaint related to food safety, illness, contamination, or allergens
• Any incident that may pose a risk to customer health or platform reputation

5.2 The Platform reserves the right to:

• Temporarily suspend listings
• Remove the Chef from the Platform
• Require corrective action prior to reinstatement

6. Indemnification & Liability Allocation

6.1 Indemnification by Chef.
To the fullest extent permitted by law, the Chef agrees to indemnify, defend, and hold harmless the Platform, its directors, officers, employees, contractors, and affiliates from and against any and all claims, demands, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising out of or related to (1) Foodborne illness, contamination, or injury caused by food prepared by the Chef (2) The Chef's negligence, recklessness, or misconduct (3) The Chef's failure to comply with applicable food safety or health regulations (4) Misrepresentation of ingredients, allergens, or preparation methods
6.2 The Chef acknowledges that this indemnification obligation survives termination of this Agreement.
6.3 The Platform does not waive any consumer rights under applicable law and does not limit liability where such limitation would be unlawful.

7. Insurance (Optional)

7.1 The Platform may recommend that the Chef maintain product liability or commercial general liability insurance.
7.2 Proof of insurance may be requested at the Platform's discretion.
7.3 Failure to maintain insurance will not automatically restrict access, but may be considered as part of broader risk or compliance reviews.

8. Payments & Fees

8.1 By using the Platform, the Chef authorizes the Platform to facilitate payment collection on the Chef's behalf through a third-party payment processor, currently Stripe Payments Canada, Ltd. ("Payment Processor"). By using the Platform, the Chef agrees to be bound by the Payment Processor's applicable terms, policies, and requirements, as amended from time to time.
8.2 Platform Commission & Fees
The Platform charges the Chef a commission on each completed order processed through the Platform.

• The current commission rate is 10% of the order subtotal, exclusive of applicable taxes, delivery fees, or payment processor fees.
• Payment processing fees charged by the Payment Processor may be deducted separately.
• The Platform may update commission rates or fees upon reasonable notice through the Platform interface or a published Fee Schedule.
• Continued use of the Platform after notice of updated fees constitutes acceptance of those changes.

8.3 Payout Methodology
Subject to this Agreement and Payment Processor requirements:

• Net payouts (order amount minus applicable commissions, fees, refunds, or adjustments) will be disbursed to the Chef's designated bank account.
• Payouts are typically initiated on a weekly basis, subject to:
  • Payment Processor settlement timelines
  • Verification, dispute resolution, or compliance reviews
• The Platform does not guarantee payout timing and is not responsible for delays caused by banking institutions or the Payment Processor.

8.4 Holding Periods
The Platform may apply short holding periods on funds to manage:

• Customer disputes or chargebacks
• Refund requests
• Suspected fraud or policy violations
• Food safety or regulatory investigations

Funds may be withheld, offset, or adjusted until the matter is resolved.

8.5 Refunds, Disputes & Chargebacks

• The Platform may issue refunds to customers at its discretion in cases of:
  • Food safety concerns
  • Misrepresentation of ingredients or allergens
  • Order cancellation or failure to fulfill
• Refunded amounts, including associated fees, may be deducted from the Chef's pending or future payouts.
• Chargebacks initiated by customers may result in:
• Temporary payout suspension
• Additional administrative fees
• Account review or termination in repeated cases

8.6 Taxes
The Chef acknowledges and agrees that they are solely responsible for:

• Reporting and remitting all applicable taxes, including HST/GST, income tax, and any local levies
• Determining whether tax registration is required under applicable law

The Platform does not provide tax advice and does not assume tax liability on behalf of the Chef.

9. Termination

9.1 Either the Platform or the Chef may terminate participation with 90 days' notice through the Platform or in writing.
9.2 The Platform may terminate or suspend the Chef immediately, without notice, in cases of:

• Suspected food safety violations
• Customer health complaints
• Regulatory non-compliance
• Reputational risk to the Platform

9.3 Upon termination, the Chef must cease using the Platform and remove references to affiliation.

10. Confidentiality

10.1 The Chef agrees not to disclose non-public Platform information, including customer data, pricing algorithms, or operational materials.

11. Governing Law

11.1 This Agreement is governed by the laws of the Province of Ontario, Canada, without regard to conflict of laws principles.

12. Payment Processor Limitation of Liability

The Platform is not responsible for the acts, omissions, errors, service interruptions, or failures of any third-party payment processor. The Chef acknowledges that payment services are provided directly by the Payment Processor and are subject to its terms and risk controls.

13. Entire Agreement & Amendments

13.1 This Agreement constitutes the entire agreement between the Parties.
13.2 The Platform may update this Agreement from time to time. Continued use of the Platform after notice of updates constitutes acceptance.

By clicking "I Agree," creating a chef account, listing meals, or accepting orders on the Platform, you confirm that you have read, understood, and agreed to this Agreement.

APPENDIX A — Regulatory Compliance & Platform Adaptability

A1. Regulatory Landscape
Food preparation, sale, and delivery may be subject to evolving laws and guidelines, including but not limited to:

• Provincial health regulations
• Municipal bylaws
• Food safety standards
• Marketplace or platform regulations

A2. Platform Adaptation Rights
The Platform reserves the right to:

• Update safety requirements
• Introduce verification steps
• Require additional disclosures
• Modify onboarding or listing requirements

These changes may be implemented to comply with:

• Legal obligations
• Public health directives
• Risk management best practices

A3. Chef Cooperation
The Chef agrees to:

• Promptly comply with new requirements
• Provide requested information or documentation
• Acknowledge updated policies within the Platform

Failure to comply may result in:

• Temporary suspension
• Removal of listings
• Termination of access

A4. No Retroactive Liability
Updates or new requirements do not create retroactive liability for past activity that was compliant at the time.

A5. Acceptance Through Continued Use
Continued use of the Platform after notice of compliance updates constitutes acceptance of those changes.
                            `}</Text>)}
                          {termsType === 'fee' && (
                            <Text style={styles.termsModalText}>{`
Fee Schedule - YourHomeChef

Last Updated: February 14, 2026

This Fee Schedule explains how fees and payouts work on the YourHomeChef platform. By using the Platform as a Chef, you agree to this Fee Schedule.

Platform Commission (Accepted by Use)

• A 10% platform commission is charged on each completed order
• Calculated on the order subtotal (before taxes and delivery fees)

Payment Processing Fees

Payments are processed through a third-party payment processor, currently Stripe.

• Stripe charges standard processing fees
• Applicable processing fees may be deducted prior to payout
• Rates are set by Stripe and may change independently

Net Earnings

You receive:

• Order subtotal minus platform commission, refunds, and applicable adjustments

Payout Timing (Estimated)

• Payouts are typically issued instantly upon order completion.
• Timing depends on:
  • Stripe settlement timelines
  • Bank processing
  • Account verification or dispute reviews

Refunds & Adjustments

If a refund or adjustment is issued due to:

• Food safety concerns
• Order issues
• Misrepresentation (ingredients, allergens, availability)

The refunded amount (and related fees) may be deducted from pending or future payouts.

No Guarantees

YourHomeChef makes no guarantees regarding sales volume, income, or order frequency.

Fee Updates

Fees may be updated from time to time with reasonable notice. Continued use of the Platform after such notice constitutes acceptance of the updated Fee Schedule.

Questions?

For questions, contact support at thereforyou.yhc@gmail.com
                            `}</Text>)}
                          {termsType === 'payout' && (
                            <>
                              <Text style={styles.termsModalText}>{`
How payouts work
(Accepted by using the Platform)

This section explains how payouts are calculated and processed.

Customer places an order

• Customer pays through the app
• You receive an order notification

You prepare the meal

• You fulfill the order as listed
• You are responsible for accurate ingredient and allergen disclosures

The payment is processed

• Platform commission (10%) is applied
• Payment processing fees are deducted

A short review or holding period may apply

Funds may be temporarily held for:

• Refunds
• Disputes
• Safety or compliance checks

(This helps manage disputes, refunds, and compliance risks.)

Payouts are typically initiated daily, subject to processor and bank timelines

• Net earnings (after fees, refunds, and adjustments) are sent to your designated bank account.
• You'll see a full payout breakdown in your dashboard

Your dashboard will show
`}</Text>
                              <View style={{ marginTop: 8, gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />
                                  <Text style={styles.termsModalText}>Order totals</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />
                                  <Text style={styles.termsModalText}>Fees & deductions</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />
                                  <Text style={styles.termsModalText}>Refunds (if any)</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Image source={require('../../assets/success.png')} style={{ width: 20, height: 20, tintColor: PRIMARY_COLOR }} resizeMode="contain" />
                                  <Text style={styles.termsModalText}>Payout status</Text>
                                </View>
                              </View>
                              <Text style={styles.termsModalText}>{`

No subscriptions. No long-term commitments. Continued use of the Platform confirms acceptance of this payout process.
`}</Text>
                            </>
                          )}
                        </ScrollView>
                        <View style={styles.termsModalFooter}>
                          <TouchableOpacity
                            onPress={() => {
                              if (termsScrolledToBottom) {
                                // Mark the corresponding agreement as accepted
                                if (termsType === 'agreement') {
                                  setAgreementAccepted(true);
                                } else if (termsType === 'fee') {
                                  setFeeAccepted(true);
                                } else if (termsType === 'payout') {
                                  setPayoutAccepted(true);
                                }
                                setShowTermsModal(false);
                                setTermsType(null);
                                setTermsScrolledToBottom(false);
                                setTermsAccepted(false);
                              }
                            }}
                            disabled={!termsScrolledToBottom}
                            style={[
                              styles.termsAcceptButton,
                              !termsScrolledToBottom && styles.termsAcceptButtonDisabled
                            ]}
                          >
                            <Text style={[
                              styles.termsAcceptButtonText,
                              !termsScrolledToBottom && styles.termsAcceptButtonTextDisabled
                            ]}>
                              I Accept
                            </Text>
                          </TouchableOpacity>
                    </View>
                  </View>
                    </View>
                  </Modal>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.backButton, busy && styles.backButtonDisabled]}
                      onPress={handleBack}
                      disabled={busy}
                    >
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep5 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep5 || busy}
                    >
                      <Text style={[styles.nextButtonText, { fontWeight: '400', fontFamily: theme.typography.fontFamily.body }]} numberOfLines={1}>Agree & continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : step === 5 ? (
                <>
                  {/* Step 5: Review & Go Live */}
                  <Text style={[styles.sectionTitle, { borderBottomWidth: 0, paddingBottom: 0 }]}>Review & go live!</Text>
                  <Text style={styles.sectionSubtitle}>Check everything before accepting orders.</Text>
                  
                  {/* Review Sections */}
                  <View style={{ gap: theme.spacing.xl, marginTop: theme.spacing.xl }}>
                    {/* Chef profile basics */}
                    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: BORDER_LIGHT }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                        <Text style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT }}>
                          Chef profile basics
                        </Text>
                        <TouchableOpacity onPress={() => setStep(1)}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm }}>
                            Edit details
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ gap: theme.spacing.xs }}>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Full name:</Text> {fullName || 'Not set'}
                        </Text>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Brand name:</Text> {brandName || 'Not set'}
                        </Text>
                        {briefDescription && (
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Brief description:</Text> {briefDescription}
                          </Text>
                        )}
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Cuisine type:</Text> {cuisineType.length > 0 ? cuisineType.join(', ') : 'Not set'}
                        </Text>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Phone:</Text> {phone || 'Not set'}
                        </Text>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Email:</Text> {email || 'Not set'}
                        </Text>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Address:</Text> {address || 'Not set'}
                        </Text>
                      </View>
                    </View>

                    {/* Availability & pickup */}
                    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: BORDER_LIGHT }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                        <Text style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT }}>
                          Availability & pickup
                        </Text>
                        <TouchableOpacity onPress={() => setStep(2)}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm }}>
                            Edit details
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {pickupSlots.length > 0 ? (
                        <View style={{ gap: theme.spacing.xs }}>
                          {(() => {
                            // Group slots by day
                            const slotsByDay: { [day: string]: string[] } = {};
                            pickupSlots.forEach(slot => {
                              if (!slotsByDay[slot.day]) {
                                slotsByDay[slot.day] = [];
                              }
                              slotsByDay[slot.day].push(slot.timeWindow);
                            });

                            // Helper function to find consecutive time windows and create ranges
                            const findConsecutiveRanges = (timeWindowValues: string[]): Array<{ start: string; end: string; indices: number[] }> => {
                              if (timeWindowValues.length === 0) return [];
                              
                              // Sort time windows by their hour value
                              const sorted = [...timeWindowValues].sort((a, b) => {
                                const hourA = parseInt(a.split(':')[0]);
                                const hourB = parseInt(b.split(':')[0]);
                                return hourA - hourB;
                              });
                              
                              const ranges: Array<{ start: string; end: string; indices: number[] }> = [];
                              let currentRange: { start: string; end: string; indices: number[] } | null = null;
                              
                              sorted.forEach((timeWindow) => {
                                const hour = parseInt(timeWindow.split(':')[0]);
                                const endHour = parseInt(timeWindow.split('-')[1].split(':')[0]);
                                
                                if (!currentRange) {
                                  currentRange = {
                                    start: timeWindow,
                                    end: timeWindow,
                                    indices: [timeWindowValues.indexOf(timeWindow)]
                                  };
                                } else {
                                  const lastEndHour = parseInt(currentRange.end.split('-')[1].split(':')[0]);
                                  // Check if this time window is consecutive (starts where the last one ended)
                                  if (hour === lastEndHour) {
                                    currentRange.end = timeWindow;
                                    currentRange.indices.push(timeWindowValues.indexOf(timeWindow));
                                  } else {
                                    // Save current range and start a new one
                                    ranges.push(currentRange);
                                    currentRange = {
                                      start: timeWindow,
                                      end: timeWindow,
                                      indices: [timeWindowValues.indexOf(timeWindow)]
                                    };
                                  }
                                }
                              });
                              
                              if (currentRange) {
                                ranges.push(currentRange);
                              }
                              
                              return ranges;
                            };

                            // Helper function to format time range
                            const formatTimeRange = (startWindow: string, endWindow: string): string => {
                              const startHour = parseInt(startWindow.split(':')[0]);
                              const endHour = parseInt(endWindow.split('-')[1].split(':')[0]);
                              
                              const startHour12 = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
                              const startHour12Padded = startHour12.toString().padStart(2, '0');
                              const startAmpm = startHour < 12 ? 'AM' : 'PM';
                              
                              const endHour12 = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
                              const endHour12Padded = endHour12.toString().padStart(2, '0');
                              const endAmpm = endHour < 12 ? 'AM' : 'PM';
                              
                              return `${startHour12Padded}:00 ${startAmpm} - ${endHour12Padded}:00 ${endAmpm}`;
                            };

                            // Generate time windows for label lookup
                            const timeWindows: Array<{ value: string; label: string }> = [];
                            for (let hour = 8; hour <= 20; hour++) {
                              const endHour = hour + 1;
                              const hour12Start = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const hour12StartPadded = hour12Start.toString().padStart(2, '0');
                              const ampmStart = hour < 12 ? 'AM' : 'PM';
                              const hour12End = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
                              const hour12EndPadded = hour12End.toString().padStart(2, '0');
                              const ampmEnd = endHour < 12 ? 'AM' : 'PM';
                              timeWindows.push({
                                value: `${hour.toString().padStart(2, '0')}:00-${endHour.toString().padStart(2, '0')}:00`,
                                label: `${hour12StartPadded}:00 ${ampmStart} - ${hour12EndPadded}:00 ${ampmEnd}`,
                              });
                            }
                            
                            return Object.entries(slotsByDay).map(([day, timeWindowsForDay]) => {
                              const ranges = findConsecutiveRanges(timeWindowsForDay);
                              
                              return ranges.map((range, rangeIdx) => {
                                const isSingleSlot = range.start === range.end;
                                const timeLabel = isSingleSlot 
                                  ? (timeWindows.find(tw => tw.value === range.start)?.label || range.start)
                                  : formatTimeRange(range.start, range.end);
                                
                                return (
                                  <View key={`${day}-${rangeIdx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                                    <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                                      {day} • {timeLabel}
                                    </Text>
                                  </View>
                                );
                              });
                            }).flat();
                          })()}
                        </View>
                      ) : (
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          No time slots selected
                        </Text>
                      )}
                    </View>

                    {/* Dishes */}
                    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: BORDER_LIGHT }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                        <Text style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT }}>
                          Dishes
                        </Text>
                        <TouchableOpacity onPress={() => setStep(3)}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm }}>
                            Edit details
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {dishes.length > 0 ? (
                        <View style={{ gap: theme.spacing.md }}>
                          {dishes.map((dish, index) => (
                            <View key={dish.id} style={{ padding: theme.spacing.md, backgroundColor: BACKGROUND_LIGHT, borderRadius: theme.radius.md, borderWidth: 1, borderColor: BORDER_LIGHT }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xs }}>
                                <Text style={{ fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT, flex: 1 }}>
                                  {dish.name}
                                </Text>
                                <Text style={{ fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.bold as any, color: PRIMARY_COLOR }}>
                                  ${dish.price.toFixed(2)}
                                </Text>
                              </View>
                              {dish.portion && (
                                <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.xs }}>
                                  Portion: {dish.portion}
                                </Text>
                              )}
                              {dish.description && (
                                <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.xs }}>
                                  {dish.description}
                                </Text>
                              )}
                              {dish.ingredients && (
                                <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.sm }}>
                                  Ingredients: {dish.ingredients}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          No dishes added
                        </Text>
                      )}
                    </View>

                    {/* Food safety acknowledgement */}
                    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: BORDER_LIGHT }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                        <Text style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT }}>
                          Food safety acknowledgement
                        </Text>
                        <TouchableOpacity onPress={() => setStep(4)}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm }}>
                            Edit details
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Agreements */}
                      <View style={{ marginBottom: theme.spacing.md }}>
                        <Text style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT, marginBottom: theme.spacing.xs }}>
                          Agreements:
                        </Text>
                        <View style={{ gap: theme.spacing.xs }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                            <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                              {agreementAccepted ? '✓' : '✗'} Chef Participation Agreement
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                            <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                              {feeAccepted ? '✓' : '✗'} Fee Schedule
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                            <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                              {payoutAccepted ? '✓' : '✗'} Payouts & Payments
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Checkboxes */}
                      <View>
                        <Text style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.bold as any, color: TEXT_LIGHT, marginBottom: theme.spacing.xs }}>
                          Acknowledgements:
                        </Text>
                        <View style={{ gap: theme.spacing.xs }}>
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            {allergensDisclosed ? '✓' : '✗'} I'll clearly list ingredients & allergens
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            {foodSafetyAcknowledged ? '✓' : '✗'} I'll prepare food safely and responsibly
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            {platformInspectionUnderstood ? '✓' : '✗'} I understand the platform doesn't inspect food
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.backButton, busy && styles.backButtonDisabled]}
                      onPress={handleBack}
                      disabled={busy}
                    >
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitButton, (!canSubmit || busy) && styles.submitButtonDisabled]}
                      onPress={submit}
                      disabled={!canSubmit || busy}
                    >
                      <Text style={styles.submitButtonText}>{busy ? 'Submitting...' : 'Go live!'}</Text>
        </TouchableOpacity>
                  </View>
                </>
              ) : null}

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

// NewDishForm component for step 3
function NewDishForm({ onCreate, saving }: { onCreate: (d: { name: string; price: number; portion?: string; description?: string; ingredients?: string; file?: File | null; preview?: string }) => void; saving: boolean }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [portion, setPortion] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const valid = name.trim().length > 0 && Number(price) > 0;

  return (
    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24, marginBottom: 16 }}>
      <Text style={{ color: TEXT_LIGHT, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Add a new dish</Text>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
          <View style={{ flex: isMobile ? undefined : 2, minWidth: isMobile ? undefined : 200 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Chicken Biryani"
              placeholderTextColor={TEXT_MUTED}
              style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
            />
          </View>
          <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Price</Text>
            <View style={{ position: 'relative' }}>
              <Text style={{ position: 'absolute', left: 12, top: 12, color: TEXT_MUTED, zIndex: 1 }}>$</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="19.99"
                placeholderTextColor={TEXT_MUTED}
                style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, paddingLeft: 28, minHeight: 40 }}
              />
            </View>
          </View>
          <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Portion</Text>
            <TextInput
              value={portion}
              onChangeText={setPortion}
              placeholder="e.g., 2 servings, 500g"
              placeholderTextColor={TEXT_MUTED}
              style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
            />
          </View>
          <View style={{ minWidth: isMobile ? undefined : 200, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Photo</Text>
            {preview ? (
              <View style={{ gap: 8 }}>
                <Image 
                  source={{ uri: preview }} 
                  style={{ width: isMobile ? '100%' : 192, height: 192, borderRadius: 8, backgroundColor: '#EEE', marginBottom: 8 }} 
                />
                <FilePicker 
                  label="Replace Image" 
                  onFile={(f) => { 
                    if (preview) URL.revokeObjectURL(preview);
                    setFile(f); 
                    setPreview(URL.createObjectURL(f)); 
                  }} 
                  accept="image/*" 
                />
              </View>
            ) : (
              <FilePicker 
                label="Choose Image" 
                onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} 
                accept="image/*" 
              />
            )}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Aromatic rice with tender chicken…"
            placeholderTextColor={TEXT_MUTED}
            multiline
            numberOfLines={3}
            style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Ingredients & allergens</Text>
          <TextInput
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Contains peanuts, dairy, gluten..."
            placeholderTextColor={TEXT_MUTED}
            multiline
            numberOfLines={2}
            style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableOpacity
            onPress={() => {
              onCreate({ name: name.trim(), price: Number(price), portion: portion.trim(), description: description.trim(), ingredients: ingredients.trim(), file, preview });
              setName('');
              setPrice('');
              setPortion('');
              setDescription('');
              setIngredients('');
              setFile(null);
              setPreview(null);
            }}
            disabled={!valid || saving}
            style={{ 
              backgroundColor: (!valid || saving) ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, 
              paddingVertical: 10, 
              paddingHorizontal: 24, 
              borderRadius: 8,
              opacity: (!valid || saving) ? 0.6 : 1
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '400', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>{saving ? 'Saving…' : 'Add Dish'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// DishEditor component for step 3
function DishEditor({ dish, onSave, onDelete, saving }: { dish: { id: string; name: string; price: number; portion?: string; description?: string; ingredients?: string; image?: string; file?: File | null }; onSave: (p: { id?: string; name?: string; price?: number | string; portion?: string; description?: string; ingredients?: string; file?: File | null; preview?: string }) => void; onDelete: () => void; saving: boolean }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [name, setName] = useState(dish.name || '');
  const [price, setPrice] = useState(String(dish.price ?? ''));
  const [portion, setPortion] = useState(dish.portion || '');
  const [description, setDescription] = useState(dish.description || '');
  const [ingredients, setIngredients] = useState(dish.ingredients || '');
  const [file, setFile] = useState<File | null>(dish.file || null);
  const [preview, setPreview] = useState<string | null>(dish.image || '');

  return (
    <View style={{ backgroundColor: CARD_LIGHT, borderRadius: 8, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 24 }}>
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 24 }}>
        <Image 
          source={{ uri: preview || 'https://placehold.co/192x192?text=Dish' }} 
          style={{ 
            width: isMobile ? '100%' : 192, 
            height: 192, 
            borderRadius: 8, 
            backgroundColor: '#EEE',
            maxWidth: isMobile ? '100%' : 192
          }} 
        />
        <View style={{ flex: 1, gap: 16 }}>
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
            <View style={{ flex: isMobile ? undefined : 2, minWidth: isMobile ? undefined : 200 }}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Dish name"
                placeholderTextColor={TEXT_MUTED}
                style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
              />
            </View>
            <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Price</Text>
              <View style={{ position: 'relative' }}>
                <Text style={{ position: 'absolute', left: 12, top: 12, color: TEXT_MUTED, zIndex: 1 }}>$</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={TEXT_MUTED}
                  style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, paddingLeft: 28, minHeight: 40 }}
                />
              </View>
            </View>
            <View style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? undefined : 120 }}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Portion</Text>
              <TextInput
                value={portion}
                onChangeText={setPortion}
                placeholder="e.g., 2 servings, 500g"
                placeholderTextColor={TEXT_MUTED}
                style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 40 }}
              />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the dish"
              placeholderTextColor={TEXT_MUTED}
              multiline
              numberOfLines={2}
              style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Ingredients & allergens</Text>
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="List ingredients and allergens"
              placeholderTextColor={TEXT_MUTED}
              multiline
              numberOfLines={2}
              style={{ backgroundColor: CARD_LIGHT, color: TEXT_LIGHT, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ 
            flexDirection: isMobile ? 'column' : 'row', 
            gap: 16, 
            alignItems: isMobile ? 'stretch' : 'center',
            width: '100%'
          }}>
            <View>
              <FilePicker 
                label="Replace Photo" 
                onFile={(f) => { 
                  if (preview && preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                  }
                  setFile(f); 
                  setPreview(URL.createObjectURL(f)); 
                }} 
                accept="image/*" 
              />
            </View>
            {!isMobile && <View style={{ flex: 1 }} />}
            <View style={{ 
              flexDirection: 'row', 
              gap: 8
            }}>
              <TouchableOpacity
                onPress={() => onSave({ id: dish.id, name: name.trim(), price: price, portion: portion.trim(), description: description.trim(), ingredients: ingredients.trim(), file, preview })}
                disabled={saving}
                style={{ 
                  backgroundColor: saving ? PRIMARY_COLOR + '80' : PRIMARY_COLOR, 
                  paddingVertical: 10, 
                  paddingHorizontal: 24, 
                  borderRadius: 8,
                  opacity: saving ? 0.6 : 1
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '400', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete()}
                disabled={saving}
                style={{ 
                  backgroundColor: '#DC2626', 
                  paddingVertical: 10, 
                  paddingHorizontal: 16, 
                  borderRadius: 8,
                  opacity: saving ? 0.6 : 1
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '400', fontSize: 14, fontFamily: theme.typography.fontFamily.body }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: 0,
    }),
    // Prevent last content from being hidden under fixed footer/nav.
    paddingBottom: Platform.select({
      web: 140,
      default: 160,
    }) as any,
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
    alignItems: 'flex-start',
    marginBottom: theme.spacing['2xl'],
    width: '100%',
  },
  headerImage: {
    width: '100%',
    maxWidth: 600,
    height: Platform.select({ web: 200, default: 150 }),
    marginBottom: theme.spacing.lg,
    alignSelf: 'center',
  },
  title: {
    color: TEXT_LIGHT,
    fontSize: Platform.select({ web: 48, default: 14 }),
    fontWeight: theme.typography.fontWeight.black as any, fontFamily: theme.typography.fontFamily.display,
    letterSpacing: -0.02,
    textAlign: 'left',
    marginBottom: theme.spacing.md,
    flexWrap: 'nowrap',
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.lg, fontFamily: theme.typography.fontFamily.body,
    textAlign: 'left',
  },
  card: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: CARD_LIGHT,
    borderRadius: theme.radius.xl,
    padding: Platform.select({ web: theme.spacing['2xl'], default: theme.spacing.sm }),
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
    fontFamily: theme.typography.fontFamily.body,
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
  progressSubtext: {
    marginTop: theme.spacing.xs,
    color: TEXT_MUTED,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  form: {
    gap: theme.spacing['2xl'],
  },
  sectionTitle: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any, fontFamily: theme.typography.fontFamily.display,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  formGrid: {
    flexDirection: 'column',
    marginBottom: -theme.spacing.lg,
    width: '100%',
    alignItems: 'stretch',
    ...Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      },
    }),
  },
  field: {
    marginBottom: theme.spacing.lg,
    width: '100%',
    marginRight: 0,
    alignSelf: 'stretch',
    ...Platform.select({
      web: {
        width: '48%',
        maxWidth: 290, // Half of 600px minus margin
        marginRight: '4%',
        alignSelf: 'flex-start',
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
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
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
    fontSize: theme.typography.fontSize.base, fontFamily: theme.typography.fontFamily.body,
    fontStyle: 'normal',
  },
  inputFocused: {
    borderColor: PRIMARY_COLOR,
  },
  inputReadOnly: {
    backgroundColor: '#F9FAFB',
    color: TEXT_MUTED,
  },
  validationHint: {
    marginTop: 6,
    color: TEXT_MUTED,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  textArea: {
    height: 120,
    maxWidth: 600,
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
    fontSize: theme.typography.fontSize.base, fontFamily: theme.typography.fontFamily.body,
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
    fontSize: theme.typography.fontSize.base, fontFamily: theme.typography.fontFamily.body,
    marginRight: theme.spacing.xs,
  },
  trustText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
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
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    height: 48,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  message: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.body,
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
    fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.body,
    marginBottom: theme.spacing.xs,
  },
  noticeLink: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  checkbox: {
    width: 24,
    height: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {},
  checkboxLabel: {
    flex: 1,
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  link: {
    color: PRIMARY_COLOR,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
  },
  hint: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: theme.spacing.xs,
    fontStyle: 'normal',
  },
  validationError: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  locationPickerContainer: {
    width: '100%',
    maxWidth: 600,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing.md,
  },
  dropdownButtonText: {
    flex: 1,
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  dropdownPlaceholder: {
    color: TEXT_MUTED,
  },
  dropdownArrow: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  dropdownModal: {
    backgroundColor: CARD_LIGHT,
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        maxHeight: 600,
      },
    }),
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  dropdownTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: TEXT_LIGHT,
  },
  dropdownCloseButton: {
    padding: theme.spacing.xs,
  },
  dropdownCloseText: {
    fontSize: theme.typography.fontSize.xl,
    color: TEXT_MUTED,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  dropdownItemSelected: {
    backgroundColor: '#fff5f2',
  },
  dropdownItemText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_LIGHT,
  },
  dropdownItemTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  dropdownCheckmark: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  dropdownDoneButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    margin: theme.spacing.lg,
    alignItems: 'center',
  },
  dropdownDoneText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_MUTED,
    marginBottom: theme.spacing.xl,
    textAlign: 'left',
  },
  selectedPickupTimes: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: BACKGROUND_LIGHT,
    borderRadius: theme.radius.lg,
  },
  selectedPickupTimesLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: TEXT_LIGHT,
    marginBottom: theme.spacing.sm,
  },
  selectedPickupTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
    justifyContent: 'space-between',
  },
  removeSlotButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  removeSlotButtonText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  selectedPickupTimeText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_MUTED,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: CARD_LIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.select({ ios: 34, default: 20 }),
    maxHeight: '70%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  pickerModalCancel: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
  },
  pickerModalTitle: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  pickerModalConfirm: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  inlinePickerContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
  },
  inlinePickerWheel: {
    flex: 1,
    alignItems: 'center',
  },
  inlinePickerLabel: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  pickerWheelContainer: {
    maxHeight: 300,
    position: 'relative',
  },
  pickerWheelContent: {
    paddingTop: 20,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  pickerWheelItem: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 8,
  },
  pickerWheelItemSelected: {
    // Selected item styling handled by text color
  },
  pickerWheelText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    opacity: 0.4,
    textAlign: 'center',
  },
  pickerWheelTextSelected: {
    color: PRIMARY_COLOR,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontSize: theme.typography.fontSize.base,
    opacity: 1,
    textAlign: 'center',
  },
  pickerWheelCheckmark: {
    color: PRIMARY_COLOR,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  addPickupTimeButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    margin: theme.spacing.lg,
    alignItems: 'center',
  },
  addPickupTimeButtonDisabled: {
    opacity: 0.6,
  },
  addPickupTimeButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  termsModalContent: {
    backgroundColor: CARD_LIGHT,
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  termsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  termsModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_LIGHT,
    flex: 1,
  },
  termsModalClose: {
    fontSize: 24,
    color: TEXT_MUTED,
    fontWeight: 'bold',
  },
  termsModalBody: {
    padding: theme.spacing.lg,
    paddingTop: 0,
    maxHeight: 400,
  },
  termsModalText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_LIGHT,
    lineHeight: 24,
  },
  termsModalFooter: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  termsAcceptButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
  },
  termsAcceptButtonDisabled: {
    backgroundColor: TEXT_MUTED,
    opacity: 0.5,
  },
  termsAcceptButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.body,
  },
  termsAcceptButtonTextDisabled: {
    color: '#FFFFFF',
  },
});
