import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, FadeIn,
} from 'react-native-reanimated';
import { COLORS, SP, TYPE } from '../theme/theme';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch {}

const LOTTIE = {
  morning: safeRequire(() => require('../../assets/animations/morning.json')),
  sunday:  safeRequire(() => require('../../assets/animations/sunday.json')),
  lunch:   safeRequire(() => require('../../assets/animations/lunch.json')),
};
function safeRequire(fn) { try { return fn(); } catch { return null; } }

const EMOJI = { morning: '🌅', late: '🏃', lunch: '🍽️', sunday: '😴' };

// Rich mood gradients — deeper, more alive than a flat card.
const GRAD = {
  morning: ['#FDBA74', '#FB923C', '#F97316'],   // warm sunrise
  late:    ['#FCA5A5', '#F87171', '#EF4444'],   // urgent red
  lunch:   ['#FCD34D', '#FBBF24', '#F59E0B'],   // golden
  sunday:  ['#A5B4FC', '#818CF8', '#6366F1'],   // calm indigo
};

function AnimatedEmoji({ emoji, size = 96 }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(
      withTiming(-12, { duration: 600, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 600 }),
    ), -1, false);
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.Text style={[{ fontSize: size }, st]} allowFontScaling={false}>{emoji}</Animated.Text>;
}

export default function MomentHero({ moment, insetTop = 0, onDismiss, inline = false }) {
  const [lottieFailed, setLottieFailed] = useState(false);
  if (!moment) return null;

  const { type, line, animFile } = moment;
  const src = LOTTIE[animFile];
  const canLottie = !!LottieView && !!src && !lottieFailed;
  const grad = GRAD[type] || ['#818CF8', '#6366F1', '#4F46E5'];

  const animContent = (
    <>
      <View style={styles.animWrap}>
        {canLottie ? (
          <LottieView
            source={src}
            autoPlay
            loop
            resizeMode="contain"
            style={styles.lottie}
            onAnimationFailure={() => setLottieFailed(true)}
            {...(Platform.OS === 'android' ? { renderMode: 'HARDWARE' } : null)}
          />
        ) : (
          <AnimatedEmoji emoji={EMOJI[type] || '✨'} />
        )}
      </View>
      <Text style={[styles.line, inline && styles.lineInline]}>{line}</Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} style={[styles.close, inline && styles.closeInline]}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.9)" />
        </Pressable>
      )}
    </>
  );

  // inline=true: renders directly inside the header gradient — no wrapper card/gradient.
  if (inline) {
    return (
      <Animated.View entering={FadeIn.duration(400)} style={styles.inlineWrap}>
        {animContent}
      </Animated.View>
    );
  }

  // Default: full-width card with its own gradient — used by morning/lunch/late moments.
  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insetTop + SP.md }]}>
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />
        {animContent}
      </LinearGradient>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: SP.xl,
    paddingHorizontal: SP.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.12)' },
  blob1: { width: 200, height: 200, top: -60, right: -50 },
  blob2: { width: 140, height: 140, bottom: -40, left: -30, backgroundColor: 'rgba(255,255,255,0.08)' },
  close: {
    position: 'absolute', top: SP.md, right: SP.md, zIndex: 2,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  animWrap: {
    width: 240, height: 150, alignItems: 'center', justifyContent: 'center',
    marginTop: SP.sm,
  },
  lottie: { width: 240, height: 150, backgroundColor: 'transparent' },
  line: {
    ...TYPE.h2,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: SP.sm,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    paddingHorizontal: SP.md,
  },
  // Inline variant — sits inside the parent header, slightly smaller text, no bottom gap
  inlineWrap: {
    alignItems: 'center',
    paddingVertical: SP.sm,
    paddingHorizontal: SP.md,
  },
  lineInline: {
    fontSize: 17,
    marginTop: 4,
  },
  closeInline: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
