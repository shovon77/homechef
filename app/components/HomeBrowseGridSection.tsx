import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import DishCard from './DishCard'
import KitchenHeader, { kitchenHref, type KitchenChef } from './KitchenHeader'

const DISHES_PER_KITCHEN_FETCH = 8

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
          const chefHref = kitchenHref(chef)
          const shown = dishes.slice(0, visiblePerKitchen)
          return (
            <View key={chef.id} style={[styles.kitchen, index > 0 && styles.kitchenDivider]}>
              <KitchenHeader chef={chef} isMobile={isMobile} style={styles.kitchenHeaderInset} />

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
  kitchenHeaderInset: {
    paddingHorizontal: theme.spacing.md,
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
