import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { optimizeImageUrl } from '../../lib/dishImageUrl'
import { formatLocationAddress } from '../../lib/formatAddress'
import { chefFulfillmentLabel } from '../../lib/chef-fulfillment'

export type KitchenChef = {
  id: number
  name: string
  slug?: string | null
  photo?: string | null
  location?: string | null
  cuisine?: string | null
  fulfillment_mode?: string | null
}

export function kitchenHref(chef: Pick<KitchenChef, 'id' | 'slug'>): string {
  return `/chef/${chef.slug ?? chef.id}`
}

function kitchenCity(location: string | null | undefined): string {
  if (!location?.trim()) return ''
  const { city } = formatLocationAddress(location)
  return city || (location.includes(',') ? '' : location.trim())
}

// Some chefs store cuisine as a JSON array string, e.g. '["Asian Fusion","Bengali"]'.
function kitchenCuisine(cuisine: string | null | undefined): string {
  const raw = cuisine?.trim() ?? ''
  if (!raw.startsWith('[') && !raw.startsWith('"')) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).join(', ') : String(parsed)
  } catch {
    return raw
  }
}

function chefInitials(name: string): string {
  return (name.trim() || 'Chef')
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function KitchenAvatar({ chef, size }: { chef: KitchenChef; size: number }) {
  const [failed, setFailed] = useState(false)
  const uri = chef.photo?.trim() ? optimizeImageUrl(chef.photo.trim(), size * 3) : ''
  const box = { width: size, height: size, borderRadius: size / 2 }
  if (!uri || failed) {
    return (
      <View style={[styles.avatarFallback, box]}>
        <Text style={styles.avatarInitials}>{chefInitials(chef.name)}</Text>
      </View>
    )
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.avatar, box]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  )
}

/**
 * Chef identity row shown above a chef's dishes. On web it is sticky within its parent,
 * so wrap each chef's header + dishes in their own View for the hand-off between chefs.
 */
export default function KitchenHeader({
  chef,
  isMobile,
  style,
}: {
  chef: KitchenChef
  isMobile: boolean
  style?: StyleProp<ViewStyle>
}) {
  const href = kitchenHref(chef)
  const meta = [kitchenCuisine(chef.cuisine), kitchenCity(chef.location), chefFulfillmentLabel(chef.fulfillment_mode ?? '')]
    .filter(Boolean)
    .join(' · ')

  return (
    <View
      testID={`kitchen-header-${chef.id}`}
      style={[styles.header, Platform.OS === 'web' && stickyHeader, style]}
    >
      <Link href={href} asChild>
        <TouchableOpacity style={styles.identity} accessibilityRole="link" accessibilityLabel={`Visit ${chef.name}`}>
          <KitchenAvatar chef={chef} size={isMobile ? 44 : 52} />
          <View style={styles.text}>
            <Text style={[styles.name, isMobile && styles.nameMobile]} numberOfLines={1}>
              {chef.name}
            </Text>
            {!!meta && (
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Link>
      {!isMobile && (
        <Link href={href} asChild>
          <TouchableOpacity style={styles.viewButton} accessibilityRole="link">
            <Text style={styles.viewText}>View kitchen</Text>
            <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        </Link>
      )}
    </View>
  )
}

// RN types don't include 'sticky'; react-native-web passes it through.
const stickyHeader = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: '#F2F0EF',
  paddingVertical: 10,
  marginBottom: theme.spacing.md - 10,
} as unknown as ViewStyle

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 16,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#33393A',
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 19,
    lineHeight: 24,
  },
  nameMobile: {
    fontSize: 17,
    lineHeight: 22,
  },
  meta: {
    marginTop: 2,
    color: '#6B7070',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flexShrink: 0,
  },
  viewText: {
    color: theme.colors.primary,
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 14,
  },
})
