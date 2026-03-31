import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, Pressable, StyleSheet, ViewStyle, StyleProp, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { theme, cardStyle } from "../../lib/theme";
import { Button } from "../../components/ui/Button";
import { getDishAvgRating } from "../../utils/ratings";
import { useCart } from "../../context/CartContext";
import { safeToFixed } from "../../lib/number";
import { formatCad } from "../../lib/money";
import { optimizeDishImageUrl } from "../../lib/dishImageUrl";
import { prefetchDishWithChef } from "../../lib/db";

const PRIMARY_COLOR = '#FE734C';
const BRAND_BLACK = '#33393A';

type DishCardProps = {
  dish: any;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'explore' | 'homepage';
  /** When true (e.g. on chef detail page), show price and rating on same line */
  inlinePriceRating?: boolean;
  /** When true (e.g. on chef detail page), show quantity controls overlayed on bottom of image */
  quantityOnImage?: boolean;
};

export default function DishCard({ dish, style, variant = 'default', inlinePriceRating = false, quantityOnImage = false }: DishCardProps) {
  const router = useRouter();
  const inlineRating = typeof dish.rating === 'number' && dish.rating > 0 ? dish.rating : null;
  const [avg, setAvg] = useState(inlineRating ?? 0);
  const { addToCart, setQuantity: setCartQuantity, getQty } = useCart();
  const [quantity, setQuantity] = useState(1);
  const cartQty = getQty(dish.id);

  useEffect(() => {
    if (inlineRating != null) return;
    let m = true;
    getDishAvgRating(Number(dish.id)).then(v => m && setAvg(v));
    return () => { m = false; };
  }, [dish?.id, inlineRating]);

  const cardImageUri = optimizeDishImageUrl(
    dish.image ?? null,
    variant === 'homepage' ? 560 : 480
  );
  const imageEl = (
    <Link href={`/dish/${dish.id}`} asChild>
      <TouchableOpacity
        activeOpacity={0.8}
        style={variant === 'explore' ? styles.imageContainerExplore : styles.imageContainer}
        onPressIn={() => prefetchDishWithChef(Number(dish.id))}
      >
        <Image
          source={{ uri: cardImageUri }}
          style={styles.image}
        />
      </TouchableOpacity>
    </Link>
  );

  const nameEl = <Text style={styles.name} numberOfLines={1}>{dish.name}</Text>;
  const chefDisplayName = dish.chefs?.name || dish.chef || null;
  const chefNameEl = chefDisplayName ? (
    <Text style={styles.chefName} numberOfLines={1}>
      {chefDisplayName}
    </Text>
  ) : null;
  const ratingEl = avg > 0 && (
    <View style={styles.ratingRow}>
      <Image
        source={require('../../assets/star.png')}
        style={styles.starIconImage}
        tintColor={BRAND_BLACK}
        resizeMode="contain"
      />
      <Text style={styles.ratingText}>{safeToFixed(avg)}</Text>
    </View>
  );
  const footerEl = (
    <View style={styles.footer}>
      <Text style={styles.price}>
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
      <Text style={styles.price} numberOfLines={1}>
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

  if (variant === 'homepage') {
    return (
      <Pressable
        onPress={() => router.push(`/dish/${dish.id}`)}
        onPressIn={() => prefetchDishWithChef(Number(dish.id))}
        style={({ pressed }) => StyleSheet.flatten([styles.cardExplore, style, pressed && { opacity: 0.8 }])}
      >
        <View style={styles.imageContainerExplore}>
            <Image
              source={{ uri: cardImageUri }}
              style={styles.image}
            />
          </View>
          <View style={[styles.exploreContent, styles.exploreContentHomepage]}>
            <Text style={[styles.name, styles.nameExplore, styles.nameHomepage]} numberOfLines={1}>{dish.name || 'Dish'}</Text>
            <View style={styles.chefRatingPriceRowHomepage}>
              <View style={styles.chefNameLeftHomepage}>
                {chefDisplayName && (
                  <Text style={[styles.chefName, styles.homepageMetaText]} numberOfLines={1}>
                    {chefDisplayName}
                  </Text>
                )}
              </View>
              {avg > 0 ? (
                <View style={[styles.ratingRow, styles.ratingRowExplore, styles.ratingCenterHomepage]}>
                  <Image
                    source={require('../../assets/star.png')}
                    style={styles.homepageStarIcon}
                    tintColor={PRIMARY_COLOR}
                    resizeMode="contain"
                  />
                  <Text style={[styles.ratingText, styles.homepageMetaText]}>{safeToFixed(avg)}</Text>
                </View>
              ) : <View style={styles.ratingCenterHomepage} />}
              <View style={styles.priceRightHomepage}>
                <Text style={[styles.price, styles.homepageMetaText]} numberOfLines={1}>
                  {formatCad(Number(dish.price) ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
    );
  }

  const quantityControlsExplore = (
    <View style={[styles.quantityRowExplore, quantityOnImage && styles.quantityRowExploreOverlay]}>
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
          style={[styles.plusIconBtn, styles.plusIconBtnExplore, quantityOnImage && styles.quantityBtnOverlay]}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/add (1).png')}
            style={[styles.plusIconImage, quantityOnImage && styles.quantityIconOverlay]}
            tintColor={PRIMARY_COLOR}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setCartQuantity(dish.id, cartQty - 1)}
            style={[styles.quantityBtn, styles.quantityBtnExplore, quantityOnImage && styles.quantityBtnOverlay]}
          >
            <Image
              source={require('../../assets/minus.png')}
              style={[styles.quantityIconImage, quantityOnImage && styles.quantityIconOverlay]}
              tintColor={PRIMARY_COLOR}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={[styles.quantityNumberWrap, quantityOnImage && styles.quantityNumberOverlay]}>
            <Text style={[styles.quantityText, styles.quantityTextExplore, quantityOnImage && styles.quantityTextOverlay]}>{cartQty}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setCartQuantity(dish.id, cartQty + 1)}
            style={[styles.quantityBtn, styles.quantityBtnExplore, quantityOnImage && styles.quantityBtnOverlay]}
          >
            <Image
              source={require('../../assets/add (1).png')}
              style={[styles.quantityIconImage, quantityOnImage && styles.quantityIconOverlay]}
              tintColor={PRIMARY_COLOR}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (variant === 'explore') {
    const dishHref = `/dish/${dish.id}`;
    const prefetch = () => prefetchDishWithChef(Number(dish.id));

    const linkedImageLayer = (
      <View style={styles.imageContainerExplore}>
        <Image source={{ uri: cardImageUri }} style={styles.image} resizeMode="cover" />
      </View>
    );

    // Quantity controls sit OUTSIDE the Link (sibling overlay / below-card row) so +/− don't navigate on web.
    const imageBlock = quantityOnImage ? (
      <View style={styles.imageWrapperExplore}>
        <Link href={dishHref} asChild>
          <Pressable onPressIn={prefetch} style={StyleSheet.absoluteFillObject}>
            {linkedImageLayer}
          </Pressable>
        </Link>
        <View
          pointerEvents="box-none"
          style={[styles.quantityOverlayOnImage, cartQty === 0 && styles.quantityOverlayInitial]}
        >
          {cartQty === 0 ? (
            <TouchableOpacity
              onPress={() => addToCart({ id: dish.id, name: dish.name, price: Number(dish.price || 0), quantity: 1, image: dish.image, chef_id: dish.chef_id })}
              style={styles.plusInitialBtn}
              activeOpacity={0.7}
            >
              <Image source={require('../../assets/add (1).png')} style={styles.plusInitialIcon} tintColor={PRIMARY_COLOR} resizeMode="contain" />
            </TouchableOpacity>
          ) : (
            <View style={styles.quantityPillWrap}>{quantityControlsExplore}</View>
          )}
        </View>
      </View>
    ) : (
      <Link href={dishHref} asChild>
        <Pressable onPressIn={prefetch} style={{ width: '100%' }}>
          {linkedImageLayer}
        </Pressable>
      </Link>
    );

    const textBlock = (
      <View style={[styles.exploreContent, inlinePriceRating && styles.exploreContentTight]}>
        <Text style={[styles.name, styles.nameExplore, inlinePriceRating && styles.nameExploreTight]} numberOfLines={1}>{dish.name || 'Dish'}</Text>
        {(chefDisplayName || (avg > 0 && !inlinePriceRating)) && (
          <View style={styles.chefRatingRowExplore}>
            {chefDisplayName ? (
              <Text style={[styles.chefName, styles.chefNameExplore, styles.chefNameExploreFlex]} numberOfLines={1}>
                {chefDisplayName}
              </Text>
            ) : null}
            {avg > 0 && !inlinePriceRating && (
              <View style={[styles.ratingRow, styles.ratingRowExplore]}>
                <Image
                  source={require('../../assets/star.png')}
                  style={[styles.starIconImage, styles.starIconExplore]}
                  tintColor={PRIMARY_COLOR}
                  resizeMode="contain"
                />
                <Text style={[styles.ratingText, styles.ratingTextExplore]}>{safeToFixed(avg)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[inlinePriceRating ? styles.priceRatingRowExplore : styles.priceRowExplore, inlinePriceRating && styles.priceRatingRowExploreTight]}>
          <Text style={[styles.price, styles.priceExplore, inlinePriceRating && styles.priceInlineMatch]} numberOfLines={1}>
            {formatCad(Number(dish.price) ?? 0)}
          </Text>
          {inlinePriceRating && avg > 0 && (
            <View style={[styles.ratingRow, styles.ratingRowExplore]}>
              <Image
                source={require('../../assets/star.png')}
                style={[styles.starIconImage, styles.starIconExplore, inlinePriceRating && styles.starIconInlineMatch]}
                tintColor={PRIMARY_COLOR}
                resizeMode="contain"
              />
              <Text style={[styles.ratingText, styles.ratingTextExplore, inlinePriceRating && styles.ratingTextInlineMatch]}>{safeToFixed(avg)}</Text>
            </View>
          )}
        </View>
      </View>
    );

    return (
      <View style={[styles.cardExplore, style]}>
        {imageBlock}
        <Link href={dishHref} asChild>
          <Pressable
            onPressIn={prefetch}
            style={({ pressed }) => (pressed && Platform.OS !== 'web' ? { opacity: 0.92 } : null)}
          >
            {textBlock}
          </Pressable>
        </Link>
        {!quantityOnImage && (
          <View style={styles.exploreQuantityBelow}>
            <View style={styles.priceAndQuantityRowExplore}>{quantityControlsExplore}</View>
          </View>
        )}
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
    overflow: "hidden",
    flexDirection: 'column',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: theme.spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  exploreContent: {
    gap: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  exploreContentTight: {
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
  },
  exploreQuantityBelow: {
    width: '100%',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  exploreContentHomepage: {
    alignItems: 'stretch',
  },
  nameHomepage: {
    textAlign: 'left',
  },
  chefNameLeftHomepage: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  ratingCenterHomepage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRightHomepage: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chefRatingRowExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chefRatingRowExploreSpacing: {
    marginTop: 2,
  },
  priceRowExplore: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceRatingRowExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
    marginBottom: 0,
    minHeight: 20,
    flexShrink: 0,
  },
  priceRatingRowExploreTight: {
    marginTop: 1,
    minHeight: 0,
  },
  ratingPriceRowHomepage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  chefRatingPriceRowHomepage: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  homepageMetaText: {
    fontSize: 14,
    lineHeight: 18,
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
  },
  homepageStarIcon: {
    width: 12,
    height: 12,
  },
  priceAndQuantityRowExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 2,
    minHeight: 32,
  },
  quantityRowExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    minHeight: 32,
    flexShrink: 0,
    width: '100%',
  },
  quantityRowExploreLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  quantityRowExploreRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  imageContainerExplore: {
    width: '100%',
    aspectRatio: 1.1,
    borderRadius: 0,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  imageWrapperExplore: {
    width: '100%',
    aspectRatio: 1.1,
    position: 'relative',
    alignSelf: 'stretch',
  },
  quantityOverlayOnImage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quantityOverlayInitial: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  plusInitialBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusInitialIcon: {
    width: 16,
    height: 16,
  },
  quantityPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  quantityRowExploreOverlay: {
    justifyContent: 'center',
    width: 'auto',
    gap: 4,
    minHeight: 0,
  },
  quantityBtnOverlay: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  quantityIconOverlay: {
    width: 14,
    height: 14,
  },
  quantityNumberWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityNumberOverlay: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityTextOverlay: {
    color: BRAND_BLACK,
    flex: 0,
    minWidth: 0,
    textAlign: 'center',
    fontSize: 12,
  },
  quantityOverlaySpacer: {
    flex: 1,
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
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.display,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.base,
  },
  description: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 18,
  },
  chefName: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
  },
  nameExplore: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 2,
    color: BRAND_BLACK,
    minHeight: 18,
  },
  nameExploreTight: {
    marginBottom: 1,
  },
  chefNameExplore: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    marginRight: 0,
    color: BRAND_BLACK,
  },
  chefNameExploreFlex: {
    flex: 1,
    minWidth: 0,
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
  },
  starIconExplore: {
    width: 12,
    height: 12,
  },
  ratingText: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  ratingTextExplore: {
    fontSize: 10,
    color: BRAND_BLACK,
  },
  price: {
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
    fontSize: theme.typography.fontSize.lg,
  },
  priceExplore: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 0,
    color: BRAND_BLACK,
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: '400',
  },
  priceInlineMatch: {
    fontSize: 13,
    lineHeight: 18,
  },
  ratingTextInlineMatch: {
    fontSize: 13,
  },
  starIconInlineMatch: {
    width: 13,
    height: 13,
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
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  plusIconBtnExplore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  plusIconImage: {
    width: 20,
    height: 20,
  },
  quantityIconImage: {
    width: 20,
    height: 20,
  },
  plusIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  plusIconTextExplore: {
    fontSize: 14,
  },
  button: {
    marginTop: 0,
    minWidth: 60,
  },
  buttonNoShadow: {
    ...Platform.select({
      web: { boxShadow: 'none' as any },
      default: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      } as any,
    }),
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
    height: 32,
    gap: 2,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quantityBtnExplore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quantityBtnText: {
    fontSize: 20,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  quantityBtnTextExplore: {
    fontSize: 12,
  },
  quantityText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '400',
    paddingHorizontal: 4,
    minWidth: 20,
    textAlign: 'center',
    color: BRAND_BLACK,
  },
  quantityTextExplore: {
    fontSize: 13,
    lineHeight: 18,
    minWidth: 20,
    paddingHorizontal: 2,
    color: BRAND_BLACK,
    flex: 1,
    textAlign: 'center',
    fontWeight: '400',
  },
});
