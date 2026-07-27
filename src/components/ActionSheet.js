import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SP, R, TYPE } from '../theme/theme';
import { doAction } from '../api/day';
import { getCoordsAndAddress } from '../hooks/useLocation';
import { useToast } from '../context/ToastContext';

// Order matches the old app's sheet.
const ACTIONS = [
  { type: 'wfh',        label: 'Work From Home',        icon: 'home-outline' },
  { type: 'remove_wfh', label: 'Remove Work From Home', icon: 'home' },
  { type: 'lunch',      label: 'Lunch',                 icon: 'restaurant-outline' },
  { type: 'absent',     label: 'Absent',                icon: 'close-circle-outline' },
  { type: 'checkout',   label: 'Checkout',              icon: 'log-out-outline' },
  { type: 'reached',    label: 'Reaching Checkpoint',   icon: 'arrow-forward-circle-outline' },
  { type: 'leaving',    label: 'Leaving Checkpoint',    icon: 'arrow-back-circle-outline' },
  { type: 'atoffice',   label: 'At Office',             icon: 'business-outline' },
  { type: 'checkin',    label: 'Check in',              icon: 'log-in-outline' },
];

export default function ActionSheet({ visible, states, onClose, onDone }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(null);   // action type being processed
  const [redFor, setRedFor] = useState(null); // { type, message }

  const tap = async (a) => {
    const st = states?.[a.type]?.state || 'idle';
    if (st === 'blocked') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setRedFor({ type: a.type, message: states[a.type].message });
      setTimeout(() => setRedFor(null), 2600);
      return;
    }
    if (st === 'done') return;
    setBusy(a.type);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { lat, lng, address } = await getCoordsAndAddress();
      const res = await doAction(a.type, lat, lng, address);
      if (!res.success) { showToast(res.message || 'Could not complete', 'error'); }
      else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onClose?.(); showToast(`${a.label} done`); onDone?.(); }
    } catch (e) {
      showToast(e.message || 'Could not complete', 'error');
    } finally { setBusy(null); }
  };

  const colorFor = (type) => {
    const st = states?.[type]?.state;
    if (st === 'green') return COLORS.success;
    if (st === 'blocked' || st === 'done') return COLORS.textMute;
    return COLORS.primary;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>What do you want to do?</Text>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {ACTIONS.map((a) => {
            const st = states?.[a.type]?.state;
            const isRed = redFor?.type === a.type;
            return (
              <View key={a.type}>
                <Pressable onPress={() => tap(a)} disabled={busy === a.type}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: COLORS.surfaceAlt }]}>
                  {st === 'green' && <View style={styles.greenDot} />}
                  <Ionicons name={a.icon} size={20} color={colorFor(a.type)} style={{ width: 26 }} />
                  <Text style={[styles.rowTxt, { color: colorFor(a.type) }, st === 'green' && styles.greenTxt]}>{a.label}</Text>
                  {busy === a.type && <ActivityIndicator size="small" color={COLORS.primary} />}
                  {st === 'done' && <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />}
                </Pressable>
                {isRed && (
                  <View style={styles.redPrompt}>
                    <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
                    <Text style={styles.redTxt}>{redFor.message}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.45)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.lg, paddingBottom: SP.xl },
  title: { ...TYPE.label, color: COLORS.textMute, textAlign: 'center', paddingVertical: SP.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: 15, borderTopWidth: 1, borderTopColor: COLORS.border },
  greenDot: { position: 'absolute', left: -SP.lg + 6, width: 4, height: 28, borderRadius: 2, backgroundColor: COLORS.success },
  rowTxt: { flex: 1, ...TYPE.title, fontSize: 16, fontWeight: '600' },
  greenTxt: { fontWeight: '800' },
  redPrompt: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, paddingHorizontal: SP.md, paddingVertical: SP.sm, marginBottom: SP.sm },
  redTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  cancel: { marginTop: SP.md, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: 15, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 16, color: COLORS.primary },
});
