import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import DishCard from './DishCard'

const BROWSE_GRID_DISHES_PER_PAGE = 24

export type HomeBrowseGridSectionHandle = {
  onParentScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

type BrowseGridDish = Record<string, any>

const HomeBrowseGridSection = forwardRef<HomeBrowseGridSectionHandle, { dishGridColumns: number }>(
  function HomeBrowseGridSection({ dishGridColumns }, ref) {
    const { width } = useWindowDimensions()
    const isMobile = width < 768

    const [browseGridDishes, setBrowseGridDishes] = useState<BrowseGridDish[]>([])
    const [browseDishPage, setBrowseDishPage] = useState(0)
    const [hasMoreBrowseDishes, setHasMoreBrowseDishes] = useState(true)
    const [loadingBrowseGridInitial, setLoadingBrowseGridInitial] = useState(true)
    const [loadingMoreBrowseGrid, setLoadingMoreBrowseGrid] = useState(false)

    useEffect(() => {
      let cancelled = false
      ;(async () => {
        setLoadingBrowseGridInitial(true)
        try {
          const { data, error } = await supabase
            .from('dishes')
            .select(
              'id,name,description,price,image,rating,chef_id,created_at, chefs!inner(status, stripe_connect_completed, name, location, cuisine, latitude, longitude)'
            )
            .eq('chefs.status', 'active')
            .eq('chefs.stripe_connect_completed', true)
            .or('is_active.eq.true,is_active.is.null')
            .order('created_at', { ascending: false })
            .range(0, BROWSE_GRID_DISHES_PER_PAGE - 1)
          if (cancelled) return
          if (error) throw error
          const rows = (data ?? []) as BrowseGridDish[]
          setBrowseGridDishes(rows)
          setBrowseDishPage(0)
          setHasMoreBrowseDishes(rows.length >= BROWSE_GRID_DISHES_PER_PAGE)
        } catch (e) {
          console.error('[home] browse grid initial load:', e)
          if (!cancelled) {
            setBrowseGridDishes([])
            setHasMoreBrowseDishes(false)
          }
        } finally {
          if (!cancelled) setLoadingBrowseGridInitial(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [])

    const loadMoreBrowseGrid = useCallback(async () => {
      if (loadingMoreBrowseGrid || !hasMoreBrowseDishes || loadingBrowseGridInitial) return
      const nextPage = browseDishPage + 1
      const from = nextPage * BROWSE_GRID_DISHES_PER_PAGE
      const to = from + BROWSE_GRID_DISHES_PER_PAGE - 1
      setLoadingMoreBrowseGrid(true)
      try {
        const { data, error } = await supabase
          .from('dishes')
          .select(
            'id,name,description,price,image,rating,chef_id,created_at, chefs!inner(status, stripe_connect_completed, name, location, cuisine, latitude, longitude)'
          )
          .eq('chefs.status', 'active')
          .eq('chefs.stripe_connect_completed', true)
          .or('is_active.eq.true,is_active.is.null')
          .order('created_at', { ascending: false })
          .range(from, to)
        if (error) throw error
        const newDishes = (data ?? []) as BrowseGridDish[]
        setBrowseGridDishes((prev) => [...prev, ...newDishes])
        setBrowseDishPage(nextPage)
        setHasMoreBrowseDishes(newDishes.length >= BROWSE_GRID_DISHES_PER_PAGE)
      } catch (err) {
        console.error('[home] browse grid load more:', err)
      } finally {
        setLoadingMoreBrowseGrid(false)
      }
    }, [loadingMoreBrowseGrid, hasMoreBrowseDishes, loadingBrowseGridInitial, browseDishPage])

    const onParentScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!hasMoreBrowseDishes || loadingMoreBrowseGrid || loadingBrowseGridInitial) return
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
        const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
        if (distanceFromBottom < 600) {
          void loadMoreBrowseGrid()
        }
      },
      [hasMoreBrowseDishes, loadingMoreBrowseGrid, loadingBrowseGridInitial, loadMoreBrowseGrid]
    )

    useImperativeHandle(ref, () => ({ onParentScroll }), [onParentScroll])

    return (
      <View style={[styles.section, styles.homeBrowseGridSection]}>
        <View style={styles.homeBrowseGridHeader}>
          <Text
            style={[
              styles.sectionTitle,
              styles.homeSectionTitleSmaller,
              isMobile && styles.sectionTitleMobile,
              isMobile && styles.homeSectionTitleSmallerMobile,
              styles.homeBrowseGridHeadingText,
            ]}
            numberOfLines={2}
          >
            Explore dishes
          </Text>
          <Link href="/browse?tab=dishes" asChild>
            <TouchableOpacity style={styles.homeBrowseGridSeeAll}>
              <Text style={styles.homeBrowseGridSeeAllText}>See all</Text>
            </TouchableOpacity>
          </Link>
        </View>
        {loadingBrowseGridInitial ? (
          <View style={styles.homeBrowseGridLoading}>
            <ActivityIndicator size="large" color="#FE734C" />
          </View>
        ) : browseGridDishes.length === 0 ? (
          <Text style={styles.homeBrowseGridEmpty}>No dishes available right now.</Text>
        ) : (
          <>
            <View style={styles.homeBrowseGridOuter}>
              <View style={styles.homeBrowseGrid}>
                {browseGridDishes.map((dish) => (
                  <View
                    key={dish.id}
                    style={[styles.homeBrowseGridCardWrapper, { width: `${100 / dishGridColumns}%` }]}
                  >
                    <DishCard
                      dish={dish}
                      variant="explore"
                      inlinePriceRating
                      quantityOnImage
                      style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent' }}
                    />
                  </View>
                ))}
              </View>
            </View>
            {loadingMoreBrowseGrid && (
              <View style={styles.homeBrowseGridFooter}>
                <ActivityIndicator size="small" color="#FE734C" />
              </View>
            )}
          </>
        )}
      </View>
    )
  }
)

HomeBrowseGridSection.displayName = 'HomeBrowseGridSection'

export default HomeBrowseGridSection

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: '#333333',
    fontSize: Platform.select({
      web: 30,
      default: 22,
    }),
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: -0.015,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  homeSectionTitleSmaller: {
    fontSize: Platform.select({
      web: 24,
      default: 20,
    }),
    lineHeight: Platform.select({
      web: 30,
      default: 26,
    }),
  },
  homeSectionTitleSmallerMobile: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionTitleMobile: {
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
    paddingHorizontal: 0,
    fontWeight: theme.typography.fontWeight.bold,
  },
  homeBrowseGridSection: {
    marginBottom: theme.spacing.lg,
  },
  homeBrowseGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  homeBrowseGridHeadingText: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  homeBrowseGridSeeAll: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  homeBrowseGridSeeAllText: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600' as const,
  },
  homeBrowseGridLoading: {
    paddingVertical: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBrowseGridEmpty: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    color: '#555555',
    textAlign: 'center',
  },
  homeBrowseGridOuter: {
    paddingHorizontal: theme.spacing.md,
  },
  homeBrowseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -6,
  },
  homeBrowseGridCardWrapper: {
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  homeBrowseGridFooter: {
    width: '100%',
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
})
