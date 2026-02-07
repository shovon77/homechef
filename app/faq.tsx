import React, { useState } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { theme } from "../lib/theme";

const faqData = [
  {
    question: "1. Who prepares the food?",
    answer: "All meals are prepared by independent home chefs in their personal kitchens. The Platform does not cook, inspect, store, or handle food.",
  },
  {
    question: "2. Are the chefs certified?",
    answer: "Chefs are independent individuals who may or may not hold food safety certifications. The Platform does not routinely inspect or verify kitchens, equipment, or training. Customers should review chef listings and make informed choices before ordering.",
  },
  {
    question: "3. Are the meals safe to eat?",
    answer: "Meals are prepared in private homes. Home-prepared food carries inherent risks, including potential allergens or foodborne illness. Customers should consider their personal health needs and use independent judgment when ordering.",
  },
  {
    question: "4. How do I know if a meal contains allergens?",
    answer: "Each chef provides ingredient and allergen information for their dishes. Customers must review these details carefully. If unsure, contact the chef before ordering.",
  },
  {
    question: "5. Can I get a refund if I get sick or the food is bad?",
    answer: "Refunds are discretionary and handled case by case. Issues must be reported within 24 hours of pickup. Supporting details (photos, descriptions, symptoms) help us review the request. Refunds do not imply Platform responsibility or liability.",
  },
  {
    question: "6. Are meals delivered?",
    answer: "No. Meals are pickup-only at designated locations and time windows. Customers are responsible for arriving on time and handling food safely after pickup.",
  },
  {
    question: "7. What should I do after I pick up my meal?",
    answer: "Customers are responsible for safe food handling, including:",
    hasList: true,
    listItems: [
      "Inspecting packaging for damage",
      "Storing food at appropriate temperatures",
      "Consuming food within a reasonable time",
      "Following safe reheating and storage practices",
    ],
  },
  {
    question: "8. What happens if I have a complaint about a chef?",
    answer: "Contact the Platform through the app or support channel and provide:",
    hasList: true,
    listItems: [
      "Order reference number",
      "Photos (if applicable)",
      "A brief description of the issue",
    ],
    additionalText: "The Platform may temporarily suspend or remove a chef while reviewing the concern.",
  },
  {
    question: "9. Can I rely on the Platform for food safety?",
    answer: "No. YourHomeChef is a neutral marketplace. The Platform does not supervise food preparation, inspect kitchens, or guarantee food safety. All responsibility for preparation and safety rests with the chef.",
  },
  {
    question: "10. How do you handle emergencies or recalls?",
    answer: "Customers may report issues through the Platform. We may notify the chef and pause listings if necessary. For health-related concerns, customers should also contact their local Public Health authority directly.",
  },
  {
    question: "11. Why do I have to accept these risks?",
    answer: "All prepared food carries some level of risk. By ordering, you acknowledge these disclosures and accept responsibility for proper handling and consumption.",
  },
  {
    question: "12. Can I contact the chef directly?",
    answer: "Yes. The Platform provides secure messaging tools for questions about ingredients, allergies, or pickup details. All payments and orders must still be completed through the Platform.",
  },
];

export default function FAQPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <Screen 
      contentStyle={styles.content}
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Frequently asked questions</Text>

        {faqData.map((faq, index) => (
          <View key={index} style={styles.accordionItem}>
            <TouchableOpacity
              style={styles.questionButton}
              onPress={() => handleToggle(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.questionText, { color: expandedIndex === index ? '#FE734C' : '#33393A' }]}>{faq.question}</Text>
              <Ionicons
                name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                size={24}
                color="#FE734C"
              />
            </TouchableOpacity>
            {expandedIndex === index && (
              <View style={styles.answerContainer}>
                <Text style={styles.paragraph}>{faq.answer}</Text>
                {faq.hasList && faq.listItems && (
                  <View style={styles.list}>
                    {faq.listItems.map((item, itemIndex) => (
                      <Text key={itemIndex} style={styles.listItem}>• {item}</Text>
                    ))}
                  </View>
                )}
                {faq.additionalText && (
                  <Text style={styles.paragraph}>{faq.additionalText}</Text>
                )}
              </View>
            )}
          </View>
        ))}
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
    color: '#FE734C',
    fontSize: Platform.select({ web: 24, default: 14 }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.black,
    lineHeight: Platform.select({ web: 24 * 1.2, default: 18 }),
    letterSpacing: -0.02,
    marginBottom: theme.spacing['2xl'],
  },
  accordionItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    width: '100%',
  },
  questionText: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 20 * 1.4,
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  answerContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
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
});
