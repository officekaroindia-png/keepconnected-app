import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffTimeline, staffAction, editEventTime } from '../../api/admin';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const EV = {
  checkin:  { icon: 'airplane', c: COLORS.success, label: 'Checked In', rot: '90deg' },
  atoffice: { icon: 'business', c: '#0E7490', label: 'At Office' },
  checkout: { icon: 'airplane', c: COLORS.danger, label: 'Checked Out', rot: '-90deg' },
  reached:  { icon: 'arrow-forward', c: COLORS.success, label: 'Reached' },
  leaving:  { icon: 'arrow-back', c: COLORS.success, label: 'Leaving' },
  wfh:      { icon: 'home', c: COLORS.primary, label: 'Work From Home' },
  remove_wfh:{ icon: 'home-outline', c: COLORS.textSoft, label: 'Removed WFH' },
  lunch:    { icon: 'restaurant', c: COLORS.warn, label: 'Lunch' },
  absent:   { icon: 'close-circle', c: COLORS.danger, label: 'Absent' },
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDist = (m) => (m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} kms` : `${Math.round(m)} mts`);

const DIAL = [
  { kind: 'checkin',        label: 'Check in',       icon: 'log-in',  c: COLORS.success },
  { kind: 'reset_checkin',  label: 'Reset check-in', icon: 'refresh', c: COLORS.success },
  { kind: 'checkout',       label: 'Check out',      icon: 'log-out', c: COLORS.danger },
  { kind: 'reset_checkout', label: 'Reset check-out',icon: 'refresh', c: COLORS.warn },
  { kind: 'mark_absent',    label: 'Mark absent',    icon: 'close-circle', c: COLORS.danger },
];

export default function StaffTimelineScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { id, name, date: paramDate } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dial, setDial] = useState(false);
  const [edit, setEdit] = useState(null); // { which, time }

  const load = useCallback(async () => { try { setData(await staffTimeline(id, paramDate)); } catch {} finally { setLoading(false); } }, [id, paramDate]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runAction = (kind, label) => {
    setDial(false);
    Alert.alert(label, `${label} for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => { try { await staffAction(id, kind, paramDate); load(); } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); } } },
    ]);
  };
  const saveTime = async () => {
    try { await editEventTime(id, edit.which, paramDate || data.date, edit.time); setEdit(null); load(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
  };

  const events = data?.events || [];
  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Timeline · {name}</Text><View style={{ width: 24 }} />
        </View>
        <Text style={styles.hint}>Admin: tap a time to edit it, or use the button to act for this person.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 120 }}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {!loading && events.length === 0 && <Text style={styles.dim}>No activity for this day.</Text>}
        {events.map((e, i) => {
          const ev = EV[e.type] || EV.checkin;
          const editable = e.type === 'checkin' || e.type === 'checkout';
          return (
            <View key={i} style={styles.row}>
              <Pressable disabled={!editable} onPress={() => setEdit({ which: e.type, time: hhmm(e.at) })} style={styles.timeCol}>
                <Text style={[styles.time, editable && styles.timeEditable]}>{hhmm(e.at)}</Text>
                {editable && <Ionicons name="pencil" size={11} color={COLORS.primary} />}
              </Pressable>
              <View style={styles.lineCol}>
                <View style={[styles.node, { backgroundColor: ev.c }]}><Ionicons name={ev.icon} size={14} color={COLORS.white} style={ev.rot ? { transform: [{ rotate: ev.rot }] } : null} /></View>
                {i < events.length - 1 && <View style={styles.stem} />}
              </View>
              <View style={styles.body}>
                <Text style={styles.evLabel}>{ev.label}{e.byAdmin ? '  (by admin)' : ''}</Text>
                {e.address
                  ? <Text style={styles.addr}>{e.address}</Text>
                  : (e.lat != null && e.lng != null) && <Text style={styles.addr}>{e.lat.toFixed(5)}, {e.lng.toFixed(5)}</Text>}
                {e.distance != null && e.distance > 0 && <Text style={styles.dist}>Distance: {fmtDist(e.distance)}</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Speed-dial */}
      {/* dimmed frosted backdrop */}
      {dial && <Pressable style={styles.dialScrim} onPress={() => setDial(false)} />}
      {dial && DIAL.map((d, i) => (
        <Pressable key={d.kind} onPress={() => runAction(d.kind, d.label)} style={[styles.dialItem, { bottom: insets.bottom + 90 + (DIAL.length - 1 - i) * 58 }, SHADOW.lift]}>
          <Text style={styles.dialLabel}>{d.label}</Text>
          <View style={[styles.dialIcon, { backgroundColor: d.c }]}><Ionicons name={d.icon} size={18} color={COLORS.white} /></View>
        </Pressable>
      ))}
      <Pressable onPress={() => setDial((v) => !v)} style={[styles.fab, { bottom: insets.bottom + 24 }, SHADOW.lift]}>
        <Ionicons name={dial ? 'close' : 'construct'} size={24} color={COLORS.white} />
      </Pressable>

      {/* Edit time — in-view overlay (Android Modal doesn't resize with keyboard) */}
      {edit && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.modalBackdrop} onPress={() => { Keyboard.dismiss(); setEdit(null); }} />
          <View style={[styles.modalWrap, { paddingBottom: kb }]} pointerEvents="box-none">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Edit {edit.which === 'checkin' ? 'check-in' : 'check-out'} time</Text>
              <TextInput style={styles.modalInput} value={edit.time} onChangeText={(t) => setEdit((o) => ({ ...o, time: t }))} placeholder="HH:MM" placeholderTextColor={COLORS.textMute} keyboardType="numbers-and-punctuation" autoFocus />
              <View style={styles.modalBtns}>
                <Pressable onPress={() => setEdit(null)} style={[styles.mBtn, { backgroundColor: COLORS.surfaceAlt }]}><Text style={{ color: COLORS.textSoft, fontWeight: '700' }}>Cancel</Text></Pressable>
                <Pressable onPress={saveTime} style={[styles.mBtn, { backgroundColor: COLORS.primary }]}><Text style={{ color: COLORS.white, fontWeight: '700' }}>Save</Text></Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  hint: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: SP.sm },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', gap: SP.sm },
  timeCol: { width: 58, paddingTop: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  time: { ...TYPE.label, color: COLORS.text, fontWeight: '800' },
  timeEditable: { color: COLORS.primary, textDecorationLine: 'underline' },
  lineCol: { alignItems: 'center', width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stem: { flex: 1, width: 3, backgroundColor: COLORS.border, marginVertical: 2, minHeight: 20 },
  body: { flex: 1, paddingBottom: SP.lg },
  evLabel: { ...TYPE.title, color: COLORS.text },
  addr: { ...TYPE.body, color: COLORS.textSoft, marginTop: 2, lineHeight: 19 },
  dist: { ...TYPE.cap, color: COLORS.primary, marginTop: 2 },
  fab: { position: 'absolute', right: SP.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  dialItem: { position: 'absolute', right: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  dialLabel: { ...TYPE.cap, color: COLORS.text, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, overflow: 'hidden', fontWeight: '700' },
  dialIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dialScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(241,245,249,0.82)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl },
  modal: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.xl, width: '100%' },
  modalTitle: { ...TYPE.title, color: COLORS.text, marginBottom: SP.md },
  modalInput: { height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: SP.sm, marginTop: SP.lg },
  mBtn: { flex: 1, height: 46, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
});
