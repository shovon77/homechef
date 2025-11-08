import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';

type Chef = { id: number | string; name: string | null; location?: string | null; photo?: string | null; };

export default function ChefsIndex() {
  const [rows, setRows] = useState<Chef[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('chefs').select('id,name,location,photo').order('id', { ascending: true }).limit(200);
      setRows((data as Chef[]) || []);
    })();
  }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.white, fontSize: 22, fontWeight: '900' }}>Chefs</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map(c => (
          <Link key={String(c.id)} href={`/chef/${c.id}`} asChild>
            <TouchableOpacity style={{ width: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#1f4f3f' }}>
              <Image source={{ uri: c.photo || 'https://placehold.co/320x200/111827/94a3b8?text=No+photo' }} style={{ width: '100%', height: 120 }} />
              <View style={{ padding: 10, gap: 4 }}>
                <Text style={{ color: theme.colors.white, fontWeight: '800' }} numberOfLines={1}>{c.name || 'Chef'}</Text>
                {c.location ? <Text style={{ color: theme.colors.secondary }}>{c.location}</Text> : null}
              </View>
            </TouchableOpacity>
          </Link>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
