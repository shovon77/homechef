import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../constants/theme";
import StarRating from "./StarRating";
import { getChefAvgRating } from "../../utils/ratings";

export default function ChefCard({ chef }: { chef: any }) {
  const [avg, setAvg] = useState(0);
  const avatar = chef?.avatar || `https://i.pravatar.cc/300?u=chef-${chef?.id}`;

  useEffect(() => {
    let m = true;
    getChefAvgRating(Number(chef.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [chef?.id]);

  return (
    <View style={{
      width: "100%",
      maxWidth: 280,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 14, overflow: "hidden"
    }}>
      <Link href={`/chef/${chef.id}`} asChild>
        <TouchableOpacity activeOpacity={0.8} style={{ alignItems: "center", paddingTop: 12 }}>
          <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} />
        </TouchableOpacity>
      </Link>
      <View style={{ padding: 12, gap: 6 }}>
        <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 16 }}>{chef.name}</Text>
        {!!chef.location && <Text style={{ color: "#cbd5e1" }}>{chef.location}</Text>}
        <StarRating value={avg} readonly />
      </View>
    </View>
  );
}
