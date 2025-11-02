'use client';
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
export function Tabs({ tabs, initial=0 }:{
  tabs: { key:string; title:string; content: JSX.Element }[];
  initial?: number;
}) {
  const [idx, setIdx] = useState(initial);
  return (
    <View style={{ width:'100%' }}>
      <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
        {tabs.map((t, i)=>(
          <TouchableOpacity key={t.key} onPress={()=>setIdx(i)}
            style={{ backgroundColor: i===idx ? '#0ea5e9' : '#1f2937', paddingVertical:6, paddingHorizontal:12, borderRadius:999 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>{tabs[idx]?.content}</View>
    </View>
  );
}
