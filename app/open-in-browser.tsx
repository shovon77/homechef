'use client';

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '../lib/theme';
import ENV from '../lib/env';
import { isInAppBrowser } from '../lib/inAppBrowser';
import Screen from '../components/Screen';

const PAGE_BG = '#F2F0EF'; // same as homepage
const BRAND_BLACK = '#33393A';

export default function OpenInBrowserScreen() {
  const router = useRouter();
  const { then: thenPath, show: showParam } = useLocalSearchParams<{ then?: string; show?: string }>();
  const [copied, setCopied] = useState(false);

  const destination = thenPath && thenPath !== '' ? String(thenPath) : '/';
  const forceShow = showParam === '1' || showParam === 'true';
  const baseUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : ENV.WEB_BASE_URL;
  const targetUrl = `${baseUrl}${destination.startsWith('/') ? destination : '/' + destination}`;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (forceShow) return; // allow manual navigation to this page
    if (!isInAppBrowser()) {
      router.replace(destination as any);
    }
  }, [Platform.OS, destination, router, forceShow]);

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      });
    }
  };

  if (Platform.OS !== 'web' || (!isInAppBrowser() && !forceShow)) {
    return null;
  }

  return (
    <Screen
      style={{ backgroundColor: PAGE_BG }}
      noFooter={false}
      scrollViewContentStyle={{ paddingBottom: 160 }}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Open link in your phone browser</Text>
          <Text style={styles.subtitle}>Messenger cannot complete Google sign-in</Text>
          <Text style={styles.stepLabel}>Step 1</Text>
          <Text style={styles.stepBody}>Tap Copy link</Text>

          <Text style={styles.stepLabel}>Step 2</Text>
          <Text style={styles.stepBody}>Open Safari (iPhone) or Chrome (Android)</Text>

          <Text style={styles.stepLabel}>Step 3</Text>
          <Text style={styles.stepBody}>Tap the top search bar</Text>

          <Text style={styles.stepLabel}>Step 4</Text>
          <Text style={styles.stepBody}>Paste the link and press Go</Text>

          <Text style={styles.sectionLabel}>Faster option</Text>
          <Text style={styles.stepBody}>
            Tap the ⋮ menu on Messenger (top-right corner){'\n'}
            Select Open in Browser or{'\n'}
            Select Open in Chrome
          </Text>

          <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.8}>
            <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy link'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    maxWidth: 420,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_BLACK,
    marginBottom: 8,
    fontFamily: theme.typography.fontFamily.display,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_BLACK,
    marginBottom: 6,
    fontFamily: theme.typography.fontFamily.body,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_BLACK,
    marginTop: 8,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily.display,
  },
  stepBody: {
    fontSize: 15,
    color: BRAND_BLACK,
    lineHeight: 22,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily.body,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_BLACK,
    marginTop: 16,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily.display,
  },
  copyBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  copyBtnText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
  },
});
