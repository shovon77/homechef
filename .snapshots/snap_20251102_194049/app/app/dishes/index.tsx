import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';

type Dish = { id: number | string; name: string | null; price: number | string | null; image?: string | null; thumbnail?: string | null; };

export default function DishesIndex() {
  const [rows, setRows] = useState<Dish[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('dishes').select('id,name,price,image,thumbnail').order('id', { ascending: true }).limit(200);
      setRows((data as Dish[]) || []);
    })();
  }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: '900' }}>Dishes</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map(d => (
          <Link key={String(d.id)} href={`/dish/${d.id}`} asChild>
            <TouchableOpacity style={{ width: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#1f4f3f' }}>
              <Image source={{ uri: d.thumbnail || d.image || 'https://placehold.co/320x200/111827/94a3b8?text=No+image' }} style={{ width: '100%', height: 110 }} />
              <View style={{ padding: 10, gap: 4 }}>
                <Text style={{ color: theme.colors.white, fontWeight: '800' }} numberOfLines={1}>{d.name || 'Dish'}</Text>
                <Text style={{ color: theme.colors.secondary }}>$ {Number(d.price ?? 0).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
