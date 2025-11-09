import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function AboutPage() {
  return (
    <Screen 
      useScrollView 
      contentStyle={styles.content}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>About HomeChef</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Our Mission</Text>
          <Text style={styles.paragraph}>
            HomeChef connects passionate home cooks with food lovers in their own communities.
          </Text>
          <Text style={styles.paragraph}>
            We believe homemade meals tell stories — of family, culture, and creativity — and everyone should have the chance to share and enjoy them.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What We Do</Text>
          <Text style={styles.paragraph}>
            We give talented chefs and everyday cooks a simple way to:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• List their dishes with beautiful photos and real-time availability.</Text>
            <Text style={styles.listItem}>• Manage orders safely through integrated payments.</Text>
            <Text style={styles.listItem}>• Build local followings and loyal customers.</Text>
          </View>
          <Text style={styles.paragraph}>
            For eaters, HomeChef is a gateway to authentic, handcrafted food you can't find in restaurants — all prepared by neighbors who care.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Our Promise</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Authenticity:</Text> Every dish is homemade with care.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Safety:</Text> Verified chefs and secure payments keep everyone protected.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Community:</Text> Each order supports local talent and celebrates diverse cultures.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Join Us</Text>
          <Text style={styles.paragraph}>
            Whether you're a chef ready to share your passion or someone searching for flavors that remind you of home — you belong here at <Text style={styles.bold}>HomeChef</Text>.
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
  list: {
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  listItem: {
    color: '#101828',
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.sm,
  },
  bold: {
    fontWeight: theme.typography.fontWeight.bold,
  },
});

