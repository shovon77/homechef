import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { optimizeImageUrl } from '../../lib/dishImageUrl'
import { formatLocationAddress } from '../../lib/formatAddress'
import { chefFulfillmentLabel } from '../../lib/chef-fulfillment'
import DishCard from './DishCard'

const DISHES_PER_KITCHEN_FETCH = 8

type KitchenChef = {
  id: number
  name: string
  slug: string | null
  photo: string | null
  location: string | null
  cuisine: string | null
  fulfillment_mode: string | null
}

type KitchenGroup = {
  chef: KitchenChef
  dishes: Record<string, any>[]
  total: number
}

// Homepage-only: one block per featured chef, A–Z. /browse keeps the full catalogue.
async function fetchFeaturedKitchens(): Promise<KitchenGroup[]> {
  const { data: chefs, error } = await supabase
    .from('chefs')
    .select('id, name, slug, photo, location, cuisine, fulfillment_mode')
    .eq('featured', true)
    .eq('status', 'active')
    .eq('stripe_connect_completed', true)
    .order('name', { ascending: true })
  if (error) throw error

  const groups = await Promise.all(
    ((chefs ?? []) as KitchenChef[]).map(async (chef) => {
      const { data, count, error: dishError } = await supabase
        .from('dishes')
        .select(
          'id,name,description,price,image,rating,chef_id,created_at, chefs!inner(name, location, cuisine, latitude, longitude)',
          { count: 'exact' }
        )
        .eq('chef_id', chef.id)
        .or('is_active.eq.true,is_active.is.null')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(DISHES_PER_KITCHEN_FETCH)
      if (dishError) throw dishError
      const dishes = data ?? []
      return { chef, dishes, total: count ?? dishes.length }
    })
  )
  return groups.filter((g) => g.dishes.length > 0)
}

function kitchenCity(location: string | null): string {
  if (!location?.trim()) return ''
  const { city } = formatLocationAddress(location)
  return city || (location.includes(',') ? '' : location.trim())
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

function HomeBrowseGridSection({ dishGridColumns }: { dishGridColumns: number }) {
  const { width } = useWindowDimensions()
  const isMobile = width < 768
  // Two rows on tablet/desktop; three rows of two on phones.
  const visiblePerKitchen = isMobile ? 6 : Math.min(dishGridColumns * 2, DISHES_PER_KITCHEN_FETCH)

  const [groups, setGroups] = useState<KitchenGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchFeaturedKitchens()
      .then((rows) => {
        if (!cancelled) setGroups(rows)
      })
      .catch((e) => {
        console.error('[home] featured kitchens load:', e)
        if (!cancelled) setGroups([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}
          numberOfLines={1}
        >
          From our featured kitchens
        </Text>
        <Link href="/browse?tab=dishes" asChild>
          <TouchableOpacity
            style={styles.sectionArrowCircle}
            accessibilityRole="link"
            accessibilityLabel="View all dishes"
          >
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </Link>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <Text style={styles.empty}>No dishes available right now.</Text>
      ) : (
        groups.map(({ chef, dishes, total }, index) => {
          const chefHref = `/chef/${chef.slug ?? chef.id}`
          const shown = dishes.slice(0, visiblePerKitchen)
          const city = kitchenCity(chef.location)
          const meta = [chef.cuisine?.trim(), city, chefFulfillmentLabel(chef.fulfillment_mode ?? '')]
            .filter(Boolean)
            .join(' · ')
          return (
            <View key={chef.id} style={[styles.kitchen, index > 0 && styles.kitchenDivider]}>
              <View
                testID={`kitchen-header-${chef.id}`}
                style={[styles.kitchenHeader, Platform.OS === 'web' && stickyKitchenHeader]}
              >
                <Link href={chefHref} asChild>
                  <TouchableOpacity
                    style={styles.kitchenIdentity}
                    accessibilityRole="link"
                    accessibilityLabel={`Visit ${chef.name}`}
                  >
                    <KitchenAvatar chef={chef} size={isMobile ? 44 : 52} />
                    <View style={styles.kitchenText}>
                      <Text style={[styles.kitchenName, isMobile && styles.kitchenNameMobile]} numberOfLines={1}>
                        {chef.name}
                      </Text>
                      {!!meta && (
                        <Text style={styles.kitchenMeta} numberOfLines={1}>
                          {meta}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Link>
                {!isMobile && (
                  <Link href={chefHref} asChild>
                    <TouchableOpacity style={styles.viewKitchenButton} accessibilityRole="link">
                      <Text style={styles.viewKitchenText}>View kitchen</Text>
                      <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </Link>
                )}
              </View>

              <View style={styles.gridOuter}>
                <View style={styles.grid}>
                  {shown.map((dish) => (
                    <View key={dish.id} style={[styles.cardWrapper, { width: `${100 / dishGridColumns}%` }]}>
                      <DishCard
                        dish={dish}
                        variant="explore"
                        inlinePriceRating
                        quantityOnImage
                        hideChefName
                        style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent' }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {(total > shown.length || isMobile) && (
                <Link href={chefHref} asChild>
                  <TouchableOpacity style={styles.seeAllButton} accessibilityRole="link">
                    <Text style={styles.seeAllText} numberOfLines={1}>
                      {total > shown.length ? `See all ${total} dishes from ${chef.name}` : `Visit ${chef.name}`}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color={theme.colors.primary} />
                  </TouchableOpacity>
                </Link>
              )}
            </View>
          )
        })
      )}

      {!loading && groups.length > 0 && (
        <Link href="/browse?tab=chefs" asChild>
          <TouchableOpacity style={styles.browseChefsLink} accessibilityRole="link">
            <Text style={styles.browseChefsText}>Browse all chefs</Text>
            <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        </Link>
      )}
    </View>
  )
}

export default HomeBrowseGridSection

// Sticks within its kitchen block, so the next kitchen's header pushes it off-screen.
// RN types don't include 'sticky'; react-native-web passes it through.
const stickyKitchenHeader = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: '#F2F0EF',
  paddingVertical: 10,
  marginBottom: theme.spacing.md - 10,
} as unknown as ViewStyle

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.primary,
    fontFamily: 'OpenSans_300Light',
    fontWeight: '300',
    fontSize: Platform.select({ web: 24, default: 20 }),
    lineHeight: Platform.select({ web: 30, default: 26 }),
  },
  sectionTitleMobile: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  loading: {
    paddingVertical: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    color: '#555555',
    textAlign: 'center',
  },
  kitchen: {
    paddingBottom: theme.spacing.md,
  },
  kitchenDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 57, 58, 0.08)',
    paddingTop: theme.spacing.xl,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  kitchenIdentity: {
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
  kitchenText: {
    flex: 1,
    minWidth: 0,
  },
  kitchenName: {
    color: '#33393A',
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 19,
    lineHeight: 24,
  },
  kitchenNameMobile: {
    fontSize: 17,
    lineHeight: 22,
  },
  kitchenMeta: {
    marginTop: 2,
    color: '#6B7070',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  viewKitchenButton: {
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
  viewKitchenText: {
    color: theme.colors.primary,
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 14,
  },
  gridOuter: {
    paddingHorizontal: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -6,
  },
  cardWrapper: {
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '100%',
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(254, 115, 76, 0.35)',
  },
  browseChefsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  browseChefsText: {
    color: theme.colors.primary,
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  seeAllText: {
    flexShrink: 1,
    color: theme.colors.primary,
    fontFamily: 'OpenSans_600SemiBold',
    fontWeight: '600',
    fontSize: 14,
  },
})
