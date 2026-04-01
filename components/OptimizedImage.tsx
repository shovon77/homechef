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

// Inject a single shared CSS @keyframes rule on web (runs on GPU, zero JS-thread cost).
const SHIMMER_CLASS = 'optimg-shimmer';
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById('optimg-shimmer-style')) {
    const sheet = document.createElement('style');
    sheet.id = 'optimg-shimmer-style';
    sheet.textContent = `@keyframes ${SHIMMER_CLASS}{0%,100%{opacity:.4}50%{opacity:1}}.${SHIMMER_CLASS}{animation:${SHIMMER_CLASS} 1.6s ease-in-out infinite}`;
    document.head.appendChild(sheet);
  }
}

/**
 * Image wrapper that:
 * - On web: uses a CSS-animated shimmer (GPU-composited, zero JS overhead even with 50+ instances)
 * - On native: uses Animated.loop (native driver)
 * - Adds `loading="lazy"` + `decoding="async"` on web
 * - Accepts explicit `width`/`height` for CLS prevention
 */
export default function OptimizedImage({ uri, style, width, height, resizeMode = 'cover', lazy = true }: Props) {
  const [loaded, setLoaded] = useState(false);

  const sizeStyle = width && height ? { width, height } : {};

  const webProps = Platform.OS === 'web'
    ? { loading: lazy ? 'lazy' : 'eager', decoding: 'async' } as any
    : {};

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrapper, style, sizeStyle]}>
        {!loaded && (
          <div className={SHIMMER_CLASS} style={cssPlaceholder} />
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

  // Native path: keep Animated.loop with useNativeDriver
  return (
    <NativeShimmerImage
      uri={uri}
      style={style}
      sizeStyle={sizeStyle}
      resizeMode={resizeMode}
      loaded={loaded}
      onLoad={() => setLoaded(true)}
    />
  );
}

// CSS-in-JS object for the web shimmer overlay (avoids StyleSheet for plain div)
const cssPlaceholder: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: SHIMMER_COLOR,
};

/** Native-only sub-component so Animated refs are never created on web. */
function NativeShimmerImage({ uri, style, sizeStyle, resizeMode, loaded, onLoad }: {
  uri: string;
  style: StyleProp<ImageStyle>;
  sizeStyle: Record<string, number>;
  resizeMode: 'cover' | 'contain' | 'stretch' | 'center';
  loaded: boolean;
  onLoad: () => void;
}) {
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

  return (
    <View style={[styles.wrapper, style, sizeStyle]}>
      {!loaded && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.placeholder, { opacity: pulseAnim }]} />
      )}
      <Image
        source={{ uri }}
        style={[styles.img, sizeStyle]}
        resizeMode={resizeMode}
        onLoad={onLoad}
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
