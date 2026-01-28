import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Image, useWindowDimensions, ActivityIndicator } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";
import { supabase } from "../lib/supabase";

export default function AboutPage() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load About Us banner from app_settings
    supabase.from('app_settings')
      .select('value')
      .eq('key', 'about_us_banner_url')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          setBannerUrl(data.value);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <Screen 
      contentStyle={styles.content}
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>About us</Text>
        
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>YourHomeChef</Text>

        {loading ? (
          <View style={[styles.heroImage, isMobile && styles.heroImageMobile, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E2E8F0' }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : bannerUrl ? (
          <Image 
            source={{ uri: bannerUrl }} 
            style={[styles.heroImage, isMobile && styles.heroImageMobile]}
            resizeMode="cover"
          />
        ) : (
          <Image 
            source={require('../assets/About us.png')} 
            style={[styles.heroImage, isMobile && styles.heroImageMobile]}
            resizeMode="contain"
          />
        )}

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange, isMobile && styles.headingMobile]}>Our Mission</Text>
          <Text style={styles.paragraph}>
            YourHomeChef connects passionate home cooks with people who appreciate authentic, handcrafted meals. We believe homemade food carries stories — of family, tradition, and culture — and our mission is to help those stories be shared within local communities.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What We Do</Text>
          <Text style={styles.paragraph}>
            YourHomeChef is a marketplace that helps independent home chefs share their food with nearby customers by providing tools to:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Showcase dishes with photos, ingredients, and allergen information</Text>
            <Text style={styles.listItem}>• Manage orders and pickups through secure online payments</Text>
            <Text style={styles.listItem}>• Reach people looking for genuine, homemade meals</Text>
          </View>
          <Text style={styles.paragraph}>
            For customers, we offer access to small-batch dishes you won’t find in restaurants — prepared by local cooks who love sharing their food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange]}>Our Values</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Authenticity</Text>{"\n"}
              Every dish reflects the chef's culture, heritage, and personal touch.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Transparency</Text>{"\n"}
              We provide clear information so customers can make informed choices. All food is prepared by independent chefs, who are responsible for preparation and safety.
            </Text>
            <Text style={styles.listItem}>
              <Text style={styles.bold}>Community</Text>{"\n"}
              Each order supports local talent and strengthens connections within neighbourhoods.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange]}>Join Us</Text>
          <Text style={styles.paragraph}>
            Whether you’re a cook ready to share your creations or someone searching for meals that taste like home, YourHomeChef is your place to discover, connect, and belong.
          </Text>
          <Text style={[styles.paragraph, styles.brandName]}>YourHomeChef</Text>
          <Text style={styles.paragraph}>Your marketplace for authentic homemade meals.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 0,
    marginBottom: 100,
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
    color: '#33393A',
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.02,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: '#33393A',
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
    color: '#33393A',
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
  headingOrange: {
    color: '#FE734C',
  },
  paragraph: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  list: {
    marginBottom: theme.spacing.md,
  },
  listItem: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  bold: {
    color: '#33393A',
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
    color: '#33393A',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: theme.spacing.xl,
    opacity: 0.8,
  },
});
