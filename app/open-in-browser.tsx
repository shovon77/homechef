'use client';

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '../lib/theme';
import ENV from '../lib/env';
import { isInAppBrowser } from '../lib/inAppBrowser';

export default function OpenInBrowserScreen() {
  const router = useRouter();
  const { then: thenPath } = useLocalSearchParams<{ then?: string }>();
  const [copied, setCopied] = useState(false);

  const destination = thenPath && thenPath !== '' ? String(thenPath) : '/';
  const baseUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : ENV.WEB_BASE_URL;
  const targetUrl = `${baseUrl}${destination.startsWith('/') ? destination : '/' + destination}`;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isInAppBrowser()) {
      router.replace(destination as any);
    }
  }, [Platform.OS, destination, router]);

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      });
    }
  };

  if (Platform.OS !== 'web' || !isInAppBrowser()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Open in your browser</Text>
        <Text style={styles.message}>
          You're viewing this link inside Messenger (or another app). Sign-in with Google doesn't work here.
        </Text>
        <Text style={styles.instruction}>
          Use Messenger’s menu: tap the ••• at the top, then choose “Open in Browser” or “Open in Safari”. Or copy the link below and paste it into Safari or Chrome.
        </Text>
        <View style={styles.urlRow}>
          <Text style={styles.url} selectable numberOfLines={2}>
            {targetUrl}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.8}>
          <Text style={styles.copyBtnText}>{copied ? 'Copied! Open Safari or Chrome and paste the link.' : 'Copy link'}</Text>
        </TouchableOpacity>
        {copied && (
          <Text style={styles.copiedHint}>Then open Safari or Chrome and paste in the address bar.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 24,
    maxWidth: 420,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 24,
    marginBottom: 12,
  },
  instruction: {
    fontSize: 15,
    color: theme.colors.subtle,
    lineHeight: 22,
    marginBottom: 16,
  },
  urlRow: {
    marginBottom: 16,
  },
  url: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  copyBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryContrast,
  },
  copiedHint: {
    fontSize: 14,
    color: theme.colors.subtle,
    marginTop: 12,
    textAlign: 'center',
  },
});
