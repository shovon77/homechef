import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { theme, cardStyle } from "../../lib/theme";
import { Stars } from "../../components/ui/Stars";
import { Button } from "../../components/ui/Button";
import { getDishAvgRating } from "../../utils/ratings";
import { useCart } from "../../context/CartContext";
import { toNumber, safeToFixed } from "../../lib/number";
import { formatCad } from "../../lib/money";

export default function DishCard({ dish }: { dish: any }) {
  const [avg, setAvg] = useState(0);
  const { addToCart } = useCart();

  useEffect(() => {
    let m = true;
    getDishAvgRating(Number(dish.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [dish?.id]);

  return (
    <View style={[styles.card, cardStyle()]}>
      <Link href={`/dish/${dish.id}`} asChild>
        <TouchableOpacity activeOpacity={0.8}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={styles.image}
          />
        </TouchableOpacity>
      </Link>
      <View style={styles.content}>
        <Text style={styles.name}>{dish.name}</Text>
        <Stars value={toNumber(avg, 0)} size={16} />
        <Text style={styles.price}>
          {formatCad(dish.price)}
        </Text>
        <Button
          title="Add to cart"
          variant="primary"
          size="sm"
          onPress={() => addToCart({
            id: dish.id, name: dish.name, price: Number(dish.price||0), quantity: 1, image: dish.image, chef_id: dish.chef_id
          })}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 150,
    backgroundColor: theme.colors.surface,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  name: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.base,
  },
  price: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.lg,
  },
  button: {
    marginTop: theme.spacing.xs,
  },
});
