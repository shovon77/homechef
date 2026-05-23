'use client';

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { useRole } from '../../hooks/useRole';

const PRIMARY_COLOR = '#FE734C';
const BG_PAGE = '#F2F0EF';
const BG_LIGHT = '#FFFFFF';
const TEXT_DARK = '#33393A';
const TEXT_MUTED = '#555555';
const BORDER_LIGHT = '#EAECF0';
const TIP_BG = '#FE734C10';
const CONTENT_MAX_WIDTH = 720;
/** Logged-in CTA sits above footer overlap (Screen footer marginTop: -60); keep enough inset when button is shown. */
const GUIDE_SCROLL_BOTTOM_PADDING_WITH_CTA = 120;
/** Guests / no CTA: small inset only; avoid flex:1 on ScrollView so content height isn’t stretched. */
const GUIDE_SCROLL_BOTTOM_PADDING_DEFAULT = 80;

type StepData = {
  title: string;
  body: string;
  tipText?: string;
  iconSource: any;
};

const SECTION_1: StepData[] = [
  {
    title: 'Sign up for an account',
    body: 'Create a free account on YourHomeChef. You can sign up with your email or Google account.',
    iconSource: require('../../assets/user.png'),
  },
  {
    title: 'Fill out the chef application',
    body: 'Go to the homepage \u2014 in the middle of the page you\u2019ll find a button that takes you to the chef application. Tell us about yourself \u2014 your name, cuisine style, location, and a short bio. Upload a profile photo so customers can get to know you. You\u2019ll set your preferred pickup times; customers can only choose from the times you make available. You can update your pickup availability anytime in your profile if your schedule changes.',
    tipText: 'Be detailed in your bio \u2014 customers love knowing the story behind the food.',
    iconSource: require('../../assets/edit.png'),
  },
  {
    title: 'Submit your application',
    body: 'Review your details and hit submit. You\u2019ll receive a confirmation notification that your application has been received. While our team reviews and approves your application, you can keep editing your menu as needed \u2014 add dishes, adjust prices, or update descriptions until you\u2019re happy with it.',
    tipText: 'Make sure your phone number is up to date in your profile so you receive SMS notifications for new orders and updates.',
    iconSource: require('../../assets/success.png'),
  },
];

const SECTION_2: StepData[] = [
  {
    title: 'Application under review',
    body: 'Our team reviews every application manually to ensure quality and safety. Review typically takes 1\u20133 business days. You\u2019ll receive a notification once it\u2019s been reviewed.',
    iconSource: require('../../assets/alarm.png'),
  },
  {
    title: 'While you wait',
    body: 'Start thinking about your menu \u2014 dishes, pricing, and descriptions. Prepare a few food photos with bright, natural lighting, and make sure your pickup location is accurate.',
    iconSource: require('../../assets/idea.png'),
  },
  {
    title: 'Application approved',
    body: 'Once approved, you\u2019ll receive a notification and get full access to your chef dashboard. Your next step is to set up Stripe so you can receive payments.',
    tipText: 'If your application needs changes, we\u2019ll let you know what to update.',
    iconSource: require('../../assets/star.png'),
  },
];

const SECTION_3: StepData[] = [
  {
    title: 'Go to the Stripe tab',
    body: 'In your chef dashboard, tap the Stripe tab. You\u2019ll see a prompt to set up your Stripe Connect account. This is how you\u2019ll receive payouts for your orders.',
    iconSource: require('../../assets/credit-card.png'),
  },
  {
    title: 'Complete Stripe onboarding',
    body: 'Tap \u201CSet up payouts\u201D to be redirected to Stripe\u2019s secure onboarding page. You\u2019ll need your legal name and date of birth, a bank account or debit card for payouts, and a brief business description.',
    tipText: 'This usually takes about 5 minutes. All information is handled securely by Stripe \u2014 we never see your banking details.',
    iconSource: require('../../assets/forward.png'),
  },
  {
    title: 'You\u2019re ready to receive orders',
    body: 'Once Stripe verifies your information, your dashboard will show \u201CPayouts enabled.\u201D You can now accept orders and receive payments directly to your bank account.',
    tipText: 'Payouts from Stripe typically arrive in 2\u20133 business days after an order is completed.',
    iconSource: require('../../assets/success.png'),
  },
];

const SECTION_4: StepData[] = [
  {
    title: 'You receive a new order',
    body: 'When a customer places an order, it appears in your Orders tab with status \u201CRequested.\u201D You\u2019ll see the customer\u2019s name, order items, pickup time, and total amount.',
    tipText: 'Keep your phone number updated in your profile to receive SMS notifications when new orders come in.',
    iconSource: require('../../assets/add.png'),
  },
  {
    title: 'Accept or decline',
    body: 'Review the order details. Tap Accept to confirm you can prepare it, or Reject if you\u2019re unavailable. Payment is only captured when you accept.',
    tipText: 'Make sure Stripe Connect is set up before accepting your first order.',
    iconSource: require('../../assets/success.png'),
  },
  {
    title: 'Prepare the food',
    body: 'Once accepted, the order moves to \u201CPending\u201D (In the kitchen). Prepare the dishes as described in the order. Check any chef notes from the customer for special requests.',
    iconSource: require('../../assets/notebook.png'),
  },
  {
    title: 'Mark as ready',
    body: 'When the food is ready, tap \u201CMark as ready.\u201D The customer will receive a notification that their order is ready for pickup.',
    tipText: 'You can message the customer directly from the order if you need to coordinate pickup timing.',
    iconSource: require('../../assets/alarm.png'),
  },
  {
    title: 'Customer picks up',
    body: 'The customer comes to your location to collect their order. Once picked up, the order is marked as completed and your earnings appear in the Stripe section.',
    iconSource: require('../../assets/shopping-cart.png'),
  },
];

