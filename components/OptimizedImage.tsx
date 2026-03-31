import React, { useState } from 'react';
import { Image, View, StyleSheet, Platform, ImageStyle, StyleProp, Animated } from 'react-native';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** Reserve exact pixel dimensions on web for CLS prevention */
  width?: number;
  height?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** loading="lazy" on web (default true for cards, false for hero/above-fold) */
  lazy?: boolean;
};

const PLACEHOLDER_COLOR = '#FFFFFF';
const SHIMMER_COLOR = '#F5F2F0';

/**
 * Image wrapper that:
 * - Adds `loading="lazy"` + `decoding="async"` on web (off-loads decode from main thread)
 * - Shows a subtle pulse placeholder while loading
 * - Accepts explicit `width`/`height` for CLS prevention
 */
export default function OptimizedImage({ uri, style, width, height, resizeMode = 'cover', lazy = true }: Props) {
  const [loaded, setLoaded] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    if (loaded) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loaded, pulseAnim]);

  const webProps = Platform.OS === 'web'
    ? { loading: lazy ? 'lazy' : 'eager', decoding: 'async' } as any
    : {};

  const sizeStyle = width && height ? { width, height } : {};

  return (
    <View style={[styles.wrapper, style, sizeStyle]}>
      {!loaded && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.placeholder, { opacity: pulseAnim }]} />
      )}
      <Image
        source={{ uri }}
        style={[styles.img, sizeStyle]}
        resizeMode={resizeMode}
        onLoad={() => setLoaded(true)}
        {...webProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER_COLOR,
  },
  placeholder: {
    backgroundColor: SHIMMER_COLOR,
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
