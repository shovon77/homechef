import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function TermsPage() {
  return (
    <Screen 
      useScrollView 
      contentStyle={styles.content}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last updated: November 2025</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Welcome to <Text style={styles.bold}>HomeChef</Text>!
          </Text>
          <Text style={styles.paragraph}>
            By using our platform, you agree to the following terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>1. Platform Purpose</Text>
          <Text style={styles.paragraph}>
            HomeChef provides an online marketplace where independent home chefs can list and sell prepared food.
          </Text>
          <Text style={styles.paragraph}>
            HomeChef itself does not cook, package, or deliver food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. User Accounts</Text>
          <Text style={styles.paragraph}>
            You must be at least 18 years old to create an account.
          </Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>3. Chef Responsibilities</Text>
          <Text style={styles.paragraph}>
            Chefs must comply with all local health, safety, and business regulations.
          </Text>
          <Text style={styles.paragraph}>
            HomeChef reserves the right to suspend listings that violate these requirements.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>4. Orders and Payments</Text>
          <Text style={styles.paragraph}>
            Payments are processed securely through our third-party provider (Stripe).
          </Text>
          <Text style={styles.paragraph}>
            Refunds, cancellations, and disputes are subject to each chef's cancellation policy and Stripe's rules.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>5. Reviews and Content</Text>
          <Text style={styles.paragraph}>
            Users may leave ratings and reviews in good faith.
          </Text>
          <Text style={styles.paragraph}>
            Offensive, fraudulent, or defamatory content may be removed at HomeChef's discretion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>6. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            HomeChef acts solely as a marketplace intermediary and is not responsible for the preparation or quality of food sold by chefs.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>7. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms from time to time. Continued use of the platform constitutes acceptance of the revised Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            If you have any questions, contact <Text style={styles.bold}>support@homechef.com</Text>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing['4xl'],
  },
  container: {
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Platform.select({
      web: theme.spacing['4xl'],
      default: theme.spacing.lg,
    }),
    paddingTop: theme.spacing['2xl'],
  },
  title: {
    color: '#101828',
    fontSize: 36,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.02,
    marginBottom: theme.spacing.sm,
  },
  lastUpdated: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontStyle: 'italic',
    marginBottom: theme.spacing['2xl'],
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  heading: {
    color: '#101828',
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 24 * 1.4,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  paragraph: {
    color: '#101828',
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  bold: {
    fontWeight: theme.typography.fontWeight.bold,
  },
});