const TIPS = [
  'Respond to new orders quickly \u2014 customers appreciate fast confirmation',
  'Keep your menu updated with accurate descriptions and photos',
  'Use chef notes to communicate any substitutions or extras',
  'Set up your Stripe account early so you\u2019re ready when your first order arrives',
  'Bright, well-lit food photos attract more customers',
];

function StepIcon({ source }: { source: any }) {
  return (
    <Image source={source} style={stepStyles.iconImg} tintColor={PRIMARY_COLOR} resizeMode="contain" />
  );
}

function StepCard({ step }: { step: StepData }) {
  return (
    <View style={stepStyles.card}>
      <View style={stepStyles.headerRow}>
        <StepIcon source={step.iconSource} />
        <Text style={stepStyles.title}>{step.title}</Text>
      </View>
      <Text style={stepStyles.body}>{step.body}</Text>
      {step.tipText && (
        <View style={stepStyles.tipBox}>
          <Text style={stepStyles.tipText}>{step.tipText}</Text>
        </View>
      )}
    </View>
  );
}

function CollapsibleSection({
  sectionId,
  title,
  expanded,
  onToggle,
  children,
}: {
  sectionId: number;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={accordionStyles.item}>
      <TouchableOpacity
        style={accordionStyles.headerBtn}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${sectionId}. ${title}`}
      >
        <Text style={[accordionStyles.sectionTitle, expanded && accordionStyles.sectionTitleExpanded]}>
          {sectionId}. {title}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={PRIMARY_COLOR}
        />
      </TouchableOpacity>
      {expanded && <View style={accordionStyles.body}>{children}</View>}
    </View>
  );
}

export default function ChefGuide() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useRole();
  const loggedIn = !!user;
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const toggleSection = (id: number) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const scrollBottomPadding = loggedIn
    ? GUIDE_SCROLL_BOTTOM_PADDING_WITH_CTA
    : GUIDE_SCROLL_BOTTOM_PADDING_DEFAULT;

  return (
    <Screen style={{ backgroundColor: BG_PAGE }}>
      {/* Single scroll is Screen’s outer ScrollView; avoid nesting ScrollView here or tall
          expanded sections get clipped by the flex viewport + footer overlap. */}
      <View
        style={[
          pageStyles.pageWrap,
          {
            padding: isMobile ? 20 : 32,
            paddingBottom: scrollBottomPadding,
          },
        ]}
      >
        <Text style={[pageStyles.pageTitle, isMobile && pageStyles.pageTitleMobile]}>
          Chef Guide
        </Text>
        <Text style={pageStyles.pageSubtitle}>
          From sign-up to your first sale
        </Text>

        <View style={accordionStyles.sectionsWrap}>
          <CollapsibleSection
            sectionId={1}
            title="Submitting your application"
            expanded={expandedSection === 1}
            onToggle={() => toggleSection(1)}
          >
            {SECTION_1.map((s, i) => (
              <StepCard key={`s1-${i}`} step={s} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            sectionId={2}
            title="After you submit"
            expanded={expandedSection === 2}
            onToggle={() => toggleSection(2)}
          >
            {SECTION_2.map((s, i) => (
              <StepCard key={`s2-${i}`} step={s} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            sectionId={3}
            title="Setting up Stripe Connect"
            expanded={expandedSection === 3}
            onToggle={() => toggleSection(3)}
          >
            {SECTION_3.map((s, i) => (
              <StepCard key={`s3-${i}`} step={s} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            sectionId={4}
            title="Managing your orders"
            expanded={expandedSection === 4}
            onToggle={() => toggleSection(4)}
          >
            {SECTION_4.map((s, i) => (
              <StepCard key={`s4-${i}`} step={s} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            sectionId={5}
            title="Tips for success"
            expanded={expandedSection === 5}
            onToggle={() => toggleSection(5)}
          >
            <View style={stepStyles.card}>
              {TIPS.map((tip, i) => (
                <View key={i} style={tipListStyles.row}>
                  <View style={tipListStyles.bullet} />
                  <Text style={tipListStyles.text}>{tip}</Text>
                </View>
              ))}
            </View>
          </CollapsibleSection>
        </View>

        {loggedIn && (
          <Link href="/chef" asChild>
            <TouchableOpacity style={pageStyles.ctaBtn}>
              <Text style={pageStyles.ctaBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>
    </Screen>
  );
}

const pageStyles = StyleSheet.create({
  pageWrap: {
    backgroundColor: BG_PAGE,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 32,
    fontWeight: '900' as const,
    fontFamily: theme.typography.fontFamily.display,
    lineHeight: 38,
    marginBottom: 6,
  },
  pageTitleMobile: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageSubtitle: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 24,
    marginBottom: 24,
  },
  ctaBtn: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 32,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400' as const,
    fontFamily: theme.typography.fontFamily.body,
  },
});

const accordionStyles = StyleSheet.create({
  sectionsWrap: {
    marginTop: 12,
  },
  item: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    width: '100%',
  },
  sectionTitle: {
    flex: 1,
    paddingRight: theme.spacing.md,
    color: TEXT_DARK,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 20 * 1.4,
  },
  sectionTitleExpanded: {
    color: PRIMARY_COLOR,
  },
  body: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
});

const stepStyles = StyleSheet.create({
  card: {
    backgroundColor: BG_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    padding: 24,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconImg: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '800' as const,
    fontFamily: theme.typography.fontFamily.display,
  },
  body: {
    color: TEXT_MUTED,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: TIP_BG,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  tipText: {
    color: TEXT_DARK,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
});

const tipListStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
    marginTop: 7,
  },
  text: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 22,
  },
});
