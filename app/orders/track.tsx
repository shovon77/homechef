'use client';

// TypeScript declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, ScrollView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, Link, router } from 'expo-router';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';
import { cents } from '../../lib/money';
import { updateOrderStatus } from '../../lib/orders';
import { theme } from '../../lib/theme';
import { uploadToBucket } from '../../lib/upload';

const BG = '#f6f8f8';
const CARD_BG = '#FFFFFF';
const BG_LIGHT = '#FFFFFF';
const BORDER = '#E3E7E7';
const BORDER_LIGHT = '#E3E7E7';
const TEXT_DARK = '#33393a';
const TEXT_MUTED = '#638886';
const PRIMARY = '#FE734C';
const ACCENT = '#FE734C';

const ACTIVE_STATUSES = ['requested', 'pending', 'ready', 'paid'] as const;

const STEP_META: Record<string, { label: string; icon: string }> = {
  requested: { label: 'Awaiting chef confirmation', icon: '' },
  pending: { label: 'Chef confirmed the order', icon: '' },
  ready: { label: 'Food ready for pickup', icon: '' },
  completed: { label: 'Order picked up, enjoy!', icon: '' },
  rejected: { label: 'Issue reported - under review', icon: '' },
};

type OrderRow = {
  id: number;
  user_id: string;
  chef_id: number | null;
  status: string;
  total_cents: number;
  pickup_at: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  dish_id: number | null;
  quantity: number;
  unit_price_cents: number;
};

type DishRow = {
  id: number;
  name: string;
  image?: string | null;
  price?: number | null;
};

type ChefRow = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  photo?: string | null;
};

type MessageRow = {
  id: number;
  order_id: number;
  user_id: string;
  chef_id: number;
  message: string;
  created_at: string;
  chef_name?: string | null;
  sender_user_id?: string | null;
  recipient_user_id?: string | null;
  sender_type?: 'customer' | 'chef' | null;
};

