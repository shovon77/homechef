import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function FAQPage() {
  return (
    <Screen 
      useScrollView 
      contentStyle={styles.content}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Frequently Asked Questions</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>How does HomeChef work?</Text>
          <Text style={styles.paragraph}>
            Chefs create profiles and upload their dishes. Customers browse by cuisine, chef, or location, then place orders directly through the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Who can become a chef?</Text>
          <Text style={styles.paragraph}>
            Anyone who meets local food-safety requirements and loves to cook!
          </Text>
          <Text style={styles.paragraph}>
            We guide you through registration and verification before your shop goes live.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>How are payments handled?</Text>
          <Text style={styles.paragraph}>
            All payments are processed securely through Stripe. Chefs receive payouts directly to their connected accounts after each order.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Is delivery included?</Text>
          <Text style={styles.paragraph}>
            Delivery options depend on each chef. Some offer pickup only, others provide local delivery.
          </Text>
          <Text style={styles.paragraph}>
            Details appear on the chef's profile and checkout page.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Can I rate or review a dish?</Text>
          <Text style={styles.paragraph}>
            Absolutely! After enjoying a meal, you can rate both the dish and the chef to help others discover great food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>How does HomeChef keep food safe?</Text>
          <Text style={styles.paragraph}>
            We verify every chef's credentials, require clear labeling of ingredients, and support compliance with local food-handling laws.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>I'm a chef. Do I need special permits?</Text>
          <Text style={styles.paragraph}>
            Requirements vary by region. In most cases you'll need a valid home-kitchen or micro-enterprise permit.
          </Text>
          <Text style={styles.paragraph}>
            We provide resources and links to your local guidelines during sign-up.
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
});

