import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Link } from "expo-router";
import { theme, cardStyle } from "../../lib/theme";
import { Stars } from "../../components/ui/Stars";
import { Button } from "../../components/ui/Button";
import { getDishAvgRating } from "../../utils/ratings";
import { useCart } from "../../context/CartContext";
import { toNumber, safeToFixed } from "../../lib/number";
import { formatCad } from "../../lib/money";

export default function DishCard({ dish, style, chefNameColor, ratingColor, priceColor }: { dish: any; style?: StyleProp<ViewStyle>; chefNameColor?: string; ratingColor?: string; priceColor?: string }) {
  const [avg, setAvg] = useState(0);
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const chefName = dish.chefs?.name || dish.chef;

  useEffect(() => {
    let m = true;
    getDishAvgRating(Number(dish.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [dish?.id]);

  return (
    <View style={[styles.card, cardStyle(), style]}>
      <Link href={`/dish/${dish.id}`} asChild>
        <TouchableOpacity activeOpacity={0.8} style={styles.imageContainer}>
          <Image
            source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
            style={styles.image}
          />
        </TouchableOpacity>
      </Link>
      <View style={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>{dish.name}</Text>
          {dish.description ? <Text style={styles.description} numberOfLines={2}>{dish.description}</Text> : null}
          {chefName && <Text style={[styles.chefName, chefNameColor ? { color: chefNameColor } : undefined]} numberOfLines={1}>by {chefName}</Text>}
          {avg > 0 && <View style={{ marginTop: 2 }}><Stars value={toNumber(avg, 0)} size={16} color={ratingColor} /></View>}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.price, priceColor ? { color: priceColor } : undefined]}>
            {formatCad(dish.price)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))} style={styles.quantityBtn}>
                <Text style={styles.quantityBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={styles.quantityBtn}>
                <Text style={styles.quantityBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Button
              title="Add"
              variant="primary"
              size="sm"
              onPress={() => {
                addToCart({
                  id: dish.id, name: dish.name, price: Number(dish.price || 0), quantity: quantity, image: dish.image, chef_id: dish.chef_id
                });
                setQuantity(1);
              }}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    overflow: "hidden",
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    color: '#FE734C',
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.base,
  },
  description: {
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 18,
  },
  chefName: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  price: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    marginTop: 0,
    minWidth: 60,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    height: 32,
  },
  quantityBtn: {
    width: 28,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
    minWidth: 20,
    textAlign: 'center',
    color: '#333',
  },
});
