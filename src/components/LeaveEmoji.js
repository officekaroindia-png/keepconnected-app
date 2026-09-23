import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, withDelay,
} from 'react-native-reanimated';

// One Lottie character per available leave: 2 leaves → 2 happy chars, 1 → 1, 0/negative → single sad.
// Same default export + prop shape (quota, balance) as before so ActionsHomeScreen doesn't change.
// Cap at 4 rendered so the row still fits phone width; label still shows the true count if higher.

// Lazy-require lottie-react-native so a broken/missing native module can't crash the whole screen.
let LottieView = null;
let lottieError = null;
try {
  // eslint-disable-next-line global-require
  LottieView = require('lottie-react-native').default;
} catch (e) { lottieError = e; }

const HAPPY = require('../../assets/animations/happy.json');
const SAD   = require('../../assets/animations/sad.json');

// Base character size — was 150 originally, now 128 (~15% smaller per user request).
const BASE_SIZE = 128;
const MAX_HAPPY = 4;
const FIT_WIDTH = 300;
const GAP = 8;

const sizeFor = (count) => {
  if (count <= 1) return BASE_SIZE;
  const wide = count * BASE_SIZE + (count - 1) * GAP;
  if (wide <= FIT_WIDTH) return BASE_SIZE;
  return Math.floor((FIT_WIDTH - (count - 1) * GAP) / count);
};

// One character. Each carries its own breathing halo, delayed per-index so a row of 2-3
// doesn't pulse in perfect sync (looks robotic).
function Character({ source, size, delayMs, tint, glowColor }) {
  const [renderError, setRenderError] = useState(false);
  const canRender = !!LottieView && !renderError && !lottieError;

  const pulse = useSharedValue(0.85);
  useEffect(() => {
    pulse.value = withDelay(delayMs, withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.85, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ), -1, false,
    ));
  }, [delayMs]);
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.55 + (pulse.value - 0.85) * 1.2,
  }));

  return (
    <View style={[stage.wrap, { width: size, height: size }]}>
      <Animated.View style={[
        stage.halo,
        { width: size * 0.92, height: size * 0.92, borderRadius: size, backgroundColor: glowColor },
        glowStyle,
      ]} />
      {canRender ? (
        <LottieView
          source={source}
          autoPlay
          loop
          speed={1}
          resizeMode="contain"
          style={{ width: size, height: size, backgroundColor: 'transparent' }}
          onAnimationFailure={() => setRenderError(true)}
          {...(Platform.OS === 'android' ? { renderMode: 'HARDWARE' } : null)}
        />
      ) : (
        // Bulletproof fallback if lottie ever can't render — never crashes the dashboard.
        <View style={[stage.fallback, { width: size * 0.7, height: size * 0.7, borderRadius: size, borderColor: tint }]}>
          <Text style={[stage.fallbackTxt, { fontSize: size * 0.35, color: tint }]}>
            {source === HAPPY ? '✓' : '!'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function LeaveEmoji({ quota, balance, leaveAtRisk, blinkAnim }) {
  const bal = Number(balance);
  const isHappy = bal >= 1;

  // How many happy chars to draw. Sad state is always single.
  const count = isHappy ? Math.min(MAX_HAPPY, Math.max(1, Math.floor(bal))) : 1;
  const size = sizeFor(count);

  const mood = useMemo(() => (isHappy
    ? { src: HAPPY, tint: '#FDE68A', glow: 'rgba(253, 224, 71, 0.35)',
        label: bal === 1 ? '1 leave left' : `${count} leaves left${bal > MAX_HAPPY ? ` (${bal})` : ''}` }
    : { src: SAD, tint: '#FCA5A5', glow: 'rgba(239, 68, 68, 0.35)',
        label: bal === 0 ? 'No leaves left' : `${Math.abs(bal)} over quota` }
  ), [isHappy, bal, count]);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.row, { gap: GAP, height: size }]}>
        {Array.from({ length: count }).map((_, i) => (
          <Character
            // Keying by count+mood forces a clean remount when the balance shifts.
            key={`${isHappy ? 'h' : 's'}-${count}-${i}`}
            source={mood.src}
            size={size}
            delayMs={i * 220}
            tint={mood.tint}
            glowColor={mood.glow}
          />
        ))}
      </View>
      {leaveAtRisk && blinkAnim ? (
        <RNAnimated.Text style={[styles.label, { color: '#EF4444', opacity: blinkAnim }]}>{mood.label}</RNAnimated.Text>
      ) : (
        <Text style={[styles.label, { color: mood.tint }]}>{mood.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', marginTop: -4, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 4, textTransform: 'uppercase' },
});

const stage = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  fallback: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  fallbackTxt: { fontWeight: '900' },
});
