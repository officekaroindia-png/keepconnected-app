import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withRepeat, withSequence, Easing, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';

const { width } = Dimensions.get('window');

// Floating orb decoration
function Orb({ size, color, top, left, right, bottom, delay }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.8);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 800 }));
    scale.value   = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.94, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    ));
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, left, right, bottom }, st]} />
  );
}

// Feature pill
function Pill({ icon, text, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={styles.pill}>
      <View style={styles.pillIcon}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.pillTxt}>{text}</Text>
    </Animated.View>
  );
}

export default function WelcomeScreen({ onSignIn, onJoinTeam, onNewCompany }) {
  const insets = useSafeAreaInsets();

  // Logo animation
  const logoY     = useSharedValue(20);
  const logoOp    = useSharedValue(0);
  const ring1Rot  = useSharedValue(0);
  const ring2Rot  = useSharedValue(0);

  useEffect(() => {
    logoY.value  = withDelay(100, withTiming(0,   { duration: 700, easing: Easing.out(Easing.back(1.4)) }));
    logoOp.value = withDelay(100, withTiming(1,   { duration: 600 }));
    ring1Rot.value = withRepeat(withSequence(
      withTiming(8,  { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
    ), -1, true);
    ring2Rot.value = withRepeat(withSequence(
      withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      withTiming(10,  { duration: 2200, easing: Easing.inOut(Easing.ease) }),
    ), -1, true);
  }, []);

  const logoSt  = useAnimatedStyle(() => ({ opacity: logoOp.value, transform: [{ translateY: logoY.value }] }));
  const ring1St = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring1Rot.value}deg` }] }));
  const ring2St = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring2Rot.value}deg` }] }));

  return (
    <LinearGradient colors={['#0B1F3A', '#0F2D56', '#1D4ED8']} locations={[0, 0.55, 1]} style={styles.root}>
      {/* Background orbs */}
      <Orb size={260} color="rgba(37,99,235,0.18)"  top={-80}  left={-80}   delay={0} />
      <Orb size={180} color="rgba(245,158,11,0.10)" top={120}  right={-60}  delay={200} />
      <Orb size={140} color="rgba(37,99,235,0.12)"  bottom={180} left={-40} delay={400} />
      <Orb size={100} color="rgba(245,158,11,0.08)" bottom={80}  right={20}  delay={600} />

      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>

        {/* Logo + brand */}
        <Animated.View style={[styles.brand, logoSt]}>
          <View style={styles.logoWrap}>
            <Animated.View style={[styles.ring, styles.ring1, ring1St]} />
            <Animated.View style={[styles.ring, styles.ring2, ring2St]} />
          </View>
          <Text style={styles.brandName}>Keep Konnected</Text>
          <Text style={styles.brandSub}>Your team, perfectly in sync</Text>
        </Animated.View>

        {/* Feature pills */}
        <View style={styles.pills}>
          <Pill icon="time-outline"        text="Attendance tracking"   delay={400} />
          <Pill icon="people-outline"      text="Team management"       delay={500} />
          <Pill icon="stats-chart-outline" text="Salary & leaderboards" delay={600} />
        </View>

        {/* CTA buttons */}
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.buttons}>

          {/* Primary — Sign in */}
          <Pressable onPress={onSignIn} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.88 }]}>
            <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
            <Text style={styles.btnPrimaryTxt}>Sign in</Text>
          </Pressable>

          {/* Secondary — Join a team */}
          <Pressable onPress={onJoinTeam} style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.88 }]}>
            <Ionicons name="people-outline" size={20} color={COLORS.white} />
            <Text style={styles.btnSecondaryTxt}>Join a team</Text>
          </Pressable>

          {/* Ghost — Create company */}
          <Pressable onPress={onNewCompany} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.75 }]}>
            <Ionicons name="business-outline" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.btnGhostTxt}>Create a new company</Text>
          </Pressable>
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(900).duration(600)} style={styles.legal}>
          By continuing you agree to our Terms & Privacy Policy
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  inner:  { flex: 1, paddingHorizontal: SP.xl, justifyContent: 'space-between' },

  // Brand
  brand:      { alignItems: 'center', marginTop: 24 },
  logoWrap:   { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: SP.lg },
  ring:       { position: 'absolute', width: 52, height: 80, borderWidth: 6, borderRadius: 28 },
  ring1:      { borderColor: COLORS.white, marginRight: -14 },
  ring2:      { borderColor: COLORS.gold,  marginLeft:  -14 },
  brandName:  { fontSize: 30, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  brandSub:   { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 6, textAlign: 'center' },

  // Pills
  pills:     { gap: 10 },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: R.pill, paddingVertical: 13, paddingHorizontal: SP.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillIcon:  { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  pillTxt:   { ...TYPE.label, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },

  // Buttons
  buttons:        { gap: SP.md },
  btnPrimary:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: R.md, backgroundColor: COLORS.primary, ...SHADOW.lift },
  btnPrimaryTxt:  { fontSize: 17, fontWeight: '800', color: COLORS.white },
  btnSecondary:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnSecondaryTxt:{ fontSize: 17, fontWeight: '800', color: COLORS.white },
  btnGhost:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnGhostTxt:    { ...TYPE.label, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },

  legal: { textAlign: 'center', ...TYPE.cap, color: 'rgba(255,255,255,0.3)', lineHeight: 16 },
});
