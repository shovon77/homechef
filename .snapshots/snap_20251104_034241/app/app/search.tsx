import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { theme } from "../constants/theme";

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setRows([]); return; }
      const lower = q.toLowerCase();
      const { data } = await supabase.from("dishes").select("id,name,chef").limit(50);
      setRows((data||[]).filter((d:any)=> (d.name||"").toLowerCase().includes(lower) || (d.chef||"").toLowerCase().includes(lower)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text }}>Search</Text>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F6", paddingHorizontal: 14, paddingVertical: 10 }}>
        <TextInput placeholder="Search dishes or chefs…" value={q} onChangeText={setQ} style={{ fontSize: 16, color: theme.colors.text }} />
      </View>
      {rows.map((r:any)=>(
        <Text key={String(r.id)} style={{ color: theme.colors.text }}>{r.name} — {r.chef}</Text>
      ))}
    </ScrollView>
  );
}
