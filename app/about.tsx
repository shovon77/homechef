import React from "react";
import { View, Text, StyleSheet, Platform, Image, useWindowDimensions } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function AboutPage() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <Screen 
      contentStyle={styles.content}
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>About Us</Text>
        
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>YourHomeChef</Text>

        <Image 
          source={require('../assets/About us.png')} 
          style={[styles.heroImage, isMobile && styles.heroImageMobile]}
          resizeMode="contain"
        />

        <View style={styles.section}>
          <Text style={[styles.heading, isMobile && styles.headingMobile]}>Our Mission</Text>
          <Text style={styles.paragraph}>
            YourHomeChef connects passionate home cooks with people who appreciate authentic, handcrafted meals. We believe homemade food carries stories — of family, tradition, and culture — and our mission is to make it easy for those stories to be shared within local communities.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What We Do</Text>
          <Text style={styles.paragraph}>
            YourHomeChef is a marketplace platform that empowers independent cooks and home chefs to grow their craft by providing tools to:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Showcase dishes with high-quality photos and clear ingredient details</Text>
            <Text style={styles.listItem}>• Manage orders seamlessly through secure, integrated payments</Text>
            <Text style={styles.listItem}>• Reach local customers who value genuine, homemade food</Text>
          </View>
          <Text style={styles.paragraph}>
            For customers, YourHomeChef offers access to unique, small-batch meals prepared with personal care — dishes you won’t find in restaurants, made by neighbors who love sharing their cooking.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Our Promise</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Authenticity</Text>{"\n"}
              Every dish is prepared by an independent chef who brings their own story, flavor, and heritage to the table.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Safety</Text>{"\n"}
              We verify chef documentation and provide a transparent marketplace experience — including ingredient and allergen disclosures — so customers can make informed choices.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Community</Text>{"\n"}
              Every order supports local talent, celebrates cultural diversity, and strengthens real connections within neighborhoods
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Join Us</Text>
          <Text style={styles.paragraph}>
            Whether you’re a cook ready to share your creations or someone searching for meals that taste like home, YourHomeChef is your space to discover, connect, and belong.
          </Text>
          <Text style={[styles.paragraph, styles.brandName]}>YourHomeChef</Text>
          <Text style={styles.paragraph}>Your marketplace for authentic homemade meals.</Text>
          <Text style={styles.copyright}>© 2025 YourHomeChef. All rights reserved.</Text>
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
    color: '#33393a',
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.02,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: '#33393a',
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 24 * 1.2,
    marginBottom: theme.spacing.lg,
  },
  subtitleMobile: {
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: 300,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.lg,
  },
  heroImageMobile: {
    height: 180,
    marginTop: 0,
    marginBottom: 8,
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  heading: {
    color: '#33393a',
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 24 * 1.4,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  headingMobile: {
    marginTop: 8,
  },
  paragraph: {
    color: '#33393a',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  list: {
    marginBottom: theme.spacing.md,
  },
  listItem: {
    color: '#33393a',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  bold: {
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fontFamily.display,
  },
  brandName: {
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.fontSize.lg * 1.5,
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.display,
  },
  copyright: {
    color: '#33393a',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: theme.spacing.xl,
    opacity: 0.8,
  },
});
