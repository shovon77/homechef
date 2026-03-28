import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/Screen';
import { theme } from '../lib/theme';
import { Stack } from 'expo-router';

/** Matches `NavBar` `BG_LIGHT`; extra bottom padding clears `Screen` footer `marginTop: -60` overlap without a large gap */
const NAV_BG = '#F2F0EF';
const FOOTER_CLEARANCE = 96;

export default function ParticipationAgreement() {
  return (
    <Screen style={{ backgroundColor: NAV_BG }}>
      <Stack.Screen options={{ title: 'Participation Agreement' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>PARTICIPATION AGREEMENT</Text>
        <Text style={styles.subtitle}>(Marketplace Platform – Ontario, Canada)</Text>
        
        <Text style={styles.p}>
          This Home Chef Participation Agreement (“Agreement”) is entered into as of [DATE], by and between: Your Home Chef Inc., a corporation incorporated under the laws of [Province/Federal], with its principal place of business at [Address] (“Platform”), and [CHEF LEGAL NAME], residing at [Address] (“Chef”).
          {"\n"}Together, the “Parties.”
        </Text>

        <Text style={styles.h2}>1. Purpose & Relationship of the Parties</Text>
        <Text style={styles.p}>1.1 The Platform operates an online marketplace that facilitates connections between independent food preparers (“Chefs”) and customers seeking prepared meals.</Text>
        <Text style={styles.p}>1.2 The Chef is an independent contractor and not an employee, partner, joint venturer, agent, or representative of the Platform.</Text>
        <Text style={styles.p}>1.3 The Platform does not prepare, cook, package, or handle food, and does not control the methods, ingredients, or preparation of food beyond general marketplace requirements for safety and compliance.</Text>

        <Text style={styles.h2}>2. Compliance With Laws & Food Safety</Text>
        <Text style={styles.p}>2.1 The Chef represents and warrants that they will comply at all times with all applicable federal, provincial, and municipal laws, regulations, and guidelines.</Text>
        <Text style={styles.p}>2.2 The Platform does not inspect, verify, or approve kitchens or food preparation methods. The Chef is solely responsible for the location, equipment, and preparation of food.</Text>
        <Text style={styles.p}>2.3 The Platform may suspend or terminate the Chef’s access immediately if it believes the Chef is operating in violation of any applicable law.</Text>

        <Text style={styles.h2}>3. Food Handler Certification</Text>
        <Text style={styles.p}>3.1 Chefs may or may not hold food safety certifications. The Platform does not verify or require certifications for listing meals.</Text>
        <Text style={styles.p}>3.2 The Chef acknowledges that compliance with local laws and safety practices is their responsibility.</Text>
        <Text style={styles.p}>3.3 Failure to follow applicable laws or unsafe practices may result in suspension or removal from the Platform.</Text>

        <Text style={styles.h2}>4. Kitchen & Preparation Requirements</Text>
        <Text style={styles.p}>4.1 The Chef is solely responsible for:</Text>
        <View style={styles.list}>
          <Text style={styles.li}>• Kitchen cleanliness</Text>
          <Text style={styles.li}>• Ingredient sourcing</Text>
          <Text style={styles.li}>• Allergen disclosure</Text>
          <Text style={styles.li}>• Packaging and labeling accuracy</Text>
        </View>
        <Text style={styles.p}>4.2 The Chef acknowledges that Platform approval does not constitute an inspection or endorsement of the Chef’s kitchen or food preparation standards.</Text>

        <Text style={styles.h2}>5. Quality, Safety & Incident Reporting</Text>
        <Text style={styles.p}>5.1 The Chef must immediately notify the Platform of:</Text>
        <View style={styles.list}>
          <Text style={styles.li}>• Any customer complaint related to food safety, illness, contamination, or allergens</Text>
          <Text style={styles.li}>• Any incident that may pose a risk to customer health or platform reputation</Text>
        </View>
        <Text style={styles.p}>5.2 The Platform reserves the right to:</Text>
        <View style={styles.list}>
          <Text style={styles.li}>• Temporarily suspend listings</Text>
          <Text style={styles.li}>• Remove the Chef from the Platform</Text>
          <Text style={styles.li}>• Require corrective action prior to reinstatement</Text>
        </View>

        <Text style={styles.h2}>6. Indemnification & Liability Allocation</Text>
        <Text style={styles.p}>6.1 Chef Indemnification.</Text>
        <Text style={styles.p}>To the fullest extent permitted by law, the Chef agrees to indemnify, defend, and hold harmless the Platform, its directors, officers, employees, contractors, and affiliates from and against any and all claims, demands, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising out of or related to (1) Foodborne illness, contamination, or injury caused by food prepared by the Chef (2) The Chef’s negligence, recklessness, or misconduct (3) The Chef’s failure to comply with applicable food safety or health regulations (4) Misrepresentation of ingredients, allergens, or preparation methods</Text>
        <Text style={styles.p}>6.2 The Chef acknowledges that this indemnification obligation survives termination of this Agreement.</Text>
        <Text style={styles.p}>6.3 The Platform does not waive any consumer rights under applicable law and does not limit liability where such limitation would be unlawful.</Text>

        <Text style={styles.h2}>7. Insurance (Optional)</Text>
        <Text style={styles.p}>7.1 The Platform may recommend that the Chef maintain product liability or commercial general liability insurance.</Text>
        <Text style={styles.p}>7.2 Proof of insurance may be requested at the Platform’s discretion.</Text>
        <Text style={styles.p}>7.3 Failure to maintain insurance will not automatically restrict access but may be considered in suspension or removal decisions.</Text>

        <Text style={styles.h2}>8. Payments & Fees</Text>
        <Text style={styles.p}>8.1 The Platform facilitates payment collection on behalf of the Chef, subject to applicable platform fees, service charges, and payment processor fees.</Text>
        <Text style={styles.p}>8.2 The Platform does not guarantee order volume or income.</Text>
        <Text style={styles.p}>8.3 Payouts may be subject to short holding periods to manage disputes, refunds, or fraud.</Text>

        <Text style={styles.h2}>9. Termination</Text>
        <Text style={styles.p}>9.1 Either Party may terminate this Agreement with [X] days’ written notice.</Text>
        <Text style={styles.p}>9.2 The Platform may terminate or suspend the Chef immediately, without notice, in cases of:</Text>
        <View style={styles.list}>
          <Text style={styles.li}>• Suspected food safety violations</Text>
          <Text style={styles.li}>• Customer health complaints</Text>
          <Text style={styles.li}>• Regulatory non-compliance</Text>
          <Text style={styles.li}>• Reputational risk to the Platform</Text>
        </View>
        <Text style={styles.p}>9.3 Upon termination, the Chef must cease using the Platform and remove references to affiliation.</Text>

        <Text style={styles.h2}>10. Confidentiality</Text>
        <Text style={styles.p}>10.1 The Chef agrees not to disclose non-public Platform information, including customer data, pricing algorithms, or operational materials.</Text>

        <Text style={styles.h2}>11. Governing Law</Text>
        <Text style={styles.p}>11.1 This Agreement shall be governed by and construed in accordance with the laws of the Province of Ontario, without regard to conflict of laws principles.</Text>

        <Text style={styles.h2}>12. Entire Agreement & Amendments</Text>
        <Text style={styles.p}>12.1 This Agreement constitutes the entire agreement between the Parties.</Text>
        <Text style={styles.p}>12.2 The Platform may update this Agreement upon written notice; continued use of the Platform constitutes acceptance.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: NAV_BG,
  },
  content: {
    padding: 24,
    paddingBottom: 24 + FOOTER_CLEARANCE,
    maxWidth: 800,
    alignSelf: 'center',
    gap: 16,
    backgroundColor: NAV_BG,
  },
  h1: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  h2: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  p: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 24,
  },
  list: {
    paddingLeft: 16,
    gap: 4,
  },
  li: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 24,
  },
});
