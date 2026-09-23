import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, useWindowDimensions, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { listTasks, createTask, updateTask, deleteTask } from '../../api/admin';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const ICONS = ['sunny-outline', 'clipboard-outline', 'car-outline', 'cafe-outline', 'walk-outline', 'happy-outline', 'checkmark-done-outline', 'sparkles-outline', 'time-outline', 'flag-outline'];
const toHHMM = (m) => `${String(Math.floor((m ?? 0) / 60)).padStart(2, '0')}:${String((m ?? 0) % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmt = (m) => { const h = Math.floor(m / 60), mm = m % 60; const ap = h < 12 ? 'AM' : 'PM'; const hh = h % 12 || 12; return `${hh}:${String(mm).padStart(2, '0')} ${ap}`; };

const empty = { name: '', icon: 'ellipse-outline', points: '1', start: '09:00', end: '11:00' };

export default function TaskSetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { height: winH } = useWindowDimensions();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { try { setTasks(await listTasks()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => setEditing({ ...empty });
  const openEdit = (t) => setEditing({ id: t.id, name: t.name, icon: t.icon, points: String(t.points), start: toHHMM(t.startMinute), end: toHHMM(t.endMinute) });

  const save = async () => {
    const e = editing;
    if (!e.name.trim()) return Alert.alert('Task', 'Enter a name');
    const body = { name: e.name.trim(), icon: e.icon, points: Number(e.points) || 1, startMinute: toMin(e.start), endMinute: toMin(e.end) };
    if (body.endMinute <= body.startMinute) return Alert.alert('Time', 'End time must be after start time');
    setSaving(true);
    try { if (e.id) await updateTask(e.id, body); else await createTask(body); setEditing(null); load(); }
    catch (err) { Alert.alert('Error', err?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  const remove = (t) => Alert.alert('Delete task', `Remove "${t.name}"?`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(t.id); load(); } }]);

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.barTitle}>Tasks</Text>
        <Pressable onPress={openNew} hitSlop={10}><Ionicons name="add-circle" size={26} color={COLORS.primary} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        <Text style={styles.hint}>These are the timed point-buttons your team taps. Each shows only inside its time window. Add as many as you like.</Text>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {tasks.map((t) => (
          <View key={t.id} style={[styles.card, SHADOW.card]}>
            <View style={styles.tIcon}><Ionicons name={t.icon} size={20} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tName}>{t.name}</Text>
              <Text style={styles.tMeta}>{fmt(t.startMinute)} – {fmt(t.endMinute)} · +{t.points} pt{t.points !== 1 ? 's' : ''}</Text>
            </View>
            <Pressable onPress={() => openEdit(t)} hitSlop={8} style={styles.act}><Ionicons name="create-outline" size={20} color={COLORS.textSoft} /></Pressable>
            <Pressable onPress={() => remove(t)} hitSlop={8} style={styles.act}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></Pressable>
          </View>
        ))}
        {!loading && !tasks.length && <Text style={styles.dim}>No tasks yet. Tap + to add one.</Text>}
      </ScrollView>

      {/* In-view overlay (NOT a Modal): Android resizes this with the keyboard,
          so the form and Save button always stay above it. */}
      {editing && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={() => { Keyboard.dismiss(); setEditing(null); }} />
          {/* Sheet sits exactly on top of the keyboard: we shift it by the real
              keyboard height (edge-to-edge means the window never resizes). */}
          <View style={[styles.sheetWrap, { paddingBottom: kb }]} pointerEvents="box-none">
            <View style={[styles.sheet, {
              maxHeight: Math.max(260, winH - kb - 90),
              paddingBottom: kb > 0 ? SP.lg : insets.bottom + SP.lg,
            }]}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>{editing.id ? 'Edit task' : 'New task'}</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SP.md }}>
                <Text style={styles.lbl}>Name</Text>
                <TextInput style={styles.input} value={editing.name} onChangeText={(v) => setEditing((o) => ({ ...o, name: v }))} placeholder="e.g. Good Morning" placeholderTextColor={COLORS.textMute} />

                <Text style={styles.lbl}>Icon</Text>
                <View style={styles.iconRow}>
                  {ICONS.map((ic) => (
                    <Pressable key={ic} onPress={() => setEditing((o) => ({ ...o, icon: ic }))} style={[styles.iconPick, editing.icon === ic && styles.iconPickOn]}>
                      <Ionicons name={ic} size={20} color={editing.icon === ic ? COLORS.white : COLORS.textSoft} />
                    </Pressable>
                  ))}
                </View>

                <View style={styles.two}>
                  <View style={{ flex: 1 }}><Text style={styles.lbl}>Start (HH:MM)</Text><TextInput style={styles.input} value={editing.start} onChangeText={(v) => setEditing((o) => ({ ...o, start: v }))} placeholder="09:00" placeholderTextColor={COLORS.textMute} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.lbl}>End (HH:MM)</Text><TextInput style={styles.input} value={editing.end} onChangeText={(v) => setEditing((o) => ({ ...o, end: v }))} placeholder="11:00" placeholderTextColor={COLORS.textMute} /></View>
                </View>

                <Text style={styles.lbl}>Points</Text>
                <TextInput style={styles.input} value={editing.points} onChangeText={(v) => setEditing((o) => ({ ...o, points: v }))} keyboardType="number-pad" />

                <View style={styles.btnRow}>
                  <Pressable onPress={() => { Keyboard.dismiss(); setEditing(null); }} style={styles.cancelBtn}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
                  <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, SHADOW.lift]}>
                    {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveTxt}>{editing.id ? 'Save changes' : 'Add task'}</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barTitle: { ...TYPE.h2, color: COLORS.text },
  hint: { ...TYPE.body, color: COLORS.textMute, marginBottom: SP.lg, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  tIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  tName: { ...TYPE.title, color: COLORS.text },
  tMeta: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  act: { padding: 6 },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.sm },
  lbl: { ...TYPE.cap, color: COLORS.textSoft, marginBottom: 6, marginTop: SP.sm },
  input: { height: 48, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconPick: { width: 44, height: 44, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  iconPickOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  two: { flexDirection: 'row', gap: SP.md },
  btnRow: { flexDirection: 'row', gap: SP.md, marginTop: SP.lg },
  cancelBtn: { flex: 1, height: 52, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 16, color: COLORS.textSoft },
  saveBtn: { flex: 1.4, height: 52, borderRadius: R.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
});
