import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import DishCard from '../components/DishCard';
import ChefCard from '../components/ChefCard';

const PER_PAGE = 10;

type Dish = {
  id: number;
  name: string;
  price: number | null;
  image: string | null;
  chef_id: number | null;
};

type Chef = {
  id: number;
  name: string;
  location: string | null;
  photo: string | null;
  rating: number | null;
};

export default function BrowsePage() {
  const [tab, setTab] = useState<'dishes' | 'chefs'>('dishes');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PER_PAGE)), [total]);

  useEffect(() => {
    setPage(1);
    setTotal(0);
    setError(null);
    setDishes([]);
    setChefs([]);
  }, [tab, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        if (tab === 'dishes') {
          let request = supabase
            .from('dishes')
            .select('id,name,price,image,chef_id', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

          if (query.trim()) {
            const term = query.trim();
            request = request.or(`name.ilike.%${term}%,category.ilike.%${term}%`);
          }

          const { data, error, count } = await request;
          if (cancelled) return;
          if (error) throw error;
          setDishes(data ?? []);
          setTotal(count ?? (data?.length ?? 0));
        } else {
          let request = supabase
            .from('chefs')
            .select('id,name,location,photo,rating', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

          if (query.trim()) {
            const term = query.trim();
            request = request.or(`name.ilike.%${term}%,location.ilike.%${term}%`);
          }

          const { data, error, count } = await request;
          if (cancelled) return;
          if (error) throw error;
          setChefs(data ?? []);
          setTotal(count ?? (data?.length ?? 0));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('browse load error', err);
          setError(err?.message ?? 'Failed to load');
          setDishes([]);
          setChefs([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, page, query]);

  const go = (next: number) => {
    setPage(Math.max(1, Math.min(totalPages, next)));
  };

  const pages = useMemo(() => {
    const windowSize = 5;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + windowSize - 1);
    const normalizedStart = Math.max(1, end - windowSize + 1);
    const list: number[] = [];
    for (let i = normalizedStart; i <= end; i += 1) {
      list.push(i);
    }
    return list;
  }, [page, totalPages]);

  const showPagination = total > PER_PAGE;

  const renderPagination = () => (
    <View style={styles.pager}>
      <Pressable style={styles.pageBtn} disabled={page <= 1} onPress={() => go(page - 1)}>
        <Text style={[styles.pageBtnText, page <= 1 && styles.disabled]}>‹</Text>
      </Pressable>
      {pages.map((p) => (
        <Pressable
          key={p}
          style={[styles.pageNumber, p === page && styles.pageNumberActive]}
          onPress={() => go(p)}
        >
          <Text style={[styles.pageNumberText, p === page && styles.pageNumberTextActive]}>{p}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.pageBtn} disabled={page >= totalPages} onPress={() => go(page + 1)}>
        <Text style={[styles.pageBtnText, page >= totalPages && styles.disabled]}>›</Text>
      </Pressable>
    </View>
  );

  const list = tab === 'dishes' ? dishes : chefs;

  return (
    <Screen contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={styles.title}>Explore Meals Near You</Text>
        <Text style={styles.subtitle}>Find your next favorite homemade dish</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('dishes')}
          style={[styles.tab, tab === 'dishes' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'dishes' && styles.tabTextActive]}>Dishes</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('chefs')}
          style={[styles.tab, tab === 'chefs' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'chefs' && styles.tabTextActive]}>Chefs</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={tab === 'dishes' ? 'Search dishes…' : 'Search chefs…'}
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />

      {loading ? (
        <View style={styles.loader}><ActivityIndicator /></View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : list.length === 0 ? (
        <View style={styles.loader}><Text style={styles.subtitle}>No results found.</Text></View>
      ) : tab === 'dishes' ? (
        <View style={styles.grid}>
          {dishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {chefs.map((chef) => (
            <ChefCard key={chef.id} chef={{ ...chef, rating: typeof chef.rating === 'number' ? chef.rating : null }} />
          ))}
        </View>
      )}

      {showPagination && !loading && list.length > 0 && renderPagination()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'center',
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e2f5ee',
  },
  tabActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#065f46',
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  search: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    color: '#0f172a',
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  pager: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 24,
    gap: 8,
    alignItems: 'center',
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  pageBtnText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  disabled: {
    color: '#94a3b8',
  },
  pageNumber: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberActive: {
    backgroundColor: '#10b981',
  },
  pageNumberText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  pageNumberTextActive: {
    color: 'white',
  },
});
