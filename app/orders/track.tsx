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
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { formatLocal } from '../../lib/datetime';
import { cents } from '../../lib/money';
import { updateOrderStatus } from '../../lib/orders';
import { theme } from '../../lib/theme';
import { uploadToBucket } from '../../lib/upload';
import { createNotification } from '../../lib/notifications';
import { formatLocationAddress, formatLocationDisplay } from '../../lib/formatAddress';
import { addPickupToUserCalendar, getPickupWindow } from '../../lib/addPickupCalendarEvent';
import { isDeliveryOrder } from '../../lib/chef-fulfillment';
import { formatPhone } from '../../lib/formatPhone';
import * as Clipboard from 'expo-clipboard';

/** Build a tel: URL from a stored phone string (digits and optional leading +). */
function phoneToTelUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (!cleaned || !cleaned.replace(/\+/g, '')) return null;
  const normalized = cleaned.startsWith('+')
    ? `+${cleaned.slice(1).replace(/\+/g, '')}`
    : cleaned.replace(/\+/g, '');
  return `tel:${normalized}`;
}

/** Match NavBar (`BG_LIGHT`) and Footer background */
const BG = '#F2F0EF';
const CARD_BG = '#FFFFFF';
const BG_LIGHT = '#FFFFFF';
const BORDER = '#E3E7E7';
const BORDER_LIGHT = '#E3E7E7';
const TEXT_DARK = '#33393a';
const TEXT_MUTED = '#638886';
const PRIMARY = '#FE734C';
const ACCENT = '#FE734C';
/** Deeper orange for map pin asset so tint reads vivid, not washed out */
const LOCATION_PIN_TINT = '#D13A0F';

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
  payment_status?: string | null;
  total_cents: number;
  pickup_at: string | null;
  fulfillment_method?: string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  delivery_at?: string | null;
  created_at: string;
};