export default function TrackOrderPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<(OrderItemRow & { dish?: DishRow | null })[]>([]);
  const [chef, setChef] = useState<ChefRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(false);
  const [isPickupInfoExpanded, setIsPickupInfoExpanded] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [issueImages, setIssueImages] = useState<string[]>([]);
  const [uploadingIssueImages, setUploadingIssueImages] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [isRecordingIssue, setIsRecordingIssue] = useState(false);
  const issueRecognitionRef = useRef<any>(null);
  const [showIssueTypeDropdown, setShowIssueTypeDropdown] = useState(false);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please sign in to track your orders.');
          setOrder(null);
          setItems([]);
          setChef(null);
          setCurrentUserId(null);
          setLoading(false);
          return;
        }

        if (mounted) setCurrentUserId(user.id);

        let selectedOrder: OrderRow | null = null;

        if (params.id) {
          const r = await supabase
            .from('orders')
            .select('*')
            .eq('id', Number(params.id))
            .eq('user_id', user.id)
            .maybeSingle();
          if (!r.error) selectedOrder = r.data as OrderRow | null;
        }

        if (!selectedOrder) {
          const r = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ACTIVE_STATUSES as any)
            .order('created_at', { ascending: false })
            .limit(1);
          if (!r.error && Array.isArray(r.data) && r.data.length > 0) {
            selectedOrder = r.data[0] as OrderRow;
          }
        }

        if (!selectedOrder) {
          setOrder(null);
          setItems([]);
          setChef(null);
          setLoading(false);
          return;
        }

        if (mounted) setOrder(selectedOrder);

        const itemRes = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', selectedOrder.id);
        const itemRows = Array.isArray(itemRes.data) ? (itemRes.data as OrderItemRow[]) : [];

        if (itemRows.length) {
          const dishIds = itemRows.map(it => it.dish_id).filter((id): id is number => typeof id === 'number');
          const dishRes = dishIds.length
            ? await supabase.from('dishes').select('id,name,image,price').in('id', dishIds)
            : { data: [] };
          const dishMap = new Map<number, DishRow>();
          (dishRes.data ?? []).forEach(d => dishMap.set(d.id, d as DishRow));
          if (mounted) setItems(itemRows.map(it => ({ ...it, dish: it.dish_id ? dishMap.get(it.dish_id) ?? null : null })));
        } else if (mounted) {
          setItems([]);
        }

        if (selectedOrder.chef_id) {
          const chefRes = await supabase
            .from('chefs')
            .select('id,name,email,phone,location,photo')
            .eq('id', selectedOrder.chef_id)
            .maybeSingle();
          if (!chefRes.error && mounted) setChef(chefRes.data as ChefRow | null);
        } else if (mounted) {
          setChef(null);
        }

        // Fetch messages for this order - sorted latest to oldest (newest first)
        if (selectedOrder.id && mounted) {
          const messagesRes = await supabase
            .from('order_messages')
            .select('*')
            .eq('order_id', selectedOrder.id)
            .order('created_at', { ascending: false }); // Latest (newest) first, oldest last
          
          console.log('Order tracking - Messages fetched:', {
            orderId: selectedOrder.id,
            messages: messagesRes.data,
            error: messagesRes.error,
            currentUserId: user?.id
          });
          
          if (!messagesRes.error && messagesRes.data && mounted) {
            setMessages(messagesRes.data as MessageRow[]);
          } else if (messagesRes.error && mounted) {
            console.error('Error fetching messages:', messagesRes.error);
          }
        }

        channel = supabase
          .channel(`orders-tracking-${selectedOrder.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${selectedOrder.id}` }, payload => {
            const next = payload.new as OrderRow;
            setOrder(prev => (prev && prev.id === next.id ? next : prev));
          })
          .subscribe();
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Failed to load order');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [params.id]);

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
    [items]
  );
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  
  // Platform service fee: 10% of subtotal
  const platformFeeCents = useMemo(() => Math.round(subtotalCents * 0.10), [subtotalCents]);
  // Taxes: 13% HST on subtotal + platform fee (Ontario rate)
  const taxesCents = useMemo(() => Math.round((subtotalCents + platformFeeCents) * 0.13), [subtotalCents, platformFeeCents]);

  // Send message function
  const handleSendMessage = async () => {
    if (!messageText.trim() || !order || !chef || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to send messages');
        return;
      }

      // When customer sends a message:
      // - sender_user_id = customer's user ID (current logged-in user)
      // - recipient_user_id = chef's user ID (from chefs table)
      // - sender_type = 'customer'
      // First, get chef's user_id
      let chefUserId: string | null = null;
      if (chef.id) {
        const { data: chefData } = await supabase
          .from('chefs')
          .select('user_id')
          .eq('id', chef.id)
          .maybeSingle();
        chefUserId = chefData?.user_id || null;
      }

      const { data, error } = await supabase
        .from('order_messages')
        .insert({
          order_id: order.id,
          user_id: user.id, // Keep for backward compatibility
          chef_id: chef.id, // Keep for backward compatibility
          sender_user_id: user.id, // Customer's user ID (who sent it)
          recipient_user_id: chefUserId, // Chef's user ID (who receives it)
          sender_type: 'customer', // Customer sent this message
          message: messageText.trim(),
          chef_name: chef.name,
        })
        .select()
        .single();

      if (error) throw error;

      // Add message to local state
      setMessages(prev => [...prev, data as MessageRow]);
      setMessageText('');
      setShowMessageModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Voice dictation function (Web Speech API)
  const handleStartVoiceInput = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Voice dictation is currently only available on web');
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      Alert.alert('Not Supported', 'Voice dictation is not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessageText(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecording(false);
      recognition.stop();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      Alert.alert('Error', 'Voice recognition failed. Please try again.');
      recognition.stop();
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Voice dictation for issue details
  const handleStartIssueVoiceInput = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Voice dictation is currently only available on web');
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      Alert.alert('Not Supported', 'Voice dictation is not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingIssue(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAdditionalDetails(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecordingIssue(false);
      recognition.stop();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecordingIssue(false);
      Alert.alert('Error', 'Voice recognition failed. Please try again.');
      recognition.stop();
    };

    recognition.onend = () => {
      setIsRecordingIssue(false);
    };

    issueRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopIssueVoiceInput = () => {
    if (issueRecognitionRef.current) {
      issueRecognitionRef.current.stop();
      setIsRecordingIssue(false);
    }
  };

  // Handle image upload for issue
  const handleIssueImageUpload = async () => {
    if (issueImages.length >= 3) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 3 images');
      return;
    }

    try {
      // For web, use file input
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          if (issueImages.length >= 3) {
            Alert.alert('Limit Reached', 'You can upload a maximum of 3 images');
            return;
          }

          setUploadingIssueImages(true);
          try {
            const { publicUrl } = await uploadToBucket(
              'public-assets',
              file,
              `order-issues/${order?.id || 'temp'}`
            );
            setIssueImages(prev => [...prev, publicUrl]);
          } catch (err: any) {
            Alert.alert('Upload Failed', err?.message || 'Failed to upload image');
          } finally {
            setUploadingIssueImages(false);
          }
        };
        input.click();
      } else {
        // For native, you would use ImagePicker here
        Alert.alert('Info', 'Image upload on mobile coming soon');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload image');
    }
  };

  // Remove image from issue
  const handleRemoveIssueImage = (index: number) => {
    setIssueImages(prev => prev.filter((_, i) => i !== index));
  };

  // Submit issue report
  const handleSubmitIssue = async () => {
    if (!issueType) {
      Alert.alert('Required', 'Please select an issue type');
      return;
    }

    if (!order || !chef) {
      Alert.alert('Error', 'Order or chef information is missing');
      return;
    }

    setSubmittingIssue(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to report an issue');
        return;
      }

      // Insert issue
      const { data: issueData, error: issueError } = await supabase
        .from('order_issues')
        .insert({
          order_id: order.id,
          user_id: user.id,
          chef_id: chef.id,
          issue_type: issueType,
          additional_details: additionalDetails.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (issueError) throw issueError;

      // Upload images if any
      if (issueImages.length > 0 && issueData) {
        const imageInserts = issueImages.map(imageUrl => ({
          issue_id: issueData.id,
          image_url: imageUrl,
        }));

        const { error: imagesError } = await supabase
          .from('order_issue_images')
          .insert(imageInserts);

        if (imagesError) {
          console.error('Error inserting images:', imagesError);
          // Don't fail the whole submission if images fail
        }
      }

      Alert.alert('Success', 'Issue reported successfully. We\'ll review it within 24 hours.');
      setShowReportIssueModal(false);
      setIssueType('');
      setAdditionalDetails('');
      setIssueImages([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit issue report');
    } finally {
      setSubmittingIssue(false);
    }
  };

  if (loading) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center' }} style={{ backgroundColor: BG }}>
        <ActivityIndicator color={PRIMARY} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }} style={{ backgroundColor: BG }}>
        <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '800', marginBottom: 8, fontFamily: theme.typography.fontFamily.display }}>Unable to load order</Text>
        <Text style={{ color: TEXT_MUTED, textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>{error}</Text>
        <Link href="/browse" asChild>
          <TouchableOpacity style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Browse dishes</Text>
          </TouchableOpacity>
        </Link>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', padding: 24 }} style={{ backgroundColor: BG }}>
        <Text style={{ color: TEXT_DARK, fontSize: 20, fontWeight: '800', marginBottom: 8, fontFamily: theme.typography.fontFamily.display }}>No active orders</Text>
        <Text style={{ color: TEXT_MUTED, marginBottom: 16, textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>Once you place an order you can track it here.</Text>
        <Link href="/browse" asChild>
          <TouchableOpacity style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Browse dishes</Text>
          </TouchableOpacity>
        </Link>
      </Screen>
    );
  }

  const calculatedTotalCents = subtotalCents + platformFeeCents + taxesCents;
  const totalCents = Number.isFinite(order.total_cents) ? order.total_cents : calculatedTotalCents;
  const visualStatus = order.status === 'completed' ? 'completed' : order.status;
  const stepMeta = STEP_META[visualStatus] ?? { label: 'Issue reported - under review', icon: '' };

  let statusMessage = '';
  switch (visualStatus) {
    case 'requested':
      statusMessage = 'Your order is waiting for chef confirmation';
      break;
    case 'pending':
      statusMessage = 'Chef has confirmed your order and is preparing it';
      break;
    case 'ready':
      statusMessage = 'Your food is ready! Please pick it up at the scheduled time';
      break;
    case 'completed':
      statusMessage = 'Thank you for your order! We hope you enjoy your meal';
      break;
    case 'rejected':
      statusMessage = 'There was an issue with your order. Our team is reviewing it';
      break;
    default:
      statusMessage = 'Your order status is being updated';
  }

  // Format location address to display street, city, country
  const formatLocationAddress = (location: string | null | undefined): { street: string; city: string; country: string } => {
    if (!location) {
      return { street: 'Not available', city: '', country: '' };
    }
    
    try {
      // Split by comma to parse address components
      const parts = location.split(',').map(p => p.trim());
      
      // Street address is typically the first part
      const street = parts[0] || 'Not available';
      
      // City is typically the second part (or first if only one part)
      let city = parts.length > 1 ? parts[1] : '';
      
      // If there's a third part, it might contain province/state and postal code
      // Extract city from the remaining parts (remove postal codes and province codes)
      if (parts.length > 2) {
        // City might be in the second part, third part could be province/postal
        // Try to extract just the city name (remove postal codes)
        const cityPart = parts[1];
        // Remove postal code patterns (e.g., "ON M4C 1M6" or "M4C 1M6")
        city = cityPart.replace(/\s*[A-Z]\d[A-Z]\s?\d[A-Z]\d\s*/i, '').replace(/\s*[A-Z]{2}\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d\s*/i, '').trim();
        if (!city) city = cityPart; // Fallback to original if parsing failed
      }
      
      // Determine country - default to Canada for Canadian addresses, or try to extract
      let country = 'Canada';
      // If we see US state codes or patterns, it might be USA
      if (location.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/)) {
        country = 'United States';
      } else if (location.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)) {
        country = 'Canada';
      }
      
      return { street, city, country };
    } catch {
      return { street: location, city: '', country: 'Canada' };
    }
  };

  // Format pickup date/time in the format "Jan 1, 2025 • 08:30PM-09:30PM"
  const formatPickupDateTime = (pickupAt: string | null): string => {
    if (!pickupAt) return 'Not available';
    try {
      const date = new Date(pickupAt);
      if (Number.isNaN(date.getTime())) return 'Not available';
      
      // Format date as "Jan 1, 2025"
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      // Format time as "08:30PM"
      const hour = date.getHours();
      const minute = date.getMinutes();
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const minuteStr = minute.toString().padStart(2, '0');
      const timeStr = `${hour12}:${minuteStr}${ampm}`;
      
      // Calculate end time (1 hour later)
      const endDate = new Date(date);
      endDate.setHours(endDate.getHours() + 1);
      const endHour = endDate.getHours();
      const endHour12 = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
      const endAmpm = endHour >= 12 ? 'PM' : 'AM';
      const endMinuteStr = endDate.getMinutes().toString().padStart(2, '0');
      const endTimeStr = `${endHour12}:${endMinuteStr}${endAmpm}`;
      
      return `${dateStr} • ${timeStr}-${endTimeStr}`;
    } catch {
      return 'Not available';
    }
  };

  const showReadyAction = order.status === 'ready' || order.status === 'completed';
  const showRejectedBanner = order.status === 'rejected';
  const showCompletedBadge = order.status === 'completed';

  const chefName = chef?.name ?? 'Chef';

  return (
    <Screen scroll style={{ backgroundColor: BG }} contentPadding={0}>
      <View style={styles.wrapper}>
        {showRejectedBanner ? (
          <View style={styles.rejectedBanner}>
            <Text style={styles.rejectedText}>Issue reported - under review</Text>
          </View>
        ) : null}

        {showCompletedBadge ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.statusValue}>{stepMeta.label}</Text>
          <View style={styles.statusDetails}>
            <View style={styles.infoRow}>
              <Text style={styles.statusInfoLabel}>Pickup scheduled</Text>
              <Text style={styles.statusInfoValue}>{formatPickupDateTime(order.pickup_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.statusInfoLabel}>Pick up location</Text>
              <View style={styles.locationValueContainer}>
                {(() => {
                  const { street, city, country } = formatLocationAddress(chef?.location);
                  return (
                    <>
                      <Text style={styles.locationAddressLine}>{street}</Text>
                      {city && <Text style={styles.locationAddressLine}>{city}</Text>}
                      {country && <Text style={styles.locationAddressLine}>{country}</Text>}
                    </>
                  );
                })()}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.orderSummaryHeader}
            onPress={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
          >
            <View style={styles.orderSummaryTitleRow}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <Text style={styles.orderNumber}>#{String(order.id).padStart(5, '0')}</Text>
            </View>
            <Text style={styles.expandIcon}>{isOrderSummaryExpanded ? '−' : '+'}</Text>
          </TouchableOpacity>
          
          {isOrderSummaryExpanded && (
            <View style={styles.orderSummaryContent}>
              {items.map(item => (
                <View key={item.id} style={styles.orderItemRow}>
                  <View style={styles.orderItemInfo}>
                    <Text style={styles.orderItemName}>
                      {item.dish?.name ?? `Dish #${item.dish_id}`} ({chef?.name ?? 'Chef'})
                    </Text>
                  </View>
                  <View style={styles.orderItemQuantityPrice}>
                    <Text style={styles.orderItemQuantity}>{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>{cents(item.unit_price_cents * item.quantity)}</Text>
                  </View>
                </View>
              ))}
              
              <View style={styles.summaryDivider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{cents(subtotalCents)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryLabelWithIcon}>
                  <Text style={styles.summaryLabel}>Platform service fee </Text>
                  <Text style={styles.infoIcon}>ⓘ</Text>
                </View>
                <Text style={styles.summaryValue}>{cents(platformFeeCents)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Taxes</Text>
                <Text style={styles.summaryValue}>{cents(taxesCents)}</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 8 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: '800', color: TEXT_DARK, fontFamily: theme.typography.fontFamily.body }]}>Total</Text>
                <Text style={[styles.summaryValue, { fontWeight: '800', color: TEXT_DARK, fontFamily: theme.typography.fontFamily.body }]}>{cents(calculatedTotalCents)}</Text>
              </View>
              
              <Text style={styles.platformFeeInfo}>
                ⓘ It helps support the platform and secure payments.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.orderSummaryHeader}
            onPress={() => setIsPickupInfoExpanded(!isPickupInfoExpanded)}
          >
            <Text style={styles.sectionTitle}>Pickup info</Text>
            <Text style={styles.expandIcon}>{isPickupInfoExpanded ? '−' : '+'}</Text>
          </TouchableOpacity>
          
          {isPickupInfoExpanded && (
            <View style={styles.pickupInfoContent}>
              <Text style={styles.pickupDateTime}>
                {order.pickup_at ? (() => {
                  try {
                    const date = new Date(order.pickup_at);
                    if (Number.isNaN(date.getTime())) return 'Not available';
                    
                    // Format date as "January 1, 2025"
                    const dateStr = date.toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    
                    // Format start time as "08:30" (24-hour format)
                    const hour = date.getHours();
                    const minute = date.getMinutes();
                    const hourStr = hour.toString().padStart(2, '0');
                    const minuteStr = minute.toString().padStart(2, '0');
                    const startTimeStr = `${hourStr}:${minuteStr}`;
                    
                    // Calculate end time (1 hour later) and format as "9:30PM"
                    const endDate = new Date(date);
                    endDate.setHours(endDate.getHours() + 1);
                    const endHour = endDate.getHours();
                    const endHour12 = endHour === 0 ? 12 : endHour > 12 ? endHour - 12 : endHour;
                    const endAmpm = endHour >= 12 ? 'PM' : 'AM';
                    const endMinuteStr = endDate.getMinutes().toString().padStart(2, '0');
                    const endTimeStr = `${endHour12}:${endMinuteStr}${endAmpm}`;
                    
                    return `${dateStr} - ${startTimeStr} - ${endTimeStr}`;
                  } catch {
                    return 'Not available';
                  }
                })() : 'Not available'}
              </Text>
              
              {chef?.location && (
                <TouchableOpacity 
                  style={styles.pickupLocationRow}
                  onPress={() => {
                    const encodedAddress = encodeURIComponent(chef.location || '');
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                    Linking.openURL(mapsUrl);
                  }}
                >
                  <Image 
                    source={require('../../assets/placeholder.png')} 
                    style={styles.locationIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.pickupLocation}>{chef.location}</Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.pickupReminder}>
                We'll remind you before pickup time. The food's prepared by an independent home chef.
              </Text>
            </View>
          )}
        </View>

        {showReadyAction ? (
          <TouchableOpacity
            style={styles.readyAction}
            onPress={async () => {
              const { error } = await updateOrderStatus(order.id, 'completed');
              if (error) {
                console.error('complete order error', error);
                return;
              }
              router.replace(`/orders/thank-you?id=${order.id}`);
            }}
          >
            <Text style={styles.readyActionText}>I picked up my order</Text>
          </TouchableOpacity>
        ) : null}

        {messages.length > 0 && (
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.orderSummaryHeader}
              onPress={() => setIsMessagesExpanded(!isMessagesExpanded)}
            >
              <Text style={styles.sectionTitle}>Messages</Text>
              <Text style={styles.expandIcon}>{isMessagesExpanded ? '−' : '+'}</Text>
            </TouchableOpacity>
            
            {isMessagesExpanded && (
              <ScrollView 
                style={styles.messagesScrollView}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={true}
              >
                {messages.map(message => {
                  // Determine if message is from current user (customer) or chef
                  // Use sender_type if available (new schema), otherwise fall back to user_id comparison
                  const isUserMessage = message.sender_type === 'customer' || 
                    (message.sender_type === null && message.user_id === currentUserId);
                  const isChefMessage = message.sender_type === 'chef' || 
                    (message.sender_type === null && message.user_id !== currentUserId);
                  
                  // Determine sender name
                  const senderName = isUserMessage 
                    ? 'You' 
                    : (message.chef_name || chef?.name || 'Chef');
                  
                  return (
                    <View 
                      key={message.id} 
                      style={[
                        styles.messageBubbleContainer,
                        isUserMessage ? styles.messageBubbleRight : styles.messageBubbleLeft
                      ]}
                    >
                      <View style={[
                        styles.messageBubble,
                        isUserMessage ? styles.messageBubbleUser : styles.messageBubbleChef
                      ]}>
                        <Text style={styles.messageSenderName}>{senderName}</Text>
                        <Text style={styles.messageBody}>{message.message}</Text>
                        <Text style={styles.messageTime}>{formatLocal(message.created_at, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.actionButtonsContainer}>
          <View style={styles.messageChefContainer}>
            <TouchableOpacity
              onPress={() => setShowMessageModal(true)}
              style={styles.messageChefButton}
            >
              <Text style={styles.messageChefButtonText}>Have questions? Message chef.</Text>
            </TouchableOpacity>
            <Text style={styles.messageChefSubtext}>Messages are shared securely through the platform.</Text>
          </View>
          
          <View style={styles.browseContainer}>
            <Link href="/browse?tab=chefs" asChild>
              <TouchableOpacity style={styles.messageChefButton}>
                <Text style={styles.messageChefButtonText}>Browse chefs, as you wait!</Text>
              </TouchableOpacity>
            </Link>
            <TouchableOpacity 
              style={styles.messageChefButton}
              onPress={() => setShowReportIssueModal(true)}
            >
              <Text style={styles.messageChefButtonText}>Report an issue?</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerNote}>
          The food is prepared by an independent home chef. Please handle it safely after pickup.
        </Text>
      </View>

      {/* Report Issue Modal */}
      <Modal
        visible={showReportIssueModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowReportIssueModal(false);
          setIssueType('');
          setAdditionalDetails('');
          setIssueImages([]);
          handleStopIssueVoiceInput();
        }}
      >
        <View style={styles.reportIssueModalOverlay}>
          <View style={styles.reportIssueModalContent}>
            <View style={styles.reportIssueModalHeader}>
              <View>
                <Text style={styles.reportIssueModalTitle}>Report an issue</Text>
                <Text style={styles.reportIssueModalSubtitle}>We'll review it in 24 hours</Text>
                <Text style={styles.reportIssueOrderNumber}>Order #{order?.id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowReportIssueModal(false);
                  setIssueType('');
                  setAdditionalDetails('');
                  setIssueImages([]);
                  handleStopIssueVoiceInput();
                }}
                style={styles.reportIssueModalCloseButton}
              >
                <Text style={styles.reportIssueModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.reportIssueModalBody}
              contentContainerStyle={styles.reportIssueModalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Issue Type Dropdown */}
              <View style={styles.reportIssueField}>
                <Text style={styles.reportIssueLabel}>What's the issue?</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.reportIssueSelectContainer}>
                    {React.createElement('select', {
                      value: issueType,
                      onChange: (e: any) => setIssueType(e.target.value),
                      style: {
                        width: '100%',
                        padding: 12,
                        borderWidth: 1,
                        borderColor: BORDER_LIGHT,
                        borderRadius: 8,
                        backgroundColor: BG_LIGHT,
                        color: TEXT_DARK,
                        fontSize: 14,
                        fontFamily: theme.typography.fontFamily.body,
                        cursor: 'pointer',
                      } as any,
                    }, [
                      React.createElement('option', { key: '', value: '' }, 'Select a reason'),
                      React.createElement('option', { key: 'chef_unresponsive', value: 'chef_unresponsive' }, 'Chef is unresponsive'),
                      React.createElement('option', { key: 'pickup_location_unclear', value: 'pickup_location_unclear' }, 'Pickup location unclear'),
                      React.createElement('option', { key: 'chef_running_late', value: 'chef_running_late' }, 'Chef\'s running late'),
                      React.createElement('option', { key: 'food_unavailable', value: 'food_unavailable' }, 'Food unavailable'),
                      React.createElement('option', { key: 'other', value: 'other' }, 'Other'),
                    ])}
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.reportIssueSelectButton}
                      onPress={() => setShowIssueTypeDropdown(!showIssueTypeDropdown)}
                    >
                      <Text style={[styles.reportIssueSelectButtonText, !issueType && styles.reportIssueSelectButtonPlaceholder]}>
                        {issueType 
                          ? [
                              { value: 'chef_unresponsive', label: 'Chef is unresponsive' },
                              { value: 'pickup_location_unclear', label: 'Pickup location unclear' },
                              { value: 'chef_running_late', label: 'Chef\'s running late' },
                              { value: 'food_unavailable', label: 'Food unavailable' },
                              { value: 'other', label: 'Other' },
                            ].find(opt => opt.value === issueType)?.label || 'Select a reason'
                          : 'Select a reason'
                        }
                      </Text>
                      <Text style={styles.reportIssueSelectArrow}>{showIssueTypeDropdown ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showIssueTypeDropdown && (
                      <View style={styles.reportIssueDropdown}>
                        {[
                          { value: 'chef_unresponsive', label: 'Chef is unresponsive' },
                          { value: 'pickup_location_unclear', label: 'Pickup location unclear' },
                          { value: 'chef_running_late', label: 'Chef\'s running late' },
                          { value: 'food_unavailable', label: 'Food unavailable' },
                          { value: 'other', label: 'Other' },
                        ].map(option => (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => {
                              setIssueType(option.value);
                              setShowIssueTypeDropdown(false);
                            }}
                            style={[
                              styles.reportIssueOption,
                              issueType === option.value && styles.reportIssueOptionSelected
                            ]}
                          >
                            <Text style={[
                              styles.reportIssueOptionText,
                              issueType === option.value && styles.reportIssueOptionTextSelected
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Additional Details */}
              {issueType === 'other' && (
                <View style={styles.reportIssueField}>
                  <Text style={styles.reportIssueLabel}>If other, please share additional details</Text>
                  <View style={styles.reportIssueTextInputWrapper}>
                    <TextInput
                      style={styles.reportIssueTextInput}
                      placeholder="Describe the issue..."
                      placeholderTextColor={TEXT_MUTED}
                      value={additionalDetails}
                      onChangeText={setAdditionalDetails}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={styles.reportIssueMicIconContainer}
                      onPress={isRecordingIssue ? handleStopIssueVoiceInput : handleStartIssueVoiceInput}
                    >
                      <Image 
                        source={require('../../assets/microphone.png')} 
                        style={[styles.reportIssueMicIconImage, isRecordingIssue && styles.reportIssueMicIconImageActive]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Image Upload */}
              <View style={styles.reportIssueField}>
                <Text style={styles.reportIssueLabel}>If relevant, please share images</Text>
                <TouchableOpacity
                  style={styles.reportIssueUploadButton}
                  onPress={handleIssueImageUpload}
                  disabled={uploadingIssueImages || issueImages.length >= 3}
                >
                  {uploadingIssueImages ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Text style={styles.reportIssueUploadButtonText}>
                      Upload {issueImages.length > 0 ? `(${issueImages.length}/3)` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
                
                {/* Display uploaded images */}
                {issueImages.length > 0 && (
                  <View style={styles.reportIssueImagesContainer}>
                    {issueImages.map((imageUrl, index) => (
                      <View key={index} style={styles.reportIssueImageWrapper}>
                        <Image source={{ uri: imageUrl }} style={styles.reportIssueImage} />
                        <TouchableOpacity
                          style={styles.reportIssueRemoveImage}
                          onPress={() => handleRemoveIssueImage(index)}
                        >
                          <Text style={styles.reportIssueRemoveImageText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.reportIssueSubmitButton, (!issueType || submittingIssue) && styles.reportIssueSubmitButtonDisabled]}
                onPress={handleSubmitIssue}
                disabled={!issueType || submittingIssue}
              >
                {submittingIssue ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.reportIssueSubmitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Message Chef Modal */}
      <Modal
        visible={showMessageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowMessageModal(false);
          setMessageText('');
          handleStopVoiceInput();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <View style={styles.chefHeaderRow}>
                  {chef?.photo ? (
                    <Image source={{ uri: chef.photo }} style={styles.chefLogoModal} />
                  ) : (
                    <View style={[styles.chefLogoModal, styles.chefLogoPlaceholder]}>
                      <Text style={styles.chefLogoText}>{chef?.name?.charAt(0) || 'C'}</Text>
                    </View>
                  )}
                  <Text style={styles.modalTitle}>{chef?.name || 'Chef'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowMessageModal(false);
                  setMessageText('');
                  handleStopVoiceInput();
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type your message..."
                  placeholderTextColor={TEXT_MUTED}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <View style={styles.messageInputActions}>
                  <TouchableOpacity
                    style={[styles.micButton, isRecording && styles.micButtonActive]}
                    onPress={isRecording ? handleStopVoiceInput : handleStartVoiceInput}
                  >
                    <Image 
                      source={require('../../assets/microphone.png')} 
                      style={styles.micIconImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendButton, (!messageText.trim() || sendingMessage) && styles.sendButtonDisabled]}
                    onPress={handleSendMessage}
                    disabled={!messageText.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sendButtonIcon}>➤</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 20,
  },
  heroTitle: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
    fontFamily: theme.typography.fontFamily.display,
  },
  statusMessage: {
    color: TEXT_MUTED,
    fontFamily: theme.typography.fontFamily.body,
  },
  rejectedBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
  },
  rejectedText: {
    color: '#B91C1C',
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedText: {
    color: '#15803D',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    gap: 8,
  },
  cardLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
  },
  cardMeta: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
  },
  infoValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.body,
  },
  contactButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
  },
  contactButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
  },
  statusValue: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 8,
    marginBottom: 16,
  },
  statusDetails: {
    marginTop: 8,
    gap: 12,
  },
  statusInfoLabel: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
  },
  statusInfoValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    flex: 2,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.body,
  },
  locationValueContainer: {
    flex: 2,
    alignItems: 'flex-end',
    gap: 2,
  },
  locationAddressLine: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.body,
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    minHeight: 24,
  },
  orderSummaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  expandIcon: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  orderSummaryContent: {
    marginTop: 8,
    gap: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  orderItemQuantityPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  orderItemQuantity: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 20,
    textAlign: 'right',
  },
  orderItemPrice: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 80,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  summaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoIcon: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  platformFeeInfo: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 8,
    fontStyle: 'italic',
  },
  pickupInfoContent: {
    marginTop: 8,
    gap: 12,
  },
  pickupDateTime: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '600',
  },
  pickupLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationIcon: {
    width: 14,
    height: 14,
    tintColor: PRIMARY,
    marginTop: 2,
  },
  pickupLocation: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textDecorationLine: 'underline',
  },
  pickupReminder: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 18,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  itemPrice: {
    color: TEXT_DARK,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryLabel: {
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
  },
  summaryValue: {
    color: TEXT_DARK,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  readyAction: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readyActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtonsContainer: {
    gap: 12,
    marginTop: 8,
  },
  messageChefContainer: {
    gap: 8,
  },
  messageChefButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageChefButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
  },
  messageChefSubtext: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
  },
  browseContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
  },
  footerNote: {
    color: TEXT_DARK,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.body,
  },
  messagesScrollView: {
    maxHeight: 400,
  },
  messagesContent: {
    marginTop: 8,
    gap: 8,
    paddingBottom: 8,
  },
  messageBubbleContainer: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 4,
  },
  messageBubbleLeft: {
    justifyContent: 'flex-start',
  },
  messageBubbleRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    gap: 6,
  },
  messageBubbleChef: {
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(254, 115, 76, 0.1)',
    borderTopRightRadius: 4,
  },
  messageSenderName: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 4,
  },
  messageBody: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  messageTime: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Keep old styles for backward compatibility (not used anymore)
  messageItem: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 8,
  },
  messageItemUser: {
    backgroundColor: 'rgba(254, 115, 76, 0.1)',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageChefName: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  messageDate: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  chefHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chefLogoModal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E9E8',
  },
  chefLogoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefLogoText: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_DARK,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: TEXT_DARK,
    fontWeight: '300',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 20,
  },
  messageInputContainer: {
    gap: 12,
  },
  messageInput: {
    minHeight: 120,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textAlignVertical: 'top',
  },
  messageInputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: PRIMARY,
  },
  micIconImage: {
    width: 24,
    height: 24,
    tintColor: PRIMARY,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  ctaPrimary: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.body,
  },
  // Report Issue Modal Styles
  reportIssueModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportIssueModalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: BG_LIGHT,
    borderRadius: 16,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  reportIssueModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  reportIssueModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
    color: TEXT_DARK,
  },
  reportIssueModalSubtitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  reportIssueOrderNumber: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_DARK,
    fontWeight: '700',
    marginTop: 8,
  },
  reportIssueModalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportIssueModalCloseText: {
    fontSize: 24,
    color: TEXT_DARK,
    fontWeight: '300',
  },
  reportIssueModalBody: {
    flex: 1,
  },
  reportIssueModalBodyContent: {
    padding: 20,
    paddingBottom: 20,
    gap: 20,
  },
  reportIssueField: {
    gap: 8,
  },
  reportIssueLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_DARK,
  },
  reportIssuePlaceholder: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reportIssueSelectContainer: {
    width: '100%',
  },
  reportIssueSelectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    backgroundColor: BG_LIGHT,
    minHeight: 44,
  },
  reportIssueSelectButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_DARK,
    flex: 1,
  },
  reportIssueSelectButtonPlaceholder: {
    color: TEXT_MUTED,
  },
  reportIssueSelectArrow: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginLeft: 8,
  },
  reportIssueDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    backgroundColor: BG_LIGHT,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 3,
      },
    }),
  },
  reportIssueOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    backgroundColor: BG_LIGHT,
  },
  reportIssueOptionSelected: {
    backgroundColor: 'rgba(254, 115, 76, 0.1)',
  },
  reportIssueOptionText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    color: TEXT_DARK,
  },
  reportIssueOptionTextSelected: {
    color: PRIMARY,
    fontWeight: '700',
  },
  reportIssueTextInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    backgroundColor: BG_LIGHT,
    paddingLeft: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  reportIssueTextInput: {
    flex: 1,
    minHeight: 100,
    maxHeight: 200,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textAlignVertical: 'top',
    paddingRight: 8,
  },
  reportIssueMicIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 12,
    paddingLeft: 8,
    paddingTop: 4,
  },
  reportIssueMicIconImage: {
    width: 24,
    height: 24,
    tintColor: PRIMARY,
  },
  reportIssueMicIconImageActive: {
    tintColor: '#FFFFFF',
    backgroundColor: PRIMARY,
    borderRadius: 12,
  },
  reportIssueUploadButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  reportIssueUploadButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  reportIssueImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  reportIssueImageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  reportIssueImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  reportIssueRemoveImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIssueRemoveImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reportIssueSubmitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
  },
  reportIssueSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportIssueSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.body,
  },
});
