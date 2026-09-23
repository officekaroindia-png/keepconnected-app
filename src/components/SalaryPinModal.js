import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { salaryPinStatus, setSalaryPin, verifySalaryPin } from '../api/day';

const LEN = 4; // 4-digit PIN, ATM-style

// A single reusable gate for viewing salary. First time it asks the person to CREATE a
// PIN (enter + confirm); after that it asks them to ENTER it. Calls onUnlocked() when the
// PIN is set or verified. The parent decides what to reveal.
export default function SalaryPinModal({ visible, onClose, onUnlocked, onForgotPin, purpose = 'view your salary' }) {
  const [status, setStatus] = useState('loading'); // loading | set | unset | error
  const [stage, setStage] = useState('enter');      // enter | create | confirm
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => { setPin(''); setFirstPin(''); setError(''); setBusy(false); }, []);

  useEffect(() => {
    if (!visible) return;
    reset();
    setStatus('loading');
    salaryPinStatus()
      .then((d) => {
        if (d?.set) { setStatus('set'); setStage('enter'); }
        else { setStatus('unset'); setStage('create'); }
      })
      .catch(() => { setStatus('error'); });
  }, [visible, reset]);

  const finishCreate = async (confirmed) => {
    setBusy(true); setError('');
    try {
      await setSalaryPin(confirmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlocked?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not set PIN');
      setStage('create'); setPin(''); setFirstPin('');
    } finally { setBusy(false); }
  };

  const finishEnter = async (entered) => {
    setBusy(true); setError('');
    try {
      const r = await verifySalaryPin(entered);
      if (r?.ok) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onUnlocked?.(); }
      else { setError('Incorrect PIN'); setPin(''); }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.response?.data?.message || 'Incorrect PIN'); setPin('');
    } finally { setBusy(false); }
  };

  // Called whenever a full-length PIN is assembled.
  const onComplete = (value) => {
    if (stage === 'enter') return finishEnter(value);
    if (stage === 'create') {
      setFirstPin(value); setPin(''); setError(''); setStage('confirm');
      return;
    }
    // confirm
    if (value === firstPin) return finishCreate(value);
    setError('PINs did not match — start again');
    setFirstPin(''); setPin(''); setStage('create');
  };

  const press = (d) => {
    if (busy) return;
    setError('');
    Haptics.selectionAsync();
    setPin((prev) => {
      if (prev.length >= LEN) return prev;
      const next = prev + d;
      if (next.length === LEN) setTimeout(() => onComplete(next), 80);
      return next;
    });
  };
  const backspace = () => { if (busy) return; setPin((p) => p.slice(0, -1)); };

  const title = stage === 'enter' ? 'Enter your PIN'
    : stage === 'create' ? 'Create a PIN'
    : 'Confirm your PIN';
  const subtitle = stage === 'enter' ? `Enter your ${LEN}-digit PIN to ${purpose}.`
    : stage === 'create' ? `Set a ${LEN}-digit PIN. You'll enter it each time you want to ${purpose}.`
    : 'Type the same PIN again to confirm.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, SHADOW.lift]}>
          <View style={styles.lockBadge}><Ionicons name="lock-closed" size={22} color={COLORS.primary} /></View>
          <Text style={styles.title}>{title}</Text>

          {status === 'loading' ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : status === 'error' ? (
            <>
              <Text style={styles.sub}>Couldn't reach the server. Try again.</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}><Text style={styles.closeTxt}>Close</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sub}>{subtitle}</Text>

              <View style={styles.dots}>
                {Array.from({ length: LEN }).map((_, i) => (
                  <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
                ))}
              </View>

              {!!error && (
                <View style={styles.errRow}>
                  <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
                  <Text style={styles.errTxt}>{error}</Text>
                </View>
              )}

              <View style={styles.pad}>
                {[['1','2','3'],['4','5','6'],['7','8','9']].map((row, ri) => (
                  <View key={ri} style={styles.padRow}>
                    {row.map((d) => (
                      <Pressable key={d} onPress={() => press(d)} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                        <Text style={styles.keyTxt}>{d}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <View style={styles.padRow}>
                  <View style={[styles.key, { opacity: 0 }]} />
                  <Pressable onPress={() => press('0')} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                    <Text style={styles.keyTxt}>0</Text>
                  </Pressable>
                  <Pressable onPress={backspace} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                    <Ionicons name="backspace-outline" size={24} color={COLORS.text} />
                  </Pressable>
                </View>
              </View>

              {busy && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 4 }} />}

              <Pressable onPress={onClose} hitSlop={8} style={styles.cancel}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>

              {stage === 'enter' && !!onForgotPin && (
                <Pressable onPress={onForgotPin} hitSlop={8} style={styles.forgot}>
                  <Text style={styles.forgotTxt}>Forgot PIN?</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.lg },
  card: { width: '100%', maxWidth: 360, backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl, alignItems: 'center' },
  lockBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: SP.md },
  title: { ...TYPE.h2, color: COLORS.text },
  sub: { ...TYPE.cap, color: COLORS.textSoft, textAlign: 'center', marginTop: 6, lineHeight: 17, paddingHorizontal: SP.sm },
  dots: { flexDirection: 'row', gap: 16, marginTop: SP.lg, marginBottom: SP.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  dotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  errTxt: { ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  pad: { marginTop: SP.md, gap: SP.sm },
  padRow: { flexDirection: 'row', gap: SP.md, justifyContent: 'center' },
  key: { width: 68, height: 60, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: COLORS.primaryTint, borderColor: COLORS.primary },
  keyTxt: { fontSize: 24, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  cancel: { marginTop: SP.lg, padding: 6 },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft },
  forgot: { marginTop: SP.sm, padding: 6 },
  forgotTxt: { ...TYPE.cap, fontSize: 13, color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
  closeBtn: { marginTop: SP.lg, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 28 },
  closeTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft },
});
