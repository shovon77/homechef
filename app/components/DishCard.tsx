import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ViewStyle, StyleProp, Platform } from "react-native";
import { Link } from "expo-router";
import { theme, cardStyle } from "../../lib/theme";
import { Button } from "../../components/ui/Button";
import { getDishAvgRating } from "../../utils/ratings";
import { useCart } from "../../context/CartContext";
import { toNumber, safeToFixed } from "../../lib/number";
import { formatCad } from "../../lib/money";

type DishCardProps = {
  dish: any;
  style?: StyleProp<ViewStyle>;
  chefNameColor?: string;
  ratingColor?: string;
  priceColor?: string;
  variant?: 'default' | 'explore';
};

export default function DishCard({ dish, style, chefNameColor, ratingColor, priceColor, variant = 'default' }: DishCardProps) {
  const [avg, setAvg] = useState(0);
  const { addToCart, setQuantity: setCartQuantity, getQty } = useCart();
  const [quantity, setQuantity] = useState(1);
  const cartQty = getQty(dish.id);

  useEffect(() => {
    let m = true;
    getDishAvgRating(Number(dish.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [dish?.id]);

  const imageEl = (
    <Link href={`/dish/${dish.id}`} asChild>
      <TouchableOpacity activeOpacity={0.8} style={variant === 'explore' ? styles.imageContainerExplore : styles.imageContainer}>
        <Image
          source={{ uri: dish.image || "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop" }}
          style={styles.image}
        />
      </TouchableOpacity>
    </Link>
  );

  const nameEl = <Text style={styles.name} numberOfLines={1}>{dish.name}</Text>;
  const chefDisplayName = dish.chefs?.name || dish.chef || null;
  const chefNameEl = chefDisplayName ? (
    <Text style={[styles.chefName, chefNameColor ? { color: chefNameColor } : undefined]} numberOfLines={1}>
      {chefDisplayName}
    </Text>
  ) : null;
  const ratingEl = avg > 0 && (
    <View style={styles.ratingRow}>
      <Image
        source={require('../../assets/star.png')}
        style={[styles.starIconImage, ratingColor ? { tintColor: ratingColor } : undefined]}
        resizeMode="contain"
      />
      <Text style={styles.ratingText}>{safeToFixed(avg)}</Text>
    </View>
  );
  const footerEl = (
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
          style={[styles.button, styles.buttonNoShadow]}
        />
      </View>
    </View>
  );

  const footerExploreEl = (
    <View style={styles.footerExplore}>
      <Text style={[styles.price, priceColor ? { color: priceColor } : undefined]} numberOfLines={1}>
        {formatCad(dish.price)}
      </Text>
      <View style={styles.footerExploreRow}>
        {cartQty === 0 ? (
          <TouchableOpacity
            onPress={() => {
              addToCart({
                id: dish.id,
                name: dish.name,
                price: Number(dish.price || 0),
                quantity: 1,
                image: dish.image,
                chef_id: dish.chef_id,
              });
            }}
            style={styles.plusIconBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.plusIconText}>+</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityControl}>
            <TouchableOpacity
              onPress={() => setCartQuantity(dish.id, cartQty - 1)}
              style={styles.quantityBtn}
            >
              <Text style={styles.quantityBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{cartQty}</Text>
            <TouchableOpacity
              onPress={() => setCartQuantity(dish.id, cartQty + 1)}
              style={styles.quantityBtn}
            >
              <Text style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  if (variant === 'explore') {
    return (
      <View style={[styles.cardExplore, cardStyle(), style]}>
        {imageEl}
        <View style={styles.exploreContent}>
          <Text style={[styles.name, styles.nameExplore]} numberOfLines={1}>{dish.name}</Text>
          {chefDisplayName ? (
            <Text style={[styles.chefName, styles.chefNameExplore, chefNameColor ? { color: chefNameColor } : undefined]} numberOfLines={1}>
              {chefDisplayName}
            </Text>
          ) : null}
          {avg > 0 && (
            <View style={[styles.ratingRow, styles.ratingRowExplore]}>
              <Image
                source={require('../../assets/star.png')}
                style={[styles.starIconImage, styles.starIconExplore, ratingColor ? { tintColor: ratingColor } : undefined]}
                resizeMode="contain"
              />
              <Text style={[styles.ratingText, styles.ratingTextExplore]}>{safeToFixed(avg)}</Text>
            </View>
          )}
          <View style={[styles.footerExplore, styles.footerExploreCompact]}>
            <View style={styles.footerExplorePriceWrap}>
              <Text style={[styles.price, styles.priceExplore, priceColor ? { color: priceColor } : undefined]} numberOfLines={1}>
                {formatCad(dish.price)}
              </Text>
            </View>
            <View style={styles.footerExploreRight}>
              {cartQty === 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    addToCart({
                      id: dish.id,
                      name: dish.name,
                      price: Number(dish.price || 0),
                      quantity: 1,
                      image: dish.image,
                      chef_id: dish.chef_id,
                    });
                  }}
                  style={[styles.plusIconBtn, styles.plusIconBtnExplore]}
                  activeOpacity={0.7}
                >
                  <Image
                    source={require('../../assets/add (1).png')}
                    style={[styles.plusIconImage, { tintColor: '#FFFFFF' }]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <View style={[styles.quantityControl, styles.quantityControlExplore]}>
                  <TouchableOpacity
                    onPress={() => setCartQuantity(dish.id, cartQty - 1)}
                    style={[styles.quantityBtn, styles.quantityBtnExplore]}
                  >
                    <Image
                      source={require('../../assets/minus.png')}
                      style={[styles.quantityIconImage, { tintColor: '#FFFFFF' }]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                  <Text style={[styles.quantityText, styles.quantityTextExplore]}>{cartQty}</Text>
                  <TouchableOpacity
                    onPress={() => setCartQuantity(dish.id, cartQty + 1)}
                    style={[styles.quantityBtn, styles.quantityBtnExplore]}
                  >
                    <Image
                      source={require('../../assets/add (1).png')}
                      style={[styles.quantityIconImage, { tintColor: '#FFFFFF' }]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, cardStyle(), style]}>
      {imageEl}
      <View style={styles.content}>
        <View style={{ gap: 2 }}>
          {nameEl}
          {chefNameEl}
          {dish.description ? <Text style={styles.description} numberOfLines={2}>{dish.description}</Text> : null}
          {ratingEl}
        </View>
        {footerEl}
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
  cardExplore: {
    width: "100%",
    aspectRatio: 0.6,
    overflow: "hidden",
    flexDirection: 'column',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.sm,
    gap: 4,
  },
  exploreContent: {
    flex: 1,
    minHeight: 0,
    gap: 2,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  imageContainerExplore: {
    width: '100%',
    flex: 3,
    minHeight: 0,
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    alignSelf: 'stretch',
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
  nameExplore: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  chefNameExplore: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
    marginTop: 4,
  },
  ratingRowExplore: {
    marginTop: 0,
    gap: 2,
    alignSelf: 'center',
  },
  starIconImage: {
    width: 18,
    height: 18,
    tintColor: '#FFA500',
  },
  starIconExplore: {
    width: 12,
    height: 12,
  },
  ratingText: {
    color: '#555555',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  ratingTextExplore: {
    fontSize: 10,
    color: '#33393A',
  },
  price: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.lg,
  },
  priceExplore: {
    fontSize: 12,
    textAlign: 'center',
    alignSelf: 'center',
    flex: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 0,
    alignSelf: 'stretch',
  },
  footerExploreCompact: {
    marginTop: 0,
  },
  footerExplorePriceWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerExploreRight: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  footerExploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plusIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  plusIconBtnExplore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  plusIconImage: {
    width: 10,
    height: 10,
    tintColor: '#FFFFFF',
  },
  quantityIconImage: {
    width: 10,
    height: 10,
    tintColor: '#FFFFFF',
  },
  plusIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  plusIconTextExplore: {
    fontSize: 14,
  },
  button: {
    marginTop: 0,
    minWidth: 60,
  },
  buttonNoShadow: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? { boxShadow: 'none' } : {}),
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    height: 32,
    gap: 4,
  },
  quantityControlExplore: {
    height: 18,
    gap: 2,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FE734C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quantityBtnExplore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quantityBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quantityBtnTextExplore: {
    fontSize: 12,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
    minWidth: 20,
    textAlign: 'center',
    color: '#333',
  },
  quantityTextExplore: {
    fontSize: 11,
    minWidth: 14,
    paddingHorizontal: 2,
    color: '#33393A',
  },
});
