'use client';
import { View, Text, TouchableOpacity } from 'react-native';
export default function Rating({ value=0, outOf=5, size=16, onChange }:{
  value?: number; outOf?: number; size?: number; onChange?: (v:number)=>void;
}) {
  const full = Math.max(0, Math.min(outOf, Math.floor(value)));
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = outOf - full - half;
  const Star = ({ch, i, active}:{ch:string;i:number;active:boolean}) => (
    <TouchableOpacity key={i} disabled={!onChange} onPress={()=>onChange?.(i+1)}>
      <Text style={{ fontSize:size, lineHeight:size+2, color: active ? '#fbbf24' : '#64748b', marginRight:2 }}>{ch}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {Array.from({length:full}).map((_,i)=><Star ch="★" i={i} active />)}
      {half ? <Star ch="⯪" i={outOf+1} active /> : null}
      {Array.from({length:empty}).map((_,i)=><Star ch="☆" i={outOf+10+i} active={false} />)}
    </View>
  );
}
