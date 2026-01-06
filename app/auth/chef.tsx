'use client';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet, ScrollView, Alert, Modal, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureProfile } from '../../lib/ensureProfile';
import { ensureSession } from '../../lib/session';
import { Screen } from '../../components/Screen';
import { theme } from '../../lib/theme';
import LocationPicker from '../../components/LocationPicker';
import FilePicker from '../../components/FilePicker';
import { uploadToBucket } from '../../lib/upload';

// Colors from HTML design
const PRIMARY_COLOR = '#FE734C';
const BACKGROUND_LIGHT = '#F4F4F4';
const CARD_LIGHT = '#FFFFFF';
const BORDER_LIGHT = '#e2e8f0';
const TEXT_LIGHT = '#264653';
const TEXT_MUTED = '#6b7280';

export default function ChefSignup() {
  const router = useRouter();
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
  const [email, setEmail] = useState('');
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
  const [existingApplication, setExistingApplication] = useState<{ id: string; status: string } | null>(null);
  const [isAlreadyChef, setIsAlreadyChef] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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

  const canProceedToStep2 = fullName && brandName && briefDescription && cuisineType.length > 0 && phone && email && address;
  const canProceedToStep3 = pickupSlots.length > 0;
  const canProceedToStep4 = dishes.length > 0; // At least one dish required
  const canProceedToStep5 = foodSafetyAcknowledged && allergensDisclosed && platformInspectionUnderstood && agreementAccepted && feeAccepted && payoutAccepted;
  const canSubmit = true; // All validations are done in previous steps

  function handleNext() {
    if (step === 1 && canProceedToStep2) {
      setStep(2);
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
      setMsg('Dish added ✓');
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

      setMsg('Dish updated ✓');
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
        setMsg('Dish deleted ✓');
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
          setMsg('Dish deleted ✓');
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
          email, 
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
          const sessionResult = await ensureSession(supabase, email, tempPassword);
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
            email: email || null,
            phone: phone || null,
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
            email: email || null,
            phone: phone || null,
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

      // 8) Navigate to chef dashboard
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

  const progress = (step - 1) * 20; // Step 1 = 0%, Step 2 = 20%, Step 3 = 40%, Step 4 = 60%, Step 5 = 80%
  const stepTitles = ['Personal Info', 'Availability & Pickup', 'Menu', 'About You', 'Agreement'];
  const stepTitle = stepTitles[step - 1] || '';

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Page Heading */}
          <View style={styles.heading}>
            <Text style={styles.title}>Chef profile basics</Text>
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
            </View>

            <View style={styles.form}>
              {step === 1 ? (
                <>
                  {/* Form Fields */}
                    {/* Full Name Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Full Name</Text>
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
                        <Text style={styles.label}>Brand Name</Text>
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
                        <Text style={styles.label}>Brief Description</Text>
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
                        <Text style={styles.label}>Cuisine Type</Text>
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
                              <Text style={styles.dropdownTitle}>Select Cuisine Types</Text>
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
            onChangeText={setPhone}
                        placeholder="(123) 456-7890"
                        style={[styles.input, focusedInput === 'phone' && styles.inputFocused]}
                        keyboardType="phone-pad"
                        onFocus={() => setFocusedInput('phone')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <Text style={styles.hint}>Share a contact number for customers.</Text>
                    </View>

                    {/* Email Field */}
                    <View style={[styles.field, styles.fieldFull]}>
                      <View style={styles.fieldLabel}>
                        <Text style={styles.label}>Email</Text>
                      </View>
                        <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        style={[styles.input, styles.inputReadOnly, focusedInput === 'email' && styles.inputFocused]}
                        keyboardType="email-address"
                          autoCapitalize="none"
                        editable={false}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                      />
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
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep3 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep3 || busy}
                    >
                      <Text style={styles.nextButtonText}>Next Step</Text>
                      <Text style={styles.nextButtonIcon}>→</Text>
                    </TouchableOpacity>
                      </View>
                </>
              ) : step === 3 ? (
                <>
                  {/* Step 3: Dish Management */}
                  <Text style={[styles.sectionTitle, { borderBottomWidth: 0, paddingBottom: 0 }]}>Create your first dish!</Text>
                  <Text style={styles.sectionSubtitle}>Draft it first — nothing goes live yet.</Text>
                  
                  {msg && (
                    <View style={{ backgroundColor: PRIMARY_COLOR + '20', borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                      <Text style={{ color: TEXT_LIGHT, fontWeight: '700' }}>{msg}</Text>
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
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep4 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep4 || busy}
                    >
                      <Text style={styles.nextButtonText}>Next Step</Text>
                      <Text style={styles.nextButtonIcon}>→</Text>
                    </TouchableOpacity>
                      </View>
                </>
              ) : step === 4 ? (
                <>
                  {/* Step 4: Food Safety & Payout Acknowledgement */}
                  {/* Food Safety & Payout Acknowledgement Section */}
                  <View style={[styles.field, styles.fieldFull, { marginTop: theme.spacing['2xl'] }]}>
                    <Text style={styles.sectionTitle}>Food safety & payout acknowledgement</Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base, marginBottom: theme.spacing.md }}>
                      You're responsible for preparation.
                    </Text>
                    <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base, marginBottom: theme.spacing.lg }}>
                      We securely handle payments.
                    </Text>

                    {/* Links */}
                    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('agreement');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, textDecorationLine: 'underline' }}>
                            Chef Participation Agreement
                          </Text>
                        </TouchableOpacity>
                        {agreementAccepted && <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('fee');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, textDecorationLine: 'underline' }}>
                            Fee Schedule
                          </Text>
                        </TouchableOpacity>
                        {feeAccepted && <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        <TouchableOpacity onPress={() => {
                          setTermsType('payout');
                          setShowTermsModal(true);
                          setTermsScrolledToBottom(false);
                          setTermsAccepted(false);
                        }}>
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, textDecorationLine: 'underline' }}>
                            Payouts & Payments
                          </Text>
                        </TouchableOpacity>
                        {payoutAccepted && <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.base, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                    </View>

                    {/* Checkboxes */}
                    <View style={{ gap: theme.spacing.md }}>
                  <TouchableOpacity 
                    style={styles.checkboxContainer} 
                        onPress={() => setFoodSafetyAcknowledged(!foodSafetyAcknowledged)}
                    activeOpacity={0.8}
                  >
                        <View style={[styles.checkbox, foodSafetyAcknowledged && styles.checkboxChecked]}>
                          {foodSafetyAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                          I'm responsible for food preparation and safety
                    </Text>
                  </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => setAllergensDisclosed(!allergensDisclosed)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, allergensDisclosed && styles.checkboxChecked]}>
                          {allergensDisclosed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                        <Text style={styles.checkboxLabel}>
                          I'll accurately disclose allergens & ingredients
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.checkboxContainer} 
                        onPress={() => setPlatformInspectionUnderstood(!platformInspectionUnderstood)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, platformInspectionUnderstood && styles.checkboxChecked]}>
                          {platformInspectionUnderstood && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                        <Text style={styles.checkboxLabel}>
                          I understand the platform does not inspect food
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
                          <Text style={styles.termsModalText}>
                            {termsType === 'agreement' && `
PARTICIPATION AGREEMENT
(Marketplace Platform – Ontario, Canada)

This Home Chef Participation Agreement ("Agreement") is entered into as of [DATE], by and between: Your Home Chef Inc., a corporation incorporated under the laws of [Province/Federal], with its principal place of business at [Address] ("Platform"), and [CHEF LEGAL NAME], residing at [Address] ("Chef").
Together, the "Parties."

1. Purpose & Relationship of the Parties

1.1 The Platform operates an online marketplace that facilitates connections between independent food preparers ("Chefs") and customers seeking prepared meals.
1.2 The Chef is an independent contractor and not an employee, partner, joint venturer, agent, or representative of the Platform.
1.3 The Platform does not prepare, cook, package, or handle food, and does not control the methods, ingredients, or preparation of food beyond general marketplace requirements for safety and compliance.

2. Compliance With Laws & Food Safety

2.1 The Chef represents and warrants that they will comply at all times with all applicable federal, provincial, and municipal laws, regulations, and guidelines.
2.2 The Platform does not inspect, verify, or approve kitchens or food preparation methods. The Chef is solely responsible for the location, equipment, and preparation of food.
2.3 The Platform may suspend or terminate the Chef's access immediately if it believes the Chef is operating in violation of any applicable law.

3. Food Handler Certification

3.1 Chefs may or may not hold food safety certifications. The Platform does not verify or require certifications for listing meals.
3.2 The Chef acknowledges that compliance with local laws and safety practices is their responsibility.
3.3 Failure to follow applicable laws or unsafe practices may result in suspension or removal from the Platform.

4. Kitchen & Preparation Requirements

4.1 The Chef is solely responsible for:
• Kitchen cleanliness
• Ingredient sourcing
• Allergen disclosure
• Packaging and labeling accuracy

4.2 The Chef acknowledges that Platform approval does not constitute an inspection or endorsement of the Chef's kitchen or food preparation standards.

5. Quality, Safety & Incident Reporting

5.1 The Chef must immediately notify the Platform of:
• Any customer complaint related to food safety, illness, contamination, or allergens
• Any incident that may pose a risk to customer health or platform reputation

5.2 The Platform reserves the right to:
• Temporarily suspend listings
• Remove the Chef from the Platform
• Require corrective action prior to reinstatement

6. Indemnification & Liability Allocation

6.1 Chef Indemnification.
To the fullest extent permitted by law, the Chef agrees to indemnify, defend, and hold harmless the Platform, its directors, officers, employees, contractors, and affiliates from and against any and all claims, demands, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising out of or related to (1) Foodborne illness, contamination, or injury caused by food prepared by the Chef (2) The Chef's negligence, recklessness, or misconduct (3) The Chef's failure to comply with applicable food safety or health regulations (4) Misrepresentation of ingredients, allergens, or preparation methods
6.2 The Chef acknowledges that this indemnification obligation survives termination of this Agreement.
6.3 The Platform does not waive any consumer rights under applicable law and does not limit liability where such limitation would be unlawful.

7. Insurance (Optional)

7.1 The Platform may recommend that the Chef maintain product liability or commercial general liability insurance.
7.2 Proof of insurance may be requested at the Platform's discretion.
7.3 Failure to maintain insurance will not automatically restrict access but may be considered in suspension or removal decisions.

8. Payments & Fees

8.1 The Platform facilitates payment collection on behalf of the Chef through a third-party payment processor, currently Stripe Payments Canada, Ltd. ("Payment Processor"). By using the Platform, the Chef agrees to be bound by the Payment Processor's applicable terms, policies, and requirements, as amended from time to time.
8.2 Platform Commission & Fees
The Platform charges the Chef a commission on each completed order processed through the Platform.

• The current commission rate is 10% of the order subtotal, exclusive of applicable taxes, delivery fees, or payment processor fees.
• Payment processing fees charged by the Payment Processor may be deducted separately.
• The Platform may update commission rates or fees upon reasonable notice through the Platform interface or a published Fee Schedule.
• Continued use of the Platform after notice constitutes acceptance of updated fees.

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
The Chef is solely responsible for:

• Reporting and remitting all applicable taxes, including HST/GST, income tax, and any local levies
• Determining whether tax registration is required under applicable law

The Platform does not provide tax advice and does not assume tax liability on behalf of the Chef.

9. Termination

9.1 Either Party may terminate this Agreement with [X] days' written notice.
9.2 The Platform may terminate or suspend the Chef immediately, without notice, in cases of:

• Suspected food safety violations
• Customer health complaints
• Regulatory non-compliance
• Reputational risk to the Platform

9.3 Upon termination, the Chef must cease using the Platform and remove references to affiliation.

10. Confidentiality

10.1 The Chef agrees not to disclose non-public Platform information, including customer data, pricing algorithms, or operational materials.

11. Governing Law

11.1 This Agreement shall be governed by and construed in accordance with the laws of the Province of Ontario, without regard to conflict of laws principles.

12. Payment Processor Limitation of Liability

The Platform is not responsible for the acts, omissions, errors, service interruptions, or failures of any third-party payment processor. The Chef acknowledges that payment services are provided directly by the Payment Processor and are subject to its terms and risk controls.

13. Entire Agreement & Amendments

13.1 This Agreement constitutes the entire agreement between the Parties.
13.2 The Platform may update this Agreement upon written notice; continued use of the Platform constitutes acceptance.

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
A5. Continued Use = Acceptance
Continued use of the Platform after notice of compliance updates constitutes acceptance of those changes.
                            `}
                            {termsType === 'fee' && `
Fee Schedule - YourHomeChef

Last Updated: December 20, 2025

YourHomeChef is committed to transparent pricing. There are no sign-up fees, no monthly subscriptions, and no hidden charges.

Platform Commission

• 10% commission per completed order
• Calculated on the order subtotal (before taxes and delivery fees)

Payment Processing Fees

Payments are securely processed via Stripe.

• Stripe charges standard processing fees
• These fees may be deducted before payout
• Rates are set by Stripe and may change independently

What You Keep

You receive:

• Order subtotal – platform commission – refunds (if any)

Payout Timing

• Payouts are typically issued weekly
• Timing depends on:
  • Stripe settlement timelines
  • Bank processing
  • Account verification or dispute reviews

Refunds & Adjustments

If a refund is issued due to:

• Food safety concerns
• Order issues
• Misrepresentation (ingredients, allergens, availability)

The refunded amount (and related fees) may be deducted from current or future payouts.

No Guarantees

YourHomeChef does not guarantee sales volume, income, or order frequency.

Fee Updates

We may update fees with reasonable notice. Continued use of the platform means you accept the updated schedule.

Questions?

Contact support at support@yourhomechef.com
                            `}
                            {termsType === 'payout' && `
How payouts work?

Simple. Transparent. Weekly.

1. Customer places an order

• Customer pays through the app
• Payment is securely processed

2. You prepare the meal

• You fulfill the order as listed
• Accurate ingredients & allergens matter

3. The payment is processed

• Platform commission (10%) is applied
• Payment processing fees are deducted

4. Short review period

Funds may be temporarily held for:

• Refunds
• Disputes
• Safety or compliance checks

(This helps protect both chefs and customers.)

5. Weekly payout processed

• Net earnings are sent to your bank account
• You'll see a full payout breakdown in your dashboard

Your dashboard shows

✔ Order totals
✔ Fees & deductions
✔ Refunds (if any)
✔ Payout status

No subscriptions. No commitments. You control your menu.
                            `}
                          </Text>
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
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, (!canProceedToStep5 || busy) && styles.nextButtonDisabled]}
                      onPress={handleNext}
                      disabled={!canProceedToStep5 || busy}
                    >
                      <Text style={styles.nextButtonText}>Next Step</Text>
                      <Text style={styles.nextButtonIcon}>→</Text>
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
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm, textDecorationLine: 'underline' }}>
                            Edit details
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ gap: theme.spacing.xs }}>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Full Name:</Text> {fullName || 'Not set'}
                        </Text>
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Brand Name:</Text> {brandName || 'Not set'}
                        </Text>
                        {briefDescription && (
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Brief Description:</Text> {briefDescription}
                          </Text>
                        )}
                        <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                          <Text style={{ fontWeight: theme.typography.fontWeight.bold as any }}>Cuisine Type:</Text> {cuisineType.length > 0 ? cuisineType.join(', ') : 'Not set'}
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
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm, textDecorationLine: 'underline' }}>
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
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm, textDecorationLine: 'underline' }}>
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
                          <Text style={{ color: PRIMARY_COLOR, fontSize: theme.typography.fontSize.sm, textDecorationLine: 'underline' }}>
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
                            {foodSafetyAcknowledged ? '✓' : '✗'} Food preparation responsibility
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            {allergensDisclosed ? '✓' : '✗'} Allergen disclosure
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: theme.typography.fontSize.base }}>
                            {platformInspectionUnderstood ? '✓' : '✗'} Platform inspection understanding
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
                      <Text style={styles.backButtonText}>← Back</Text>
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
          <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Ingredients & Allergens</Text>
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
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{saving ? 'Saving…' : 'Add Dish'}</Text>
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
            <Text style={{ color: TEXT_MUTED, fontSize: 14, fontWeight: '600' }}>Ingredients & Allergens</Text>
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
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Save</Text>
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
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Delete</Text>
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
  title: {
    color: TEXT_LIGHT,
    fontSize: Platform.select({ web: 48, default: 36 }),
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
  },
  inputFocused: {
    borderColor: PRIMARY_COLOR,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 2px ${PRIMARY_COLOR}40`,
      } as any,
    }),
  },
  inputReadOnly: {
    backgroundColor: '#F9FAFB',
    color: TEXT_MUTED,
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
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
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
  nextButtonIcon: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.lg,
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
    textDecorationLine: 'underline',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_LIGHT,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
    textDecorationLine: 'underline',
  },
  hint: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
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
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
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
