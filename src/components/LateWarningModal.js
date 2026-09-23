import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SP, R, TYPE } from '../theme/theme';

const { width: SW } = Dimensions.get('window');

// level 1 = 10 days late, level 2 = 15, level 3 = 20
const LEVELS = {
  1: {
    icon: 'time-outline',
    iconColor: '#F59E0B',
    bg: ['#FEF3C7', '#FFFBEB'],
    border: '#FCD34D',
    badge: '#F59E0B',
    title: 'Hey, heads up! ⏰',
    lines: [
      "You've been late 10 times this month.",
      "Punctuality matters — your team counts on you.",
      "Try setting an earlier alarm tomorrow. You've got this! 💪",
    ],
  },
  2: {
    icon: 'warning-outline',
    iconColor: '#EF4444',
    bg: ['#FEE2E2', '#FFF5F5'],
    border: '#FCA5A5',
    badge: '#EF4444',
    title: 'Serious warning ⚠️',
    lines: [
      "You've been late 15 times this month — that's more than half the working days!",
      "This is affecting your leave balance and salary.",
      "Please make a strong effort to arrive on time. 🙏",
    ],
  },
  3: {
    icon: 'alert-circle',
    iconColor: '#DC2626',
    bg: ['#FECACA', '#FEE2E2'],
    border: '#EF4444',
    badge: '#DC2626',
    title: 'Critical Alert 🚨',
    lines: [
      "20 late days this month. This is a critical level!",
      "Your salary deductions are significant, and management has been notified.",
      "Please report to your supervisor and commit to punctuality immediately.",
    ],
  },
};

export default function LateWarningModal({ level, visible, onDismiss }) {
  const slideY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shake  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        // police-light-style shake for level 3
        if (level === 3) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(shake, { toValue: -6, duration: 80, easing: Easing.linear, useNativeDriver: true }),
              Animated.timing(shake, { toValue:  6, duration: 80, easing: Easing.linear, useNativeDriver: true }),
              Animated.timing(shake, { toValue:  0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
            ]),
            { iterations: 4 }
          ).start();
        }
      });
    } else {
      slideY.setValue(80);
      opacity.setValue(0);
      shake.setValue(0);
    }
  }, [visible, level]);

  if (!level || !LEVELS[level]) return null;
  const cfg = LEVELS[level];

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View style={[
          styles.card,
          { borderColor: cfg.border, transform: [{ translateY: slideY }, { translateX: shake }] },
        ]}>
          {/* Coloured top strip */}
          <View style={[styles.strip, { backgroundColor: cfg.badge }]} />

          {/* Icon badge */}
          <View style={[styles.iconWrap, { backgroundColor: cfg.badge + '22', borderColor: cfg.badge + '55' }]}>
            <Ionicons name={cfg.icon} size={36} color={cfg.iconColor} />
          </View>

          {/* Level pill */}
          <View style={[styles.levelPill, { backgroundColor: cfg.badge }]}>
            <Text style={styles.levelTxt}>LEVEL {level} WARNING</Text>
          </View>

          <Text style={styles.title}>{cfg.title}</Text>

          <View style={styles.linesWrap}>
            {cfg.lines.map((l, i) => (
              <View key={i} style={styles.lineRow}>
                <View style={[styles.bullet, { backgroundColor: cfg.badge }]} />
                <Text style={styles.line}>{l}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.btn, { backgroundColor: cfg.badge, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.btnTxt}>Got it, I'll be on time!</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SP.lg,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: R.xl,
    borderWidth: 1.5, width: '100%', maxWidth: 360,
    overflow: 'hidden', alignItems: 'center',
    paddingBottom: SP.xl,
  },
  strip: { height: 6, width: '100%', marginBottom: SP.lg },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: SP.md,
  },
  levelPill: {
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: R.pill,
    marginBottom: SP.md,
  },
  levelTxt: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.text, textAlign: 'center', paddingHorizontal: SP.lg, marginBottom: SP.md },
  linesWrap: { width: '100%', paddingHorizontal: SP.lg, gap: 10, marginBottom: SP.xl },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  line: { ...TYPE.body, color: COLORS.textSoft, flex: 1, lineHeight: 21 },
  btn: {
    marginHorizontal: SP.lg, borderRadius: R.pill,
    paddingVertical: 14, alignItems: 'center', width: '80%',
  },
  btnTxt: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});
