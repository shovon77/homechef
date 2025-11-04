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
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:12 }}>
        {tabs.map((t, i)=>(
          <TouchableOpacity
            key={t.key}
            onPress={()=>setIdx(i)}
            style={{
              backgroundColor: i===idx ? '#0ea5e9' : '#12301F',
              borderWidth:1,
              borderColor: i===idx ? '#0ea5e9' : '#1d4d35',
              paddingVertical:6,
              paddingHorizontal:12,
              borderRadius:999
            }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>{tabs[idx]?.content}</View>
    </View>
  );
}
