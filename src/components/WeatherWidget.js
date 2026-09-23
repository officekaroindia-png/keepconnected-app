import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { getWeather } from '../api/day';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch {}
const RAIN = (() => { try { return require('../../assets/animations/rain.json'); } catch { return null; } })();

// Emoji per condition for the non-rain cases (I create these lightweight animated ones).
const COND_EMOJI = {
  clear: '☀️', partly: '⛅', cloudy: '☁️', fog: '🌫️',
  drizzle: '🌦️', rain: '🌧️', snow: '❄️', storm: '⛈️',
};

function FloatEmoji({ emoji }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(
      withTiming(-4, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.Text style={[{ fontSize: 22 }, st]} allowFontScaling={false}>{emoji}</Animated.Text>;
}

export default function WeatherWidget() {
  const [w, setW] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { const data = await getWeather(); setW(data); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 10 * 60 * 1000); // refresh every 10 min
    return () => timer.current && clearInterval(timer.current);
  }, [load]);

  if (!w) return null; // no office location / disabled / not loaded yet

  const isRain = w.condition === 'rain' || w.condition === 'drizzle' || w.condition === 'storm';
  const canRainLottie = !!LottieView && !!RAIN && isRain;

  return (
    <View style={[styles.card, SHADOW.card]}>
      <View style={styles.animBox}>
        {canRainLottie ? (
          <LottieView source={RAIN} autoPlay loop resizeMode="contain" style={styles.lottie}
            {...(Platform.OS === 'android' ? { renderMode: 'HARDWARE' } : null)} />
        ) : (
          <FloatEmoji emoji={COND_EMOJI[w.condition] || '🌡️'} />
        )}
      </View>
      <View>
        <Text style={styles.temp}>{w.temp}°</Text>
        <Text style={styles.label}>{w.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: R.pill, paddingLeft: 6, paddingRight: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  animBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 34, height: 34 },
  temp: { fontSize: 16, fontWeight: '900', color: COLORS.white, fontVariant: ['tabular-nums'], lineHeight: 18 },
  label: { ...TYPE.cap, fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
});