/** Format scheduled date/time as "Jan 1, 2025 • 08:30PM-09:30PM" */
function formatScheduledDateTime(scheduledAt: string | null): string {
  if (!scheduledAt) return 'Not available';
  try {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return 'Not available';

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const hour = date.getHours();
    const minute = date.getMinutes();
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const minuteStr = minute.toString().padStart(2, '0');
    const timeStr = `${hour12}:${minuteStr}${ampm}`;

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
}

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
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]); // All active orders
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0); // Current order index
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<(OrderItemRow & { dish?: DishRow | null })[]>([]);
  const [chef, setChef] = useState<ChefRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStatusExpanded, setIsStatusExpanded] = useState(true);
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(false);
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
  const [switchingOrder, setSwitchingOrder] = useState(false);
  const [reportedIssue, setReportedIssue] = useState<any | null>(null);
  const [reportedIssueImages, setReportedIssueImages] = useState<any[]>([]);
  const [isReportedIssueExpanded, setIsReportedIssueExpanded] = useState(true);
  const [pickupAddressCopied, setPickupAddressCopied] = useState(false);
  const [phoneNumberCopied, setPhoneNumberCopied] = useState(false);
  const pickupCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPickupAddressCopied(false);
    setPhoneNumberCopied(false);
    if (pickupCopyResetRef.current) {
      clearTimeout(pickupCopyResetRef.current);
      pickupCopyResetRef.current = null;
    }
    if (phoneCopyResetRef.current) {
      clearTimeout(phoneCopyResetRef.current);
      phoneCopyResetRef.current = null;
    }
  }, [order?.id]);

  useEffect(() => {
    return () => {
      if (pickupCopyResetRef.current) clearTimeout(pickupCopyResetRef.current);
      if (phoneCopyResetRef.current) clearTimeout(phoneCopyResetRef.current);
    };
  }, []);

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
            .neq('payment_status', 'awaiting_payment')
            .maybeSingle();
          if (!r.error) selectedOrder = r.data as OrderRow | null;
        }

        if (!selectedOrder) {
          const r = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ACTIVE_STATUSES as any)
            .not('payment_status', 'in', '(awaiting_payment,failed,canceled)')
            .order('created_at', { ascending: false })
            .limit(1);
          if (!r.error && Array.isArray(r.data) && r.data.length > 0) {
            selectedOrder = r.data[0] as OrderRow;
          }
        }

        // Fetch ALL active orders for navigation (exclude unpaid / failed / canceled payments)
        const allOrdersRes = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ACTIVE_STATUSES as any)
          .not('payment_status', 'in', '(awaiting_payment,failed,canceled)')
          .order('created_at', { ascending: false });

        const activeOrders = (allOrdersRes.data || []) as OrderRow[];
        if (mounted) setAllOrders(activeOrders);

        if (!selectedOrder && activeOrders.length > 0) {
          selectedOrder = activeOrders[0]; // Default to latest order
        }

        if (!selectedOrder) {
          setOrder(null);
          setItems([]);
          setChef(null);
          setLoading(false);
          return;
        }

        // Set current order index for navigation
        const orderIndex = activeOrders.findIndex(o => o.id === selectedOrder!.id);
        if (mounted) setCurrentOrderIndex(orderIndex >= 0 ? orderIndex : 0);

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

        // Fetch messages for this order - oldest first (displayed top to bottom)
        if (selectedOrder.id && mounted) {
          const messagesRes = await supabase
            .from('order_messages')
            .select('*')
            .eq('order_id', selectedOrder.id)
            .order('created_at', { ascending: true });
          
          console.log('Order tracking - Messages fetched:', {
            orderId: selectedOrder.id,
            messages: messagesRes.data,
            error: messagesRes.error,
            currentUserId: user?.id
          });
          
          if (!messagesRes.error && messagesRes.data && mounted) {
            setMessages((messagesRes.data || []) as MessageRow[]);
          } else if (messagesRes.error && mounted) {
            console.error('Error fetching messages:', messagesRes.error);
          }

          // Fetch reported issue for this order
          const issueRes = await supabase
            .from('order_issues')
            .select('*')
            .eq('order_id', selectedOrder.id)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (!issueRes.error && issueRes.data && mounted) {
            setReportedIssue(issueRes.data);
            
            // Fetch images for the issue
            const imagesRes = await supabase
              .from('order_issue_images')
              .select('*')
              .eq('issue_id', issueRes.data.id);
            
            if (!imagesRes.error && imagesRes.data && mounted) {
              setReportedIssueImages(imagesRes.data);
            }
          } else if (mounted) {
            setReportedIssue(null);
            setReportedIssueImages([]);
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
  
  // Platform service fee from order (0 for new orders; may be 150 on older orders)
  const platformFeeCents = typeof order?.platform_fee_cents === 'number' ? order.platform_fee_cents : 0;
  // Note: Platform commission (10% of subtotal) is deducted from chef's payout, not shown to customer

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

      // Create notification for the chef about the new message
      if (chefUserId) {
        try {
          // Get customer's name from profiles table
          const { data: customerProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();
          
          const customerName = customerProfile?.name || 'Customer';
          const orderNumber = order.id;
          
          // Create notification for chef
          await createNotification(
            chefUserId,
            'order_message',
            'New Message in Order',
            `${customerName} sent a new message for Order #${orderNumber}.`,
            order.id,
            'order'
          );
        } catch (notifError) {
          // Don't block the message sending if notification creation fails
          console.error('Error creating notification for chef:', notifError);
        }
      }
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

  // Load order details helper function
  const loadOrderDetails = async (selectedOrder: OrderRow) => {
    // Load items
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
      setItems(itemRows.map(it => ({ ...it, dish: it.dish_id ? dishMap.get(it.dish_id) ?? null : null })));
    } else {
      setItems([]);
    }

    // Load chef
    if (selectedOrder.chef_id) {
      const chefRes = await supabase
        .from('chefs')
        .select('id,name,email,phone,location,photo')
        .eq('id', selectedOrder.chef_id)
        .maybeSingle();
      if (!chefRes.error) setChef(chefRes.data as ChefRow | null);
    } else {
      setChef(null);
    }

    // Load messages
    const messagesRes = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', selectedOrder.id)
      .order('created_at', { ascending: true });
    
    if (!messagesRes.error && messagesRes.data) {
      setMessages((messagesRes.data || []) as MessageRow[]);
    }

    // Load reported issue
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const issueRes = await supabase
        .from('order_issues')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!issueRes.error && issueRes.data) {
        setReportedIssue(issueRes.data);
        
        // Fetch images for the issue
        const imagesRes = await supabase
          .from('order_issue_images')
          .select('*')
          .eq('issue_id', issueRes.data.id);
        
        if (!imagesRes.error && imagesRes.data) {
          setReportedIssueImages(imagesRes.data);
        } else {
          setReportedIssueImages([]);
        }
      } else {
        setReportedIssue(null);
        setReportedIssueImages([]);
      }
    }
  };

  // Navigate to previous order (older) - smooth transition without page reload
  const handlePreviousOrder = async () => {
    if (currentOrderIndex < allOrders.length - 1 && !switchingOrder) {
      setSwitchingOrder(true);
      const newIndex = currentOrderIndex + 1;
      const newOrder = allOrders[newIndex];
      
      setCurrentOrderIndex(newIndex);
      setOrder(newOrder);
      
      // Load details for the new order
      await loadOrderDetails(newOrder);
      
      setSwitchingOrder(false);
    }
  };

  // Navigate to next order (newer) - smooth transition without page reload
  const handleNextOrder = async () => {
    if (currentOrderIndex > 0 && !switchingOrder) {
      setSwitchingOrder(true);
      const newIndex = currentOrderIndex - 1;
      const newOrder = allOrders[newIndex];
      
      setCurrentOrderIndex(newIndex);
      setOrder(newOrder);
      
      // Load details for the new order
      await loadOrderDetails(newOrder);
      
      setSwitchingOrder(false);
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
      
      // Set the reported issue to display it
      setReportedIssue(issueData);
      if (issueImages.length > 0) {
        setReportedIssueImages(issueImages.map((url, idx) => ({ id: idx, image_url: url })));
      }
      
      setShowReportIssueModal(false);
      setIssueType('');
      setAdditionalDetails('');
      setIssueImages([]);

      // Create notifications for all admin users about the new issue
      try {
        // Get customer's name from profiles table
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        
        const customerName = customerProfile?.name || 'Customer';
        const chefName = chef.name || 'Chef';
        const orderNumber = order.id;
        
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
              'issue_reported',
              'Issue Reported',
              `${customerName} reported an issue for Order #${orderNumber} with ${chefName}.`,
              issueData.id,
              'issue'
            )
          );
          
          // Don't wait for all notifications to complete - fire and forget
          Promise.all(notificationPromises).catch(err => {
            console.error('Error creating notifications for admins:', err);
          });
        }
      } catch (notifError) {
        // Don't block the issue submission if notification creation fails
        console.error('Error creating notifications for admins:', notifError);
      }
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

  const calculatedTotalCents = subtotalCents + platformFeeCents;
  const totalCents = Number.isFinite(order.total_cents) ? order.total_cents : calculatedTotalCents;
  const visualStatus = order.status === 'completed' ? 'completed' : order.status;
  const isDelivery = isDeliveryOrder(order);
  let stepMeta = STEP_META[visualStatus] ?? { label: 'Issue reported - under review', icon: '' };
  if (visualStatus === 'ready') {
    stepMeta = {
      ...stepMeta,
      label: isDelivery ? 'Food ready for delivery' : stepMeta.label,
    };
  } else if (visualStatus === 'completed') {
    stepMeta = {
      ...stepMeta,
      label: isDelivery ? 'Order delivered, enjoy!' : stepMeta.label,
    };
  }

  let statusMessage = '';
  switch (visualStatus) {
    case 'requested':
      statusMessage = 'Your order is waiting for chef confirmation';
      break;
    case 'pending':
      statusMessage = 'Chef has confirmed your order and is preparing it';
      break;
    case 'ready':
      statusMessage = isDelivery
        ? 'Your food is ready! It will be delivered at the scheduled time'
        : 'Your food is ready! Please pick it up at the scheduled time';
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

  // Payment never went through — don't show chef-confirmation states for these orders.
  const paymentState = String(order.payment_status ?? '').toLowerCase();
  if ((paymentState === 'failed' || paymentState === 'canceled') && visualStatus !== 'completed') {
    stepMeta = {
      label: paymentState === 'failed' ? 'Payment failed' : 'Payment canceled',
      icon: '',
    };
    statusMessage = paymentState === 'failed'
      ? 'Your payment did not go through and you were not charged. The chef was not notified — please try ordering again.'
      : 'This payment was canceled and you were not charged.';
  }

  const showReadyAction = order.status === 'ready' || order.status === 'completed';
  const showRejectedBanner = false; // Don't show banner for cancelled or rejected orders
  const showCompletedBadge = order.status === 'completed';

  const chefName = chef?.name ?? 'Chef';

  // Helper to format issue type
  const formatIssueType = (type: string) => {
    switch (type) {
      case 'chef_unresponsive': return 'Chef is unresponsive';
      case 'pickup_location_unclear': return 'Pickup location unclear';
      case 'chef_running_late': return "Chef's running late";
      case 'food_unavailable': return 'Food unavailable';
      case 'other': return 'Other';
      default: return type || 'Unknown';
    }
  };

  // Helper to format issue status
  const formatIssueStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending review';
      case 'reviewing': return 'Under review';
      case 'resolved': return 'Resolved';
      case 'dismissed': return 'Dismissed';
      default: return status || 'Pending';
    }
  };

  const getIssueStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F97316';
      case 'reviewing': return '#3B82F6';
      case 'resolved': return '#22C55E';
      case 'dismissed': return '#6B7280';
      default: return PRIMARY;
    }
  };

  return (
    <Screen scroll style={{ backgroundColor: BG }} contentPadding={0}>
      {/* Loading overlay when switching orders */}
      {switchingOrder && (
        <View style={styles.switchingOverlay}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      )}
      
      <View style={styles.wrapper}>
        {/* Order Navigation - Only show if multiple active orders AND current order is in the active list */}
        {allOrders.length > 1 && allOrders.some(o => o.id === order?.id) && (
          <View style={styles.orderNavigation}>
            <TouchableOpacity
              style={[styles.navArrowButton, currentOrderIndex <= 0 && styles.navArrowButtonDisabled]}
              onPress={handleNextOrder}
              disabled={currentOrderIndex <= 0}
            >
              <Image
                source={require('../../assets/previous.png')}
                style={[styles.navArrowIcon, currentOrderIndex <= 0 && styles.navArrowIconDisabled]}
                tintColor={currentOrderIndex <= 0 ? '#9CA3AF' : PRIMARY}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.orderNavInfo}>
              <Text style={styles.orderNavText}>
                Order {currentOrderIndex + 1} of {allOrders.length}
              </Text>
              <Text style={styles.orderNavSubtext}>
                #{String(order?.id || '').padStart(5, '0')}
              </Text>
        </View>
            <TouchableOpacity
              style={[styles.navArrowButton, currentOrderIndex >= allOrders.length - 1 && styles.navArrowButtonDisabled]}
              onPress={handlePreviousOrder}
              disabled={currentOrderIndex >= allOrders.length - 1}
            >
              <Image
                source={require('../../assets/next.png')}
                style={[styles.navArrowIcon, currentOrderIndex >= allOrders.length - 1 && styles.navArrowIconDisabled]}
                tintColor={currentOrderIndex >= allOrders.length - 1 ? '#9CA3AF' : PRIMARY}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        )}

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
          <TouchableOpacity
            style={styles.statusCardHeader}
            onPress={() => setIsStatusExpanded(!isStatusExpanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isStatusExpanded }}
            accessibilityLabel="Order status"
          >
            <Text style={styles.sectionTitle}>Status</Text>
            <Text style={styles.expandIcon}>{isStatusExpanded ? '−' : '+'}</Text>
          </TouchableOpacity>
          {isStatusExpanded ? (
            <>
              <Text style={styles.statusValue}>{stepMeta.label}</Text>
              <View style={styles.statusDetails}>
                {isDelivery ? (
                  <>
                    {order.delivery_phone?.trim() ? (
                      <View style={styles.statusFieldRow}>
                        <TouchableOpacity
                          style={styles.statusFieldIconPressable}
                          onPress={() => {
                            const uri = phoneToTelUri(order.delivery_phone);
                            if (uri) Linking.openURL(uri);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Call delivery contact at ${order.delivery_phone.trim()}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="call-outline" size={22} color={PRIMARY} />
                        </TouchableOpacity>
                        <View style={styles.statusFieldTextCol}>
                          <Text style={styles.statusBlockLabel}>Phone number</Text>
                          <View style={styles.statusInlineValueRow}>
                            <Text style={styles.statusFieldValue} selectable={false}>
                              {formatPhone(order.delivery_phone) || order.delivery_phone.trim()}
                            </Text>
                            <TouchableOpacity
                              style={styles.locationCopyButton}
                              onPress={async () => {
                                const raw = order.delivery_phone!.trim();
                                try {
                                  await Clipboard.setStringAsync(raw);
                                  setPickupAddressCopied(false);
                                  if (pickupCopyResetRef.current) {
                                    clearTimeout(pickupCopyResetRef.current);
                                    pickupCopyResetRef.current = null;
                                  }
                                  if (phoneCopyResetRef.current) {
                                    clearTimeout(phoneCopyResetRef.current);
                                  }
                                  setPhoneNumberCopied(true);
                                  phoneCopyResetRef.current = setTimeout(() => {
                                    setPhoneNumberCopied(false);
                                    phoneCopyResetRef.current = null;
                                  }, 2500);
                                } catch {
                                  Alert.alert('Copy failed', 'Could not copy the phone number. Please try again.');
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={
                                phoneNumberCopied ? 'Phone number copied' : 'Copy phone number'
                              }
                              accessibilityState={{ selected: phoneNumberCopied }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {phoneNumberCopied ? (
                                <Text style={styles.locationCopiedText}>Copied</Text>
                              ) : (
                                <Ionicons name="copy-outline" size={18} color={PRIMARY} />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.statusFieldRow}>
                      {(() => {
                        const canAddCalendar = !!getPickupWindow(order.delivery_at);
                        const deliveryAddressLine =
                          formatLocationDisplay(order.delivery_address) ||
                          order.delivery_address?.trim() ||
                          '';
                        return (
                          <TouchableOpacity
                            style={styles.statusFieldIconPressable}
                            disabled={!canAddCalendar}
                            onPress={() => {
                              if (!canAddCalendar) return;
                              void addPickupToUserCalendar({
                                pickupAt: order.delivery_at,
                                orderId: order.id,
                                locationDescription: deliveryAddressLine,
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Add delivery to calendar"
                            accessibilityState={{ disabled: !canAddCalendar }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={22}
                              color={canAddCalendar ? PRIMARY : TEXT_MUTED}
                            />
                          </TouchableOpacity>
                        );
                      })()}
                      <View style={styles.statusFieldTextCol}>
                        <Text style={styles.statusBlockLabel}>Delivery scheduled</Text>
                        <Text style={styles.statusFieldValue}>
                          {formatScheduledDateTime(order.delivery_at ?? null)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusFieldRow}>
                      {(() => {
                        const oneLine =
                          formatLocationDisplay(order.delivery_address) || 'Not available';
                        const addressForMaps =
                          order.delivery_address?.trim() || oneLine;
                        return (
                          <>
                            <TouchableOpacity
                              style={styles.statusFieldIconPressable}
                              disabled={!addressForMaps || addressForMaps === 'Not available'}
                              onPress={async () => {
                                if (!addressForMaps || addressForMaps === 'Not available') return;
                                const encodedAddress = encodeURIComponent(addressForMaps);
                                const mapsWebUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                                if (Platform.OS === 'web') {
                                  Linking.openURL(mapsWebUrl);
                                  return;
                                }
                                const mapsAppUrl = `comgooglemaps://?q=${encodedAddress}`;
                                try {
                                  const canOpen = await Linking.canOpenURL(mapsAppUrl);
                                  if (canOpen) {
                                    await Linking.openURL(mapsAppUrl);
                                  } else {
                                    await Linking.openURL(mapsWebUrl);
                                  }
                                } catch {
                                  await Linking.openURL(mapsWebUrl);
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Open delivery address in maps"
                              accessibilityState={{
                                disabled: !addressForMaps || addressForMaps === 'Not available',
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Image
                                pointerEvents="none"
                                source={require('../../assets/locationnewicon.png')}
                                style={styles.statusFieldLeadingIcon}
                                tintColor={
                                  addressForMaps && addressForMaps !== 'Not available'
                                    ? LOCATION_PIN_TINT
                                    : TEXT_MUTED
                                }
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                            <View style={styles.statusFieldTextCol}>
                              <Text style={styles.statusBlockLabel}>Delivery address</Text>
                              <View style={styles.statusInlineValueRow}>
                                <Text
                                  style={styles.locationAddressNested}
                                  numberOfLines={3}
                                  ellipsizeMode="tail"
                                >
                                  {oneLine}
                                </Text>
                                {addressForMaps && addressForMaps !== 'Not available' ? (
                                  <TouchableOpacity
                                    style={styles.locationCopyButton}
                                    onPress={async () => {
                                      try {
                                        await Clipboard.setStringAsync(addressForMaps);
                                        setPhoneNumberCopied(false);
                                        if (phoneCopyResetRef.current) {
                                          clearTimeout(phoneCopyResetRef.current);
                                          phoneCopyResetRef.current = null;
                                        }
                                        if (pickupCopyResetRef.current) {
                                          clearTimeout(pickupCopyResetRef.current);
                                        }
                                        setPickupAddressCopied(true);
                                        pickupCopyResetRef.current = setTimeout(() => {
                                          setPickupAddressCopied(false);
                                          pickupCopyResetRef.current = null;
                                        }, 2500);
                                      } catch {
                                        Alert.alert('Copy failed', 'Could not copy the address. Please try again.');
                                      }
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      pickupAddressCopied ? 'Address copied' : 'Copy delivery address'
                                    }
                                    accessibilityState={{ selected: pickupAddressCopied }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    {pickupAddressCopied ? (
                                      <Text style={styles.locationCopiedText}>Copied</Text>
                                    ) : (
                                      <Ionicons name="copy-outline" size={18} color={PRIMARY} />
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  </>
                ) : (
                  <>
                    {chef?.phone?.trim() ? (
                      <View style={styles.statusFieldRow}>
                        <TouchableOpacity
                          style={styles.statusFieldIconPressable}
                          onPress={() => {
                            const uri = phoneToTelUri(chef.phone);
                            if (uri) Linking.openURL(uri);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Call chef at ${chef.phone.trim()}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="call-outline" size={22} color={PRIMARY} />
                        </TouchableOpacity>
                        <View style={styles.statusFieldTextCol}>
                          <Text style={styles.statusBlockLabel}>Phone number</Text>
                          <View style={styles.statusInlineValueRow}>
                            <Text style={styles.statusFieldValue} selectable={false}>
                              {chef.phone.trim()}
                            </Text>
                            <TouchableOpacity
                              style={styles.locationCopyButton}
                              onPress={async () => {
                                const raw = chef.phone.trim();
                                try {
                                  await Clipboard.setStringAsync(raw);
                                  setPickupAddressCopied(false);
                                  if (pickupCopyResetRef.current) {
                                    clearTimeout(pickupCopyResetRef.current);
                                    pickupCopyResetRef.current = null;
                                  }
                                  if (phoneCopyResetRef.current) {
                                    clearTimeout(phoneCopyResetRef.current);
                                  }
                                  setPhoneNumberCopied(true);
                                  phoneCopyResetRef.current = setTimeout(() => {
                                    setPhoneNumberCopied(false);
                                    phoneCopyResetRef.current = null;
                                  }, 2500);
                                } catch {
                                  Alert.alert('Copy failed', 'Could not copy the phone number. Please try again.');
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={
                                phoneNumberCopied ? 'Phone number copied' : 'Copy phone number'
                              }
                              accessibilityState={{ selected: phoneNumberCopied }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {phoneNumberCopied ? (
                                <Text style={styles.locationCopiedText}>Copied</Text>
                              ) : (
                                <Ionicons name="copy-outline" size={18} color={PRIMARY} />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.statusFieldRow}>
                      {(() => {
                        const canAddCalendar = !!getPickupWindow(order.pickup_at);
                        return (
                          <TouchableOpacity
                            style={styles.statusFieldIconPressable}
                            disabled={!canAddCalendar}
                            onPress={() => {
                              if (!canAddCalendar) return;
                              const { street, city, province } = formatLocationAddress(chef?.location);
                              const locationLine =
                                [street, city, province].filter(Boolean).join(', ') || (chef?.location ?? '');
                              void addPickupToUserCalendar({
                                pickupAt: order.pickup_at,
                                orderId: order.id,
                                locationDescription: locationLine,
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Add pickup to calendar"
                            accessibilityState={{ disabled: !canAddCalendar }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={22}
                              color={canAddCalendar ? PRIMARY : TEXT_MUTED}
                            />
                          </TouchableOpacity>
                        );
                      })()}
                      <View style={styles.statusFieldTextCol}>
                        <Text style={styles.statusBlockLabel}>Pickup scheduled</Text>
                        <Text style={styles.statusFieldValue}>
                          {formatScheduledDateTime(order.pickup_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusFieldRow}>
                      {(() => {
                        const { street, city, province } = formatLocationAddress(chef?.location);
                        const oneLine = [street, city, province].filter(Boolean).join(', ');
                        const addressForMaps = chef?.location || oneLine;
                        return (
                          <>
                            <TouchableOpacity
                              style={styles.statusFieldIconPressable}
                              disabled={!addressForMaps}
                              onPress={async () => {
                                if (!addressForMaps) return;
                                const encodedAddress = encodeURIComponent(addressForMaps);
                                const mapsWebUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                                if (Platform.OS === 'web') {
                                  Linking.openURL(mapsWebUrl);
                                  return;
                                }
                                const mapsAppUrl = `comgooglemaps://?q=${encodedAddress}`;
                                try {
                                  const canOpen = await Linking.canOpenURL(mapsAppUrl);
                                  if (canOpen) {
                                    await Linking.openURL(mapsAppUrl);
                                  } else {
                                    await Linking.openURL(mapsWebUrl);
                                  }
                                } catch {
                                  await Linking.openURL(mapsWebUrl);
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Open pickup location in maps"
                              accessibilityState={{ disabled: !addressForMaps }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Image
                                pointerEvents="none"
                                source={require('../../assets/locationnewicon.png')}
                                style={styles.statusFieldLeadingIcon}
                                tintColor={addressForMaps ? LOCATION_PIN_TINT : TEXT_MUTED}
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                            <View style={styles.statusFieldTextCol}>
                              <Text style={styles.statusBlockLabel}>Pickup location</Text>
                              <View style={styles.statusInlineValueRow}>
                                <Text
                                  style={styles.locationAddressNested}
                                  numberOfLines={3}
                                  ellipsizeMode="tail"
                                >
                                  {oneLine || 'Not available'}
                                </Text>
                                {addressForMaps ? (
                                  <TouchableOpacity
                                    style={styles.locationCopyButton}
                                    onPress={async () => {
                                      try {
                                        await Clipboard.setStringAsync(addressForMaps);
                                        setPhoneNumberCopied(false);
                                        if (phoneCopyResetRef.current) {
                                          clearTimeout(phoneCopyResetRef.current);
                                          phoneCopyResetRef.current = null;
                                        }
                                        if (pickupCopyResetRef.current) {
                                          clearTimeout(pickupCopyResetRef.current);
                                        }
                                        setPickupAddressCopied(true);
                                        pickupCopyResetRef.current = setTimeout(() => {
                                          setPickupAddressCopied(false);
                                          pickupCopyResetRef.current = null;
                                        }, 2500);
                                      } catch {
                                        Alert.alert('Copy failed', 'Could not copy the address. Please try again.');
                                      }
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      pickupAddressCopied ? 'Address copied' : 'Copy pickup address'
                                    }
                                    accessibilityState={{ selected: pickupAddressCopied }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    {pickupAddressCopied ? (
                                      <Text style={styles.locationCopiedText}>Copied</Text>
                                    ) : (
                                      <Ionicons name="copy-outline" size={18} color={PRIMARY} />
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  </>
                )}
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.orderSummaryHeader}
            onPress={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
          >
            <View style={styles.orderSummaryTitleRow}>
              <Text style={styles.sectionTitle}>Order summary</Text>
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
          {platformFeeCents > 0 && (
            <View style={styles.summaryRow}>
                <View style={styles.summaryLabelWithIcon}>
                  <Text style={styles.summaryLabel}>Platform service fee </Text>
                  <Text style={styles.infoIcon}>ⓘ</Text>
                </View>
                <Text style={styles.summaryValue}>{cents(platformFeeCents)}</Text>
              </View>
          )}
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryValue}>{cents(calculatedTotalCents)}</Text>
          </View>
              
              {platformFeeCents > 0 && (
                <Text style={styles.platformFeeInfo}>
                  ⓘ It helps support the platform and secure payments.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Reported Issue Section */}
        {reportedIssue && (
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.orderSummaryHeader}
              onPress={() => setIsReportedIssueExpanded(!isReportedIssueExpanded)}
            >
              <Text style={styles.sectionTitle}>Reported Issue</Text>
              <Text style={styles.expandIcon}>{isReportedIssueExpanded ? '−' : '+'}</Text>
            </TouchableOpacity>
            
            {isReportedIssueExpanded && (
              <View style={styles.reportedIssueContent}>
                <View style={styles.reportedIssueRow}>
                  <Text style={styles.reportedIssueLabel}>Status</Text>
                  <View style={[styles.reportedIssueStatusBadge, { backgroundColor: `${getIssueStatusColor(reportedIssue.status)}15` }]}>
                    <Text style={[styles.reportedIssueStatusText, { color: getIssueStatusColor(reportedIssue.status) }]}>
                      {formatIssueStatus(reportedIssue.status)}
                    </Text>
      </View>
                </View>
                
                <View style={styles.reportedIssueRow}>
                  <Text style={styles.reportedIssueLabel}>Issue type</Text>
                  <Text style={styles.reportedIssueValue}>{formatIssueType(reportedIssue.issue_type)}</Text>
                </View>
                
                {reportedIssue.additional_details && (
                  <View style={styles.reportedIssueDetailsSection}>
                    <Text style={styles.reportedIssueLabel}>Details</Text>
                    <Text style={styles.reportedIssueDetails}>{reportedIssue.additional_details}</Text>
                  </View>
                )}
                
                {reportedIssueImages.length > 0 && (
                  <View style={styles.reportedIssueDetailsSection}>
                    <Text style={styles.reportedIssueLabel}>Attached images</Text>
                    <View style={styles.reportedIssueImagesRow}>
                      {reportedIssueImages.map((img: any) => (
                        <Image
                          key={img.id}
                          source={{ uri: img.image_url }}
                          style={styles.reportedIssueImage}
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  </View>
                )}
                
                <Text style={styles.reportedIssueTimestamp}>
                  Reported: {formatLocal(reportedIssue.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                
                {reportedIssue.status === 'pending' && (
                  <Text style={styles.reportedIssueNote}>
                    We'll review your issue within 24 hours.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

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
            {!reportedIssue && (
              <TouchableOpacity 
                style={styles.reportIssueTextCTA}
                onPress={() => setShowReportIssueModal(true)}
              >
                <Text style={styles.reportIssueTextCTAText}>Report an issue?</Text>
              </TouchableOpacity>
            )}
      </View>
        </View>

        <Text style={styles.footerNote}>
          {isDelivery
            ? 'The food is prepared by an independent home chef. Please handle it safely once delivered.'
            : 'The food is prepared by an independent home chef. Please handle it safely after pickup.'}
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
                        tintColor={isRecordingIssue ? '#FFFFFF' : PRIMARY}
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
                        tintColor={PRIMARY}
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
    paddingBottom: 100,
    gap: 20,
  },
  orderNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  navArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowButtonDisabled: {
    backgroundColor: 'transparent',
  },
  navArrowIcon: {
    width: 24,
    height: 24,
  },
  navArrowIconDisabled: {
    opacity: 0.5,
  },
  orderNavInfo: {
    alignItems: 'center',
    gap: 2,
  },
  orderNavText: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  orderNavSubtext: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(242, 240, 239, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  statusValue: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 4,
    marginBottom: 12,
  },
  statusDetails: {
    marginTop: 4,
    gap: 16,
  },
  statusFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusFieldIconPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 44,
    paddingHorizontal: 0,
  },
  statusFieldLeadingIcon: {
    width: 22,
    height: 22,
  },
  statusFieldTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  statusBlockLabel: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
  },
  statusFieldValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    flexShrink: 1,
    minWidth: 0,
  },
  locationAddressNested: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    flexShrink: 1,
    minWidth: 0,
  },
  /** Value + copy hug together (copy immediately after text, not pushed to row end). */
  statusInlineValueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  locationCopyButton: {
    flexShrink: 0,
    paddingVertical: 2,
  },
  locationCopiedText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
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
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  expandIcon: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 20,
    textAlign: 'right',
  },
  orderItemPrice: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '400',
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
    alignItems: 'baseline',
    gap: 4,
  },
  infoIcon: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
  platformFeeInfo: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 8,
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
    marginTop: 2,
  },
  pickupLocation: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    flexShrink: 1,
    minWidth: 0,
  },
  pickupReminder: {
    color: TEXT_MUTED,
    fontSize: 16,
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
    fontWeight: '400',
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
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.display,
  },
  summaryValue: {
    color: TEXT_DARK,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  readyAction: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'center',
  },
  readyActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  actionButtonsContainer: {
    gap: 4,
    marginTop: 4,
  },
  messageChefContainer: {
    gap: 4,
  },
  reportIssueTextCTA: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    marginTop: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIssueTextCTAText: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  messageChefButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  messageChefButtonText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '400',
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
    gap: 4,
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
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: PRIMARY,
  },
  micIconImage: {
    width: 24,
    height: 24,
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
  },
  reportIssueMicIconImageActive: {
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
  // Reported Issue Section Styles
  reportedIssueContent: {
    marginTop: 12,
    gap: 12,
  },
  reportedIssueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportedIssueLabel: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  reportedIssueValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  reportedIssueStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reportedIssueStatusText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  reportedIssueDetailsSection: {
    gap: 8,
  },
  reportedIssueDetails: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  reportedIssueImagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportedIssueImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: BORDER,
  },
  reportedIssueTimestamp: {
    color: TEXT_DARK,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 4,
  },
  reportedIssueNote: {
    color: PRIMARY,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    fontStyle: 'italic',
  },
});
