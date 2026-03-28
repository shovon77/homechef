'use client';
import React from 'react';
import { View, Text, Image, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../lib/theme';

const PRIMARY_COLOR = '#FE734C';
const BG_LIGHT = '#F2F0EF';
const TEXT_DARK = '#0e1b18';
const BORDER_LIGHT = '#E5E7EB';

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  /** `chef` = copy for applicants who just submitted a chef application */
  variant?: 'user' | 'chef';
}

export default function WelcomeModal({ visible, onClose, variant = 'user' }: WelcomeModalProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isChefVariant = variant === 'chef';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
          {isChefVariant ? (
            <View style={[styles.chefBrandRow, isMobile && styles.chefBrandRowMobile]} collapsable={false}>
              <Image
                source={require('../assets/YHC-New-Logo-Only.png')}
                style={[
                  styles.chefBrandLogo,
                  { width: isMobile ? 80 : 108, height: isMobile ? 56 : 74, minWidth: 40, minHeight: 28 },
                ]}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="YourHomeChef logo"
              />
              <Text style={styles.chefBrandName}>
                <Text style={styles.chefBrandNameYour}>Your</Text>
                <Text style={styles.chefBrandNameHomeChef}>HomeChef</Text>
              </Text>
            </View>
          ) : null}
          <View style={[styles.modalHeader, isChefVariant && styles.modalHeaderChef]}>
            <Text style={styles.modalTitle}>{isChefVariant ? 'Welcome, Chef!' : 'Welcome!'}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={!isMobile}
          >
            <Text style={styles.introText}>
              {isChefVariant
                ? "Here's how YourHomeChef works for you:"
                : "To keep things transparent, here's how we work:"}
            </Text>
            
            {isChefVariant ? (
              <>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Platform support:</Text> A small service fee helps payments, operations & support
                  </Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Pickup-only marketplace:</Text> You prepare meals, and customers collect directly
                  </Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Independent business:</Text> You run your own kitchen, not YourHomeChef
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Platform fees:</Text> A small service fee supports customer service, payments & operations
                  </Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Pickup-only marketplace:</Text> Orders are picked up directly from the chef. No courier or delivery fees apply for you.
                  </Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.bulletLabel}>Independent home chefs:</Text> All meals are prepared by independent home chefs, not YourHomeChef.
                  </Text>
                </View>
              </>
            )}
            
            <Text style={styles.footerText}>
              {isChefVariant
                ? 'All details & fees are shown before you list your menu.'
                : 'All details & fees are shown before you order.'}
            </Text>
          </ScrollView>
          
          <View style={[styles.modalFooter, isMobile && styles.modalFooterMobile]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.gotItButton, isMobile && styles.gotItButtonMobile]}
            >
              <Text style={styles.gotItButtonText} numberOfLines={1}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onClose();
                router.push('/terms');
              }}
              style={[styles.viewTermsButton, isMobile && styles.viewTermsButtonMobile]}
            >
              <Text style={styles.viewTermsButtonText} numberOfLines={1}>View full terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  /** Match `Footer` `brandContainer` / `brandLogo` / `brandName` — gap 0, negative margins so logo meets wordmark */
  chefBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    alignSelf: 'center',
    marginLeft: -12,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: BG_LIGHT,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: 'auto',
  },
  chefBrandRowMobile: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  chefBrandLogo: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginLeft: -8,
  },
  chefBrandName: {
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontSize: 24,
    lineHeight: 32,
    marginLeft: -12,
  },
  chefBrandNameYour: {
    color: '#33393A',
  },
  chefBrandNameHomeChef: {
    color: PRIMARY_COLOR,
  },
  modalHeaderChef: {
    paddingTop: 8,
  },
  modalContent: {
    backgroundColor: BG_LIGHT,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  modalContentMobile: {
    maxWidth: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.display,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: BORDER_LIGHT,
  },
  closeButtonText: {
    fontSize: 24,
    color: TEXT_DARK,
    fontWeight: '300',
    lineHeight: 24,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 24,
    gap: 16,
  },
  introText: {
    fontSize: 16,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 8,
  },
  bulletPoint: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 18,
    color: PRIMARY_COLOR,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily.body,
  },
  bulletLabel: {
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  footerText: {
    fontSize: 15,
    color: TEXT_DARK,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  modalFooterMobile: {
    padding: 16,
    gap: 10,
  },
  gotItButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  gotItButtonMobile: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  viewTermsButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  viewTermsButtonMobile: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  viewTermsButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    flexShrink: 0,
  },
});
