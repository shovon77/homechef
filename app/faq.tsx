import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

export default function FAQPage() {
  return (
    <Screen 
      contentStyle={styles.content}
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Food Safety FAQ</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>1. Who prepares the food?</Text>
          <Text style={styles.paragraph}>
            All meals are prepared by independent home chefs in their own personal kitchens. The Platform does not cook, inspect, or handle food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Are the chefs certified?</Text>
          <Text style={styles.paragraph}>
            Chefs on the Platform are independent individuals who may or may not hold food safety certifications. The Platform does not inspect, verify, or validate their kitchens, equipment, or training. Customers should evaluate each chef and meal before ordering.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>3. Are the meals safe to eat?</Text>
          <Text style={styles.paragraph}>
            All meals are prepared in private homes. Home-prepared food carries inherent risks, including potential allergens or foodborne illness. Customers should consider their own health needs and exercise independent judgment when ordering.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>4. How do I know if a meal contains allergens?</Text>
          <Text style={styles.paragraph}>
            Each chef provides an ingredient list and allergen information. Customers must read the details carefully before ordering. If you have doubts, contact the chef directly before ordering.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>5. Can I get a refund if I get sick or the food is bad?</Text>
          <Text style={styles.paragraph}>
            Refunds are handled case by case. Please report issues within 24 hours of pickup. Submitting photos, descriptions, and symptoms helps us evaluate your claim. Refunds do not imply the Platform is liable.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>6. Are meals delivered?</Text>
          <Text style={styles.paragraph}>
            Initially, meals are pickup-only at designated locations and times. You are responsible for picking up your meal on time and handling it safely afterward.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>7. What should I do after I pick up my meal?</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Check packaging for damage</Text>
            <Text style={styles.listItem}>• Store food at appropriate temperatures</Text>
            <Text style={styles.listItem}>• Consume within the recommended time</Text>
            <Text style={styles.listItem}>• Follow safe reheating or storage instructions</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>8. What happens if I have a complaint about a chef?</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Contact the Platform immediately via the support line or app</Text>
            <Text style={styles.listItem}>• Provide order reference, photos, and description</Text>
            <Text style={styles.listItem}>• The Platform may suspend or remove the chef pending investigation</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>9. Can I rely on the Platform for food safety?</Text>
          <Text style={styles.paragraph}>
            No. The Platform does not inspect kitchens, supervise food preparation, or verify safety practices. YourHomeChef is a neutral listing marketplace. Food safety and preparation practices are the sole responsibility of each chef.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>10. How do you handle emergencies or recalls?</Text>
          <Text style={styles.paragraph}>
            Customers may report issues directly through the Platform. The Platform may notify the chef and, when necessary, temporarily pause listings for that chef. Any health-related concerns should also be reported by customers directly to their local Public Health authority.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>11. Why do I have to accept these risks?</Text>
          <Text style={styles.paragraph}>
            Prepared food always carries some risk. By ordering, you acknowledge that you have read the disclosures and agree to assume responsibility for proper handling and consumption.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>12. Can I contact the chef directly?</Text>
          <Text style={styles.paragraph}>
            Yes. The Platform provides contact methods for questions about ingredients, allergies, or pickup instructions. For safety, all orders must still go through the Platform payment system.
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
    color: '#33393a',
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: 36 * 1.2,
    letterSpacing: -0.02,
    marginBottom: theme.spacing['2xl'],
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
  paragraph: {
    color: '#33393a',
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
    color: '#33393a',
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: theme.typography.fontSize.base * 1.6,
    marginBottom: theme.spacing.xs,
  },
});
