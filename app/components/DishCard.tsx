import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { theme } from "../../constants/theme";
import StarRating from "./StarRating";
import { getDishAvgRating } from "../../utils/ratings";
import { useCart } from "../../context/CartContext";

export default function DishCard({ dish }: { dish: any }) {
  const [avg, setAvg] = useState(0);
  const { addToCart } = useCart();

  useEffect(() => {
    let m = true;
    getDishAvgRating(Number(dish.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [dish?.id]);

  return (
    <View style={{
      width: "100%",
      maxWidth: 280,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 14, overflow: "hidden"
    }}>
      <Link href={`/dish/${dish.id}`} asChild>
        <TouchableOpacity activeOpacity={0.8}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={{ width: "100%", height: 150 }}
          />
        </TouchableOpacity>
      </Link>
      <View style={{ padding: 12, gap: 6 }}>
        <Text style={{ color: theme.colors.white, fontWeight: "800", fontSize: 16 }}>{dish.name}</Text>
        <StarRating value={avg} readonly />
        <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>
          ${Number(dish.price || 0).toFixed(2)}
        </Text>
        <TouchableOpacity
          onPress={() => addToCart({
            id: dish.id, name: dish.name, price: Number(dish.price||0), quantity: 1, image: dish.image
          })}
          style={{ backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 6 }}
        >
          <Text style={{ color: theme.colors.white, fontWeight: "800" }}>Add to cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
