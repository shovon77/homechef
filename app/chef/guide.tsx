'use client';

import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter, Link } from 'expo-router';
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

type StepData = {
  number: number;
  title: string;
  body: string;
  tipText?: string;
  iconSource: any;
};

const SECTION_A: StepData[] = [
  {
    number: 1,
    title: 'Application submitted',
    body: 'Your application has been received. Our team reviews every application manually to ensure quality and safety for all users. Review typically takes 1\u20133 business days. You\u2019ll receive a notification once your application has been reviewed.',
    iconSource: require('../../assets/success.png'),
  },
  {
    number: 2,
    title: 'While you wait',
    body: 'You don\u2019t need to do anything while we review. In the meantime you can start thinking about your menu \u2014 dishes, pricing, and descriptions. Prepare a few food photos with bright, natural lighting, and make sure your pickup location is accurate.',
    iconSource: require('../../assets/idea.png'),
  },
  {
    number: 3,
    title: 'Application approved',
    body: 'Once approved, you\u2019ll receive a notification and get full access to your chef dashboard. Your next step is to set up Stripe so you can receive payments.',
    tipText: 'If your application needs changes, we\u2019ll let you know what to update.',
    iconSource: require('../../assets/star.png'),
  },
];

const SECTION_B: StepData[] = [
  {
    number: 4,
    title: 'Go to the Payment tab',
    body: 'In your chef dashboard, tap the Payment tab. You\u2019ll see a prompt to set up your Stripe Connect account. This is how you\u2019ll receive payouts for your orders.',
    iconSource: require('../../assets/credit-card.png'),
  },
  {
    number: 5,
    title: 'Complete Stripe onboarding',
    body: 'Tap \u201CSet up payouts\u201D to be redirected to Stripe\u2019s secure onboarding page. You\u2019ll need your legal name and date of birth, a bank account or debit card for payouts, and a brief business description.',
    tipText: 'This usually takes about 5 minutes. All information is handled securely by Stripe \u2014 we never see your banking details.',
    iconSource: require('../../assets/forward.png'),
  },
  {
    number: 6,
    title: 'You\u2019re ready to receive orders',
    body: 'Once Stripe verifies your information, your dashboard will show \u201CPayouts enabled.\u201D You can now accept orders and receive payments directly to your bank account.',
    tipText: 'Payouts from Stripe typically arrive in 2\u20133 business days after an order is completed.',
    iconSource: require('../../assets/success.png'),
  },
];

const SECTION_C: StepData[] = [
  {
    number: 7,
    title: 'You receive a new order',
    body: 'When a customer places an order, it appears in your Orders tab with status \u201CRequested.\u201D You\u2019ll see the customer\u2019s name, order items, pickup time, and total amount.',
    iconSource: require('../../assets/add.png'),
  },
  {
    number: 8,
    title: 'Accept or decline',
    body: 'Review the order details. Tap Accept to confirm you can prepare it, or Reject if you\u2019re unavailable. Payment is only captured when you accept.',
    tipText: 'Make sure Stripe Connect is set up before accepting your first order.',
    iconSource: require('../../assets/success.png'),
  },
  {
    number: 9,
    title: 'Prepare the food',
    body: 'Once accepted, the order moves to \u201CPending\u201D (In the kitchen). Prepare the dishes as described in the order. Check any chef notes from the customer for special requests.',
    iconSource: require('../../assets/notebook.png'),
  },
  {
    number: 10,
    title: 'Mark as ready',
    body: 'When the food is ready, tap \u201CMark as ready.\u201D The customer will receive a notification that their order is ready for pickup.',
    tipText: 'You can message the customer directly from the order if you need to coordinate pickup timing.',
    iconSource: require('../../assets/alarm.png'),
  },
  {
    number: 11,
    title: 'Customer picks up',
    body: 'The customer comes to your location to collect their order. Once picked up, the order is marked as completed and your earnings appear in the Payment section.',
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

function StepNumber({ n }: { n: number }) {
  return (
    <View style={stepStyles.circle}>
      <Text style={stepStyles.circleText}>{n}</Text>
    </View>
  );
}

function StepCard({ step }: { step: StepData }) {
  return (
    <View style={stepStyles.card}>
      <View style={stepStyles.headerRow}>
        <StepNumber n={step.number} />
        <Text style={stepStyles.title}>{step.title}</Text>
        <Image source={step.iconSource} style={stepStyles.icon} tintColor={PRIMARY_COLOR} resizeMode="contain" />
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

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={sectionStyles.header}>
      <View style={sectionStyles.line} />
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

export default function ChefGuide() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useRole();
  const loggedIn = !!user;

  return (
    <Screen style={{ backgroundColor: BG_PAGE }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG_PAGE }}
        contentContainerStyle={{
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          width: '100%',
          padding: isMobile ? 20 : 32,
          paddingBottom: 120,
        }}
      >
        {loggedIn && (
          <TouchableOpacity onPress={() => router.back()} style={pageStyles.backBtn}>
            <Image source={require('../../assets/previous.png')} style={pageStyles.backIcon} tintColor={PRIMARY_COLOR} resizeMode="contain" />
            <Text style={pageStyles.backText}>Back to Dashboard</Text>
          </TouchableOpacity>
        )}

        <Text style={[pageStyles.pageTitle, isMobile && pageStyles.pageTitleMobile]}>
          Getting started as a chef on YourHomeChef
        </Text>
        <Text style={pageStyles.pageSubtitle}>
          Everything you need to know {'\u2014'} from application to your first order
        </Text>

        <SectionHeader label="After you submit your application" />
        {SECTION_A.map(s => <StepCard key={s.number} step={s} />)}

        <SectionHeader label="Setting up Stripe Connect" />
        {SECTION_B.map(s => <StepCard key={s.number} step={s} />)}

        <SectionHeader label="How to manage your orders" />
        {SECTION_C.map(s => <StepCard key={s.number} step={s} />)}

        <SectionHeader label="Tips for success" />
        <View style={stepStyles.card}>
          {TIPS.map((tip, i) => (
            <View key={i} style={tipListStyles.row}>
              <View style={tipListStyles.bullet} />
              <Text style={tipListStyles.text}>{tip}</Text>
            </View>
          ))}
        </View>

        {loggedIn && (
          <Link href="/chef" asChild>
            <TouchableOpacity style={pageStyles.ctaBtn}>
              <Text style={pageStyles.ctaBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </Link>
        )}
      </ScrollView>
    </Screen>
  );
}

const pageStyles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backIcon: {
    width: 18,
    height: 18,
  },
  backText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600' as const,
    fontFamily: theme.typography.fontFamily.body,
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 32,
    fontWeight: '900' as const,
    fontFamily: theme.typography.fontFamily.display,
    lineHeight: 38,
    marginBottom: 8,
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
    marginBottom: 32,
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
    fontWeight: '700' as const,
    fontFamily: theme.typography.fontFamily.body,
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 36,
    marginBottom: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER_LIGHT,
  },
  label: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '700' as const,
    fontFamily: theme.typography.fontFamily.display,
    textAlign: 'center',
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
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800' as const,
    fontFamily: theme.typography.fontFamily.body,
  },
  icon: {
    width: 22,
    height: 22,
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
