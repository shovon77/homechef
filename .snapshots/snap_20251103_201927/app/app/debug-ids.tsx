import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
export default function DebugIDs() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("dishes").select("id,name").order("id").limit(50);
      if (error) setErr(error.message); else setRows(data || []);
    })();
  }, []);
  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontWeight: "900", fontSize: 18, marginBottom: 10 }}>Visible dish IDs</Text>
      {err ? <Text style={{ color: "red" }}>{err}</Text> : rows.map(r => (
        <Text key={String(r.id)}>{String(r.id)} — {r.name}</Text>
      ))}
    </ScrollView>
  );
}
