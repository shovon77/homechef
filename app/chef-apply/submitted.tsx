'use client';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/Screen';
import { theme } from '../../lib/theme';
import { useRole } from '../../hooks/useRole';

// Colors from HTML design
const PRIMARY_COLOR = '#2A9D8F';
const BACKGROUND_LIGHT = '#F4F4F4';
const CARD_LIGHT = '#FFFFFF';
const BORDER_LIGHT = '#e2e8f0';
const TEXT_LIGHT = '#264653';
const TEXT_MUTED = '#6b7280';

type ApplicationData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  short_bio: string | null;
  experience: string | null;
  cuisine_specialty: string | null;
  status: string;
  created_at: string;
};

export default function SubmittedPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { isAdmin, isChef } = useRole();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      setError('No application ID provided');
      setLoading(false);
      return;
    }

    async function loadApplication() {
      try {
        const { data, error: fetchError } = await supabase
          .from('chef_applications')
          .select('id, name, email, phone, location, short_bio, experience, cuisine_specialty, status, created_at')
          .eq('id', params.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) {
          setError('Application not found');
          return;
        }

        setApplication(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load application');
      } finally {
        setLoading(false);
      }
    }

    loadApplication();
  }, [params.id]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' };
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' };
      case 'submitted':
      default:
        return { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'submitted':
      default:
        return 'Submitted';
    }
  };

  const getProfileRoute = () => {
    if (isAdmin) return '/admin/profile';
    if (isChef) return '/chef/profile';
    return '/profile';
  };

  if (loading) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading application...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !application) {
    return (
      <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error || 'Application not found'}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/')}
            >
              <Text style={styles.buttonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const statusColors = getStatusBadgeColor(application.status);

  return (
    <Screen style={{ backgroundColor: BACKGROUND_LIGHT }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.card}>
            {/* Title */}
            <Text style={styles.title}>Application Submitted</Text>
            <Text style={styles.subtitle}>
              Your chef application has been received and is under review.
            </Text>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {getStatusLabel(application.status)}
              </Text>
            </View>

            {/* Request ID */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Request ID</Text>
              <Text style={styles.requestId}>{application.id}</Text>
            </View>

            {/* Application Details */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Application Details</Text>
              
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name:</Text>
                <Text style={styles.fieldValue}>{application.name || '—'}</Text>
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Email:</Text>
                <Text style={styles.fieldValue}>{application.email || '—'}</Text>
              </View>

              {application.phone && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Phone:</Text>
                  <Text style={styles.fieldValue}>{application.phone}</Text>
                </View>
              )}

              {application.location && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Location:</Text>
                  <Text style={styles.fieldValue}>{application.location}</Text>
                </View>
              )}

              {application.short_bio && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Bio:</Text>
                  <Text style={styles.fieldValue}>{application.short_bio}</Text>
                </View>
              )}

              {application.experience && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Experience:</Text>
                  <Text style={styles.fieldValue}>{application.experience}</Text>
                </View>
              )}

              {application.cuisine_specialty && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Cuisine Specialty:</Text>
                  <Text style={styles.fieldValue}>{application.cuisine_specialty}</Text>
                </View>
              )}

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Submitted:</Text>
                <Text style={styles.fieldValue}>
                  {application.created_at
                    ? new Date(application.created_at).toLocaleString()
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => router.push('/')}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Back to Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push(getProfileRoute())}
              >
                <Text style={styles.buttonText}>View Profile</Text>
              </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
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
  title: {
    color: TEXT_LIGHT,
    fontSize: Platform.select({ web: 36, default: 28 }),
    fontWeight: theme.typography.fontWeight.black as any,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.xl,
  },
  statusText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  section: {
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  sectionLabel: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: theme.spacing.md,
  },
  requestId: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: Platform.select({ web: 'monospace', default: 'monospace' }),
    backgroundColor: BACKGROUND_LIGHT,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  fieldLabel: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium as any,
    width: 120,
    marginRight: theme.spacing.md,
  },
  fieldValue: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  buttonTextSecondary: {
    color: TEXT_LIGHT,
  },
  errorTitle: {
    color: TEXT_LIGHT,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  errorText: {
    color: TEXT_MUTED,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
});

