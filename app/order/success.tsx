'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform, Image, Linking, useWindowDimensions, Modal, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import Screen from '../../components/Screen';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { cents } from '../../lib/money';
import { uploadToBucket } from '../../lib/upload';
import { createNotification } from '../../lib/notifications';
import { formatLocationDisplay } from '../../lib/formatAddress';
import { isDeliveryOrder } from '../../lib/chef-fulfillment';
import { formatPhone } from '../../lib/formatPhone';

const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';
const PRIMARY = '#FE734C';

export default function OrderSuccessPage() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = params.orderId ? Number(params.orderId) : null;
  const { clearCart } = useCart();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [fulfillmentLocation, setFulfillmentLocation] = useState<string | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState<string | null>(null);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number | null>(null);
  const [orderSubtotalCents, setOrderSubtotalCents] = useState<number | null>(null);
  const [orderPlatformFeeCents, setOrderPlatformFeeCents] = useState<number | null>(null);
  const [items, setItems] = useState<Array<{ id: number; dish_id: number | null; quantity: number; unit_price_cents: number; dish?: { id: number; name: string } | null }>>([]);
  const [chef, setChef] = useState<{ id: number; name: string; photo?: string | null } | null>(null);
  const [orderTotalCents, setOrderTotalCents] = useState<number | null>(null);
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(false);
  const [isPickupAddressExpanded, setIsPickupAddressExpanded] = useState(false);
  const [isPickupDateTimeExpanded, setIsPickupDateTimeExpanded] = useState(false);
  const [isDeliveryDetailsExpanded, setIsDeliveryDetailsExpanded] = useState(false);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [issueImages, setIssueImages] = useState<string[]>([]);
  const [uploadingIssueImages, setUploadingIssueImages] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [isRecordingIssue, setIsRecordingIssue] = useState(false);
  const issueRecognitionRef = useRef<any>(null);
  const [showIssueTypeDropdown, setShowIssueTypeDropdown] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Restore session after Stripe redirect (Stripe redirects can sometimes lose session cookies)
  // This ensures the session is properly restored before the AuthContext checks for it
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;
    
    const restoreSession = async () => {
      try {
        // First, try to get the current session
        let { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OrderSuccess] Error getting session:', error);
          return;
        }
        
        // If we have a session, try to refresh it to ensure it's still valid
        if (session) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshedSession && mounted) {
            // Session refreshed successfully
            return;
          }
        }
        
        // If no session and we haven't exceeded retries, wait a bit and try again
        // This gives Supabase time to restore the session from storage
        if (!session && retryCount < maxRetries && mounted) {
          retryCount++;
          setTimeout(() => {
            if (mounted) restoreSession();
          }, 200); // Wait 200ms between retries
          return;
        }
        
        if (!session && mounted) {
          console.warn('[OrderSuccess] No session found after Stripe redirect after', maxRetries, 'retries');
        }
      } catch (error) {
        console.error('[OrderSuccess] Error restoring session:', error);
      }
    };
    
    // Start restoration immediately
    restoreSession();
    
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Clear cart immediately when user reaches success page
    // If we're on the success page, it means Stripe successfully redirected here after payment
    // We don't need to wait for payment_status to be 'succeeded' (that happens via webhook)
    if (orderId && !paymentConfirmed) {
      (async () => {
        // Verify the order exists (double-check)
        const { data: order } = await supabase
          .from('orders')
          .select(
            'id, payment_status, checkout_session_id, pickup_at, delivery_at, chef_id, fulfillment_method, delivery_address, delivery_phone, delivery_fee_cents, subtotal_cents, total_cents, platform_fee_cents'
          )
          .eq('id', orderId)
          .maybeSingle();
        
        // If order exists, clear the cart immediately
        // The fact that we're on the success page means payment was successful
        if (order) {
          clearCart();
          setPaymentConfirmed(true);

          const deliveryOrder = isDeliveryOrder(order);
          setIsDelivery(deliveryOrder);

          if (typeof order.subtotal_cents === 'number') {
            setOrderSubtotalCents(order.subtotal_cents);
          }
          if (typeof order.platform_fee_cents === 'number') {
            setOrderPlatformFeeCents(order.platform_fee_cents);
          }
          if (typeof order.total_cents === 'number') {
            setOrderTotalCents(order.total_cents);
          }
          if (typeof order.delivery_fee_cents === 'number') {
            setDeliveryFeeCents(order.delivery_fee_cents);
          }

          if (deliveryOrder) {
            if (order.delivery_at) setScheduledAt(order.delivery_at);
            if (order.delivery_address?.trim()) {
              setFulfillmentLocation(order.delivery_address.trim());
            }
            if (order.delivery_phone?.trim()) {
              setDeliveryPhone(order.delivery_phone.trim());
            }
          } else if (order.pickup_at) {
            setScheduledAt(order.pickup_at);
          }
          
          // Fetch chef location (pickup) and name
          if (order.chef_id) {
            const { data: chefData } = await supabase
              .from('chefs')
              .select('id, location, name, photo')
              .eq('id', order.chef_id)
              .maybeSingle();
            
            if (chefData) {
              if (!deliveryOrder && chefData.location) {
                setFulfillmentLocation(chefData.location);
              }
              if (chefData.name && chefData.id) {
                setChef({ id: chefData.id, name: chefData.name, photo: chefData.photo || null });
              }
            }
          }
          
          // Fetch order items and dishes
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);
          
          if (orderItems && orderItems.length > 0) {
            const dishIds = orderItems.map(it => it.dish_id).filter((id): id is number => typeof id === 'number');
            const { data: dishes } = dishIds.length
              ? await supabase.from('dishes').select('id,name').in('id', dishIds)
              : { data: [] };
            
            const dishMap = new Map();
            (dishes || []).forEach((d: any) => dishMap.set(d.id, d));
            
            const itemsWithDishes = orderItems.map((it: any) => ({
              ...it,
              dish: it.dish_id ? dishMap.get(it.dish_id) || null : null
            }));
            
            setItems(itemsWithDishes);
          }
        }
      })();
    } else if (!orderId && !paymentConfirmed) {
      // Even without orderId, if we're on the success page, clear the cart
      // This handles edge cases where orderId might not be in the URL
      clearCart();
      setPaymentConfirmed(true);
    }
  }, [orderId, paymentConfirmed, clearCart]);
  
  // Format scheduled date/time (pickup or delivery window)
  const formatScheduledDateTime = (at: string | null): string => {
    if (!at) return 'Not available';
    try {
      const date = new Date(at);
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
  };
  
  // Calculate order summary values
  const itemsSubtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
    [items]
  );
  const subtotalCents = orderSubtotalCents ?? itemsSubtotalCents;
  const platformFeeCents = orderPlatformFeeCents ?? 0;
  const deliveryFee = isDelivery ? (deliveryFeeCents ?? 0) : 0;
  const calculatedTotalCents = subtotalCents + platformFeeCents + (isDelivery ? deliveryFee : 0);
  const totalCents = orderTotalCents !== null ? orderTotalCents : calculatedTotalCents;

  // Voice input handlers for messaging
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
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        Alert.alert('Error', 'Speech recognition failed. Please try again.');
      }
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

  // Send message function
  const handleSendMessage = async () => {
    if (!messageText.trim() || !orderId || !chef || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to send messages');
        return;
      }

      // Get chef's user_id
      let chefUserId: string | null = null;
      if (chef.id) {
        const { data: chefData } = await supabase
          .from('chefs')
          .select('user_id')
          .eq('id', chef.id)
          .maybeSingle();
        chefUserId = chefData?.user_id || null;
      }

      const { error } = await supabase
        .from('order_messages')
        .insert({
          order_id: orderId,
          user_id: user.id,
          chef_id: chef.id,
          sender_user_id: user.id,
          recipient_user_id: chefUserId,
          sender_type: 'customer',
          message: messageText.trim(),
          chef_name: chef.name,
        })
        .select()
        .single();

      if (error) throw error;

      setMessageText('');
      setShowMessageModal(false);
      Alert.alert('Success', 'Message sent successfully!');

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
          
          // Create notification for chef
          await createNotification(
            chefUserId,
            'order_message',
            'New Message in Order',
            `${customerName} sent a new message for Order #${orderId}.`,
            orderId,
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

  // Voice input handlers for issue reporting
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
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecordingIssue(false);
      if (event.error !== 'no-speech') {
        Alert.alert('Error', 'Speech recognition failed. Please try again.');
      }
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

  // Image upload handler
  const handleIssueImageUpload = async () => {
    if (issueImages.length >= 3) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 3 images');
      return;
    }

    try {
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
              `order-issues/${orderId || 'temp'}`
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
        Alert.alert('Info', 'Image upload on mobile coming soon');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload image');
    }
  };

  const handleRemoveIssueImage = (index: number) => {
    setIssueImages(prev => prev.filter((_, i) => i !== index));
  };

  // Submit issue report
  const handleSubmitIssue = async () => {
    if (!issueType) {
      Alert.alert('Required', 'Please select an issue type');
      return;
    }

    if (!orderId || !chef) {
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
          order_id: orderId,
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F0EF' }}>
      <Screen 
        contentPadding={0}
        style={{ backgroundColor: '#F2F0EF' }}
        contentStyle={{ 
          paddingHorizontal: 0, 
          paddingTop: 0, 
          paddingBottom: 0, 
          paddingLeft: 0, 
          paddingRight: 0, 
          marginHorizontal: 0,
          marginLeft: 0,
          marginRight: 0,
          backgroundColor: '#F2F0EF',
          overflow: 'visible' as any,
        }}
        scrollViewContentStyle={{ 
          paddingHorizontal: 0, 
          paddingLeft: 0, 
          paddingRight: 0, 
          marginHorizontal: 0,
          marginLeft: 0,
          marginRight: 0,
          backgroundColor: '#F2F0EF',
        }}
        fixedFooterHeight={Platform.select({
          web: 100,
          default: 80,
        })}
      >
        <View style={[styles.screen, { marginHorizontal: 0, marginLeft: 0, marginRight: 0 }]}>
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Order confirmed</Text>
              {chef && (
                <TouchableOpacity
                  style={styles.messageChefButtonSmall}
                  onPress={() => setShowMessageModal(true)}
                >
                  <Image 
                    source={require('../../assets/chat.png')} 
                    style={styles.messageChefIcon}
                    tintColor={PRIMARY}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </View>
            {Number.isFinite(orderId) ? (
              <>
                <Text style={styles.orderId}>Order #{String(orderId).padStart(5, '0')}</Text>
                <Text style={styles.copy}>
                  Your order's been sent to the chef.
                </Text>
              </>
            ) : null}
            
            {/* Pickup or delivery details */}
            {(scheduledAt || fulfillmentLocation || (isDelivery && deliveryPhone)) && (
              <View style={styles.pickupInfoContainer}>
                {isDelivery ? (
                  <View style={styles.pickupLocationCard}>
                    <TouchableOpacity
                      style={styles.pickupLocationHeader}
                      onPress={() => setIsDeliveryDetailsExpanded(!isDeliveryDetailsExpanded)}
                    >
                      <Text style={styles.pickupLocationLabel}>Delivery details</Text>
                      <Text style={styles.expandIcon}>{isDeliveryDetailsExpanded ? '−' : '+'}</Text>
                    </TouchableOpacity>
                    {isDeliveryDetailsExpanded ? (
                      <View style={styles.deliveryDetailsContent}>
                        {deliveryPhone ? (
                          <View style={styles.deliveryDetailBlock}>
                            <Text style={styles.deliveryDetailLabel}>Phone</Text>
                            <Text style={styles.deliveryDetailValue}>
                              {formatPhone(deliveryPhone) || deliveryPhone}
                            </Text>
                          </View>
                        ) : null}
                        {fulfillmentLocation ? (
                          <View style={styles.deliveryDetailBlock}>
                            <Text style={styles.deliveryDetailLabel}>Address</Text>
                            <View style={styles.deliveryAddressRow}>
                              <Text style={styles.deliveryDetailValue}>
                                {formatLocationDisplay(fulfillmentLocation)}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  const encodedAddress = encodeURIComponent(fulfillmentLocation || '');
                                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                                  Linking.openURL(mapsUrl);
                                }}
                              >
                                <Image
                                  source={require('../../assets/locationnewicon.png')}
                                  style={styles.locationIcon}
                                  tintColor={PRIMARY}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                        {scheduledAt ? (
                          <View style={styles.deliveryDetailBlock}>
                            <Text style={styles.deliveryDetailLabel}>Date & time</Text>
                            <Text style={styles.deliveryDetailValue}>
                              {formatScheduledDateTime(scheduledAt)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                    {fulfillmentLocation ? (
                      <View style={styles.pickupLocationCard}>
                        <TouchableOpacity
                          style={styles.pickupLocationHeader}
                          onPress={() => setIsPickupAddressExpanded(!isPickupAddressExpanded)}
                        >
                          <Text style={styles.pickupLocationLabel}>Pickup address</Text>
                          <Text style={styles.expandIcon}>{isPickupAddressExpanded ? '−' : '+'}</Text>
                        </TouchableOpacity>
                        {isPickupAddressExpanded && (
                          <View style={styles.pickupLocationContainer}>
                            <View style={styles.pickupLocationRow}>
                              <Text style={styles.pickupLocation}>
                                {formatLocationDisplay(fulfillmentLocation)}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  const encodedAddress = encodeURIComponent(fulfillmentLocation || '');
                                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                                  Linking.openURL(mapsUrl);
                                }}
                              >
                                <Image
                                  source={require('../../assets/locationnewicon.png')}
                                  style={styles.locationIcon}
                                  tintColor={PRIMARY}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : null}
                    {scheduledAt ? (
                      <View style={styles.pickupDateTimeCard}>
                        <TouchableOpacity
                          style={styles.pickupDateTimeHeader}
                          onPress={() => setIsPickupDateTimeExpanded(!isPickupDateTimeExpanded)}
                        >
                          <Text style={styles.pickupDateTimeLabel}>Pickup date & time</Text>
                          <Text style={styles.expandIcon}>{isPickupDateTimeExpanded ? '−' : '+'}</Text>
                        </TouchableOpacity>
                        {isPickupDateTimeExpanded && (
                          <View style={styles.pickupDateTimeContainer}>
                            <Text style={styles.pickupDateTime}>
                              {formatScheduledDateTime(scheduledAt)}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            )}
            
            {/* Order Summary */}
            {items.length > 0 && (
              <View style={styles.orderSummaryCard}>
                <TouchableOpacity 
                  style={styles.orderSummaryHeader}
                  onPress={() => setIsOrderSummaryExpanded(!isOrderSummaryExpanded)}
                >
                  <Text style={styles.sectionTitle}>Order summary</Text>
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
                      <>
                        <View style={styles.summaryRow}>
                          <View style={styles.summaryLabelWithIcon}>
                            <Text style={styles.summaryLabel}>Platform service fee </Text>
                            <Text style={styles.infoIcon}>ⓘ</Text>
                          </View>
                          <Text style={styles.summaryValue}>{cents(platformFeeCents)}</Text>
                        </View>
                      </>
                    )}
                    {isDelivery && deliveryFee > 0 ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Delivery fee</Text>
                        <Text style={styles.summaryValue}>{cents(deliveryFee)}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                      <Text style={[styles.summaryLabel, styles.summaryTotalLabel]}>Total</Text>
                      <Text style={[styles.summaryValue, styles.summaryTotalValue]}>{cents(totalCents)}</Text>
                    </View>
                    
                    {platformFeeCents > 0 && (
                      <Text style={styles.platformFeeInfo}>
                        ⓘ It helps support the platform and secure payments.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
            
            <Text style={styles.reminderText}>
              {isDelivery
                ? "We'll remind you before delivery!"
                : "We'll remind you before pickup!"}
            </Text>
            
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => setShowReportIssueModal(true)}
            >
              <Text style={styles.helpButtonText}>Need help with this order?</Text>
            </TouchableOpacity>
            
            <Link href="/browse?tab=dishes" asChild>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore, as you wait!</Text>
              </TouchableOpacity>
            </Link>
          </View>
          
          <View style={styles.footerNoteContainer}>
            {isMobile ? (
              <>
                <Text style={styles.footerNote}>
                  The food is prepared by an independent home chef.
                </Text>
                <Text style={styles.footerNote}>
                  {isDelivery
                    ? 'Please handle it safely once delivered.'
                    : 'Please handle it safely after pickup.'}
                </Text>
              </>
            ) : (
              <Text style={styles.footerNote}>
                {isDelivery
                  ? 'The food is prepared by an independent home chef. Please handle it safely once delivered.'
                  : 'The food is prepared by an independent home chef. Please handle it safely after pickup.'}
              </Text>
            )}
          </View>
        </View>
      </Screen>
      
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
                {Number.isFinite(orderId) && (
                  <Text style={styles.reportIssueOrderNumber}>Order #{String(orderId).padStart(5, '0')}</Text>
                )}
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
                        borderColor: '#E3E7E7',
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
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
                    <Image 
                      source={{ uri: chef.photo }} 
                      style={styles.chefLogoModal}
                      resizeMode="cover"
                    />
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
                      style={[styles.micIconImage, isRecording && styles.micIconImageActive]}
                      tintColor={isRecording ? '#FFFFFF' : PRIMARY}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: '#F2F0EF',
  },
  card: {
    backgroundColor: '#F2F0EF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 24,
    paddingTop: 0,
    width: '100%',
    maxWidth: 420,
    marginHorizontal: 24,
    gap: 4,
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'left',
    flex: 1,
  },
  copy: {
    color: TEXT_MUTED,
    textAlign: 'left',
    fontSize: 18,
    marginTop: 0,
    marginBottom: 0,
  },
  orderId: {
    color: TEXT_DARK,
    fontWeight: '400',
    textAlign: 'left',
    fontSize: 18,
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '400',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: TEXT_MUTED,
    fontWeight: '400',
  },
  pickupInfoContainer: {
    width: '100%',
    marginTop: 8,
    gap: 24,
  },
  pickupLocationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 12,
    paddingLeft: 0,
    gap: 8,
    width: '100%',
  },
  pickupDateTimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 12,
    paddingLeft: 0,
    gap: 8,
    width: '100%',
  },
  pickupLocationContainer: {
    gap: 4,
    width: '100%',
    paddingLeft: 24,
  },
  deliveryDetailsContent: {
    gap: 16,
    width: '100%',
    paddingLeft: 24,
    paddingTop: 4,
  },
  deliveryDetailBlock: {
    gap: 4,
    width: '100%',
  },
  deliveryDetailLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '500',
  },
  deliveryDetailValue: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    flex: 1,
  },
  deliveryAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  pickupDateTimeContainer: {
    gap: 4,
    width: '100%',
    paddingLeft: 24,
  },
  pickupDateTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingLeft: 24,
    minHeight: 24,
  },
  pickupDateTimeLabel: {
    color: TEXT_DARK,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '800',
  },
  messageChefButtonSmall: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageChefIcon: {
    width: 50,
    height: 50,
  },
  pickupDateTime: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
  },
  pickupLocationContainer: {
    gap: 4,
    width: '100%',
  },
  pickupLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingLeft: 24,
    minHeight: 24,
  },
  pickupLocationLabel: {
    color: TEXT_DARK,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '800',
  },
  pickupLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 24,
  },
  locationIcon: {
    width: 24,
    height: 24,
  },
  pickupLocation: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
  },
  pickupReminder: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 18,
    marginTop: 4,
  },
  orderSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 12,
    paddingLeft: 0,
    gap: 8,
    width: '100%',
    marginTop: 20,
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingLeft: 24,
    minHeight: 24,
  },
  orderSummaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
  },
  orderNumber: {
    color: TEXT_DARK,
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
    paddingLeft: 24,
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
    fontSize: 16,
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
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 20,
    textAlign: 'right',
  },
  orderItemPrice: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 80,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E3E7E7',
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.display,
  },
  summaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  infoIcon: {
    color: TEXT_MUTED,
    fontSize: 16,
    lineHeight: 20,
  },
  summaryValue: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
    minWidth: 80,
    textAlign: 'right',
  },
  summaryTotalLabel: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.display,
  },
  summaryTotalValue: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  platformFeeInfo: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 8,
  },
  reminderText: {
    color: TEXT_DARK,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  footerNoteContainer: {
    width: '100%',
    marginTop: 24,
    marginBottom: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerNote: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
    textAlign: 'center',
    width: '100%',
  },
  helpButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  helpButtonText: {
    color: PRIMARY,
    fontWeight: '400',
    fontSize: 14,
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E3E7E7',
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
  reportIssueSelectContainer: {
    width: '100%',
  },
  reportIssueSelectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E3E7E7',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#E3E7E7',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E3E7E7',
    backgroundColor: '#FFFFFF',
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
    fontWeight: '400',
  },
  reportIssueTextInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E3E7E7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
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
    fontWeight: '400',
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
    fontWeight: '400',
  },
  reportIssueSubmitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  reportIssueSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportIssueSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.body,
  },
  // Message Modal Styles
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E3E7E7',
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
    overflow: 'hidden',
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
    borderColor: '#E3E7E7',
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
  micIconImageActive: {
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
    fontWeight: '400',
  },
});
