import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function TermsPage() {
  return (
    <Screen 
      useScrollView 
      contentStyle={styles.content}
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Customer Terms of Service & Marketplace Disclosure</Text>
        <Text style={styles.lastUpdated}>Last Updated: February 2, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            By accessing or using YourHomeChef (the "Platform"), you ("Customer") agree to the following Terms of Service ("Terms"). If you do not agree, do not use the Platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>1. What the Platform Is (and Is Not)</Text>
          <Text style={styles.paragraph}>
            1.1 YourHomeChef is an online marketplace that connects customers with independent, third-party food preparers ("Chefs").
          </Text>
          <Text style={styles.paragraph}>
            1.2 The Platform does not prepare, cook, package, store, inspect, or deliver food and has no responsibility for food preparation or safety.
          </Text>
          <Text style={styles.paragraph}>
            1.3 Each Chef is solely responsible for:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Food preparation</Text>
            <Text style={styles.listItem}>• Ingredient sourcing</Text>
            <Text style={styles.listItem}>• Allergen disclosure</Text>
            <Text style={styles.listItem}>• Compliance with applicable food safety laws</Text>
          </View>
          <Text style={styles.paragraph}>
            1.4 The Platform's role is limited to facilitating listings, orders, payments, and pickup coordination. The Platform does not employ Chefs, does not control food preparation methods, and does not act as the seller of food items.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Ordering & Pickup</Text>
          <Text style={styles.paragraph}>
            2.1 Orders are placed through the Platform for food prepared by independent Chefs.
          </Text>
          <Text style={styles.paragraph}>
            2.2 Unless explicitly stated, orders are pickup-only at designated locations and time windows.
          </Text>
          <Text style={styles.paragraph}>
            2.3 Customers are responsible for:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Arriving within the pickup window</Text>
            <Text style={styles.listItem}>• Inspecting packaging upon pickup</Text>
            <Text style={styles.listItem}>• Proper food handling and storage after pickup</Text>
          </View>
          <Text style={styles.paragraph}>
            2.4 The Platform is not responsible for delays, missed pickups, or food conditions after the pickup window.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange]}>3. Food Safety Disclosure (Critical)</Text>
          <Text style={styles.paragraph}>
            3.1 Food is prepared by independent Chefs, not the Platform.
          </Text>
          <Text style={styles.paragraph}>
            3.2 The Platform does not routinely inspect or verify food safety certifications, documentation, kitchens, or preparation practices.
          </Text>
          <Text style={styles.paragraph}>
            3.3 Consumption of prepared food carries inherent risks, including foodborne illness, allergic reactions, and cross-contamination, particularly for:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Children</Text>
            <Text style={styles.listItem}>• Elderly individuals</Text>
            <Text style={styles.listItem}>• Pregnant individuals</Text>
            <Text style={styles.listItem}>• Immunocompromised persons</Text>
            <Text style={styles.listItem}>• Customers assume these risks when ordering</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>4. Allergens & Dietary Information</Text>
          <Text style={styles.paragraph}>
            4.1 Chefs provide ingredient and allergen information based on their own disclosures.
          </Text>
          <Text style={styles.paragraph}>
            4.2 Allergen and dietary disclosures are provided by the Chef only. Customers are responsible for verifying information before ordering.
          </Text>
          <Text style={styles.paragraph}>
            4.3 Customers with allergies or dietary restrictions must contact the Chef directly before ordering or refrain from ordering. Customers are encouraged to communicate directly with the Chef through the Platform's messaging tools where available.
          </Text>
          <Text style={styles.paragraph}>
            4.4 The Platform is not responsible for allergic reactions or dietary incompatibility.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>5. Health Concerns & Incident Reporting</Text>
          <Text style={styles.paragraph}>
            5.1 Customers must report any suspected food safety concern or illness within 24 hours of pickup.
          </Text>
          <Text style={styles.paragraph}>
            5.2 Reports should include:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Order reference number</Text>
            <Text style={styles.listItem}>• Description of symptoms</Text>
            <Text style={styles.listItem}>• Approximate time of consumption</Text>
          </View>
          <Text style={styles.paragraph}>
            5.3 The Platform may:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Temporarily suspend a Chef at its discretion for complaints or reported incidents</Text>
            <Text style={styles.listItem}>• Issue refunds or credits at its discretion</Text>
            <Text style={styles.listItem}>• Customers are encouraged to contact local Public Health authorities directly if necessary.</Text>
            <Text style={styles.listItem}>• The Platform is not responsible for reporting on behalf of customers.</Text>
            <Text style={styles.listItem}>• The Platform does not conduct medical, health, or regulatory investigations.</Text>
          </View>
          <Text style={styles.paragraph}>
            5.4 Refunds do not constitute an admission of fault or liability.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange]}>6. Payments, Fees & Refunds</Text>
          <Text style={styles.paragraph}>
            6.1 Payments made through the Platform are processed by third-party payment processors. Transactions are subject to the processor's own terms, conditions, and privacy practices. The Platform does not store full payment card information.
          </Text>
          <Text style={styles.paragraph}>
            6.2 In addition to the price set by the Chef for a meal, the Platform may charge Customers a platform service fee, which may be a fixed amount, a variable amount, or a combination of both, as disclosed at checkout prior to payment confirmation. Platform fees help support the operation, maintenance, and improvement of the Platform, including payment processing, customer support, and marketplace infrastructure.
          </Text>
          <Text style={styles.paragraph}>
            6.3 All applicable fees, including any platform service fees, will be clearly displayed to Customers before an order is finalized. By completing a purchase, Customers agree to pay the total amount shown at checkout.
          </Text>
          <Text style={styles.subHeading}>6.4 Refunds</Text>
          <Text style={styles.paragraph}>
            Refunds are discretionary, handled on a case-by-case basis, and are not guaranteed. Platform service fees may be non-refundable except where required by law or expressly stated otherwise. Refund eligibility may be limited where:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Pickup windows are missed</Text>
            <Text style={styles.listItem}>• No verified safety or quality issue is demonstrated</Text>
          </View>
          <Text style={styles.paragraph}>
            Issuing a refund does not constitute an admission of fault or liability by the Platform.
          </Text>
          <Text style={styles.subHeading}>6.5 Taxes</Text>
          <Text style={styles.paragraph}>
            Applicable taxes are calculated and collected at checkout. Tax treatment may vary depending on jurisdiction and applicable laws. The Platform facilitates tax collection as part of the transaction process.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>7. Platform Limitations & Disclaimer</Text>
          <Text style={styles.paragraph}>
            7.1 The Platform provides services on an "as is" and "as available" basis.
          </Text>
          <Text style={styles.paragraph}>
            7.2 To the fullest extent permitted by law, the Platform disclaims warranties regarding:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Quality of food</Text>
            <Text style={styles.listItem}>• Fitness for a particular purpose</Text>
            <Text style={styles.listItem}>• Non-interruption or error-free service</Text>
          </View>
          <Text style={styles.paragraph}>
            7.3 The Platform does not guarantee:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Food quality consistency</Text>
            <Text style={styles.listItem}>• Availability of specific Chefs or menu items</Text>
            <Text style={styles.listItem}>• Any particular health outcome</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, styles.headingOrange]}>8. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            8.1 To the maximum extent permitted by law, YourHomeChef shall not be liable for:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Foodborne illness</Text>
            <Text style={styles.listItem}>• Allergic reactions</Text>
            <Text style={styles.listItem}>• Injuries arising from food consumption</Text>
            <Text style={styles.listItem}>• Acts or omissions of Chefs</Text>
          </View>
          <Text style={styles.paragraph}>
            8.2 Nothing in these Terms limits liability where such limitation is prohibited by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>9. Customer Responsibilities</Text>
          <Text style={styles.paragraph}>
            Customers agree to:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Provide accurate information when ordering</Text>
            <Text style={styles.listItem}>• Review ingredient and allergen disclosures carefully</Text>
            <Text style={styles.listItem}>• Follow safe food-handling practices after pickup</Text>
            <Text style={styles.listItem}>• Use the Platform lawfully and respectfully</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>10. Suspension & Account Termination</Text>
          <Text style={styles.paragraph}>
            10.1 The Platform may suspend or terminate customer access for:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Abuse of refund policies</Text>
            <Text style={styles.listItem}>• False safety claims</Text>
            <Text style={styles.listItem}>• Harassment or misuse of the Platform</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>11. Privacy, Data Collection & Cookies - Privacy & Data Practices</Text>
          <Text style={styles.subHeading}>11.1 Privacy Policy</Text>
          <Text style={styles.paragraph}>
            Use of the Platform is subject to the Platform's Privacy Policy, which describes how personal information is collected, used, stored, and disclosed in connection with the Platform's services. By using the Platform, Customers consent to such collection and use in accordance with the Privacy Policy.
          </Text>
          <Text style={styles.subHeading}>11.2 Collected Information</Text>
          <Text style={styles.paragraph}>
            The Platform may collect personal information provided by Customers, including but not limited to account details, contact information, order information, and payment-related data. Payment information is processed by third-party payment processors and is not stored directly by the Platform.
          </Text>
          <Text style={styles.subHeading}>11.3 Third-Party Services</Text>
          <Text style={styles.paragraph}>
            The Platform may share limited information with third-party service providers, including payment processors, analytics providers, and infrastructure partners, solely for the purpose of operating and improving the Platform. Such third parties are governed by their own privacy practices.
          </Text>
          <Text style={styles.subHeading}>11.4 Cookies & Tracking Technologies</Text>
          <Text style={styles.paragraph}>
            The Platform uses cookies and similar technologies to enable core functionality, maintain user sessions, improve performance, and analyze usage. Customers may manage cookie preferences through their browser settings; however, disabling cookies may limit certain features of the Platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>12. Governing Law & Disputes</Text>
          <Text style={styles.paragraph}>
            12.1 These Terms are governed by the laws of the Province of Ontario, Canada.
          </Text>
          <Text style={styles.paragraph}>
            12.2 Any dispute shall be resolved exclusively in the courts of Ontario, unless otherwise required by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>13. Changes to Terms</Text>
          <Text style={styles.subHeading}>13.1 Updates</Text>
          <Text style={styles.paragraph}>
            The Platform may modify or update these Terms from time to time at its discretion.
          </Text>
          <Text style={styles.subHeading}>13.2 Notice of Changes</Text>
          <Text style={styles.paragraph}>
            Updated Terms will be made available on the Platform, and the "Last Updated" date will be revised accordingly. Continued access to or use of the Platform after such changes constitutes acceptance of the revised Terms.
          </Text>
          <Text style={styles.subHeading}>13.3 Entire Agreement</Text>
          <Text style={styles.paragraph}>
            These Terms constitute the entire agreement between the Customer and the Platform regarding use of the Platform.
          </Text>
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
    fontSize: 28, // Reduced slightly to fit long title
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 34,
    letterSpacing: -0.02,
    marginBottom: theme.spacing.sm,
  },
  lastUpdated: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: theme.spacing['2xl'],
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
  subHeading: {
    color: '#33393A',
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  paragraph: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.md,
  },
  list: {
    marginLeft: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  listItem: {
    color: '#33393A',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.xs,
  },
  bold: {
    fontWeight: theme.typography.fontWeight.bold,
  },
  headingOrange: {
    color: '#FE734C',
  },
});
