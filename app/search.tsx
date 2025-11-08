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
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 1200, alignSelf: "center", width: "100%" }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text }}>Search</Text>
      <View style={{ backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", paddingHorizontal: 14, paddingVertical: 10 }}>
        <TextInput placeholder="Search dishes or chefs…" placeholderTextColor={theme.colors.muted} value={q} onChangeText={setQ} style={{ fontSize: 16, color: theme.colors.text }} />
      </View>
      {rows.map((r:any)=>(
        <View key={String(r.id)} style={{ backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{r.name}</Text>
          <Text style={{ color: theme.colors.muted, fontSize: 14 }}>by {r.chef}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
