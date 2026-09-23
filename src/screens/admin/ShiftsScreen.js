import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, Platform, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SP, R, TYPE, SHADOW, fmtMin } from '../../theme/theme';
import { staffStatus, setStaffShift, setBulkStaffShift } from '../../api/admin';
import { useToast } from '../../context/ToastContext';

const dateToMinutes = (d) => d.getHours() * 60 + d.getMinutes();
const minutesToDate = (m) => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };

// Grace presets — covers 99% of real-world use. Custom values can still be set via bulk if needed.
const GRACE_PRESETS = [10, 15, 30, 45, 60];

export default function ShiftsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [staff, setStaff] = useState([]);
  const [defaults, setDefaults] = useState({ start: 570, end: 1080, grace: 15 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [picker, setPicker] = useState(null);        // { kind, personId?, initial }
  const [gracePicker, setGracePicker] = useState(null); // { kind, personId? }
  // Bulk draft: what admin has picked but not applied.
  const [bulkDraft, setBulkDraft] = useState({ start: null, end: null, grace: null });

  const load = useCallback(async () => {
    try {
      const d = await staffStatus();
      setStaff(d.staff || []);
      if (d.settings) {
        setDefaults({
          start: d.settings.shiftStartMinute ?? 570,
          end:   d.settings.shiftEndMinute   ?? 1080,
          grace: d.settings.graceMinutes     ?? 15,
        });
      }
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = useMemo(() => staff, [staff]);

  // --- Selection helpers ---
  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(rows.map((r) => r.id)));
  const clearSelection = () => { setSelected(new Set()); setBulkDraft({ start: null, end: null, grace: null }); };
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  // --- Individual save ---
  const saveIndividual = async (personId, field, value) => {
    setBusy(personId);
    try {
      // Send only the field we changed. undefined for the rest = "leave alone".
      const payload = { start: undefined, end: undefined, grace: undefined, [field]: value };
      await setStaffShift(personId, payload.start, payload.end, payload.grace);
      showToast('Shift updated');
      load();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.message || 'Please try again');
    } finally { setBusy(null); }
  };

  const resetIndividual = (person) => {
    Alert.alert('Reset shift?',
      `${person.name} will use the company default (${fmtMin(defaults.start)} – ${fmtMin(defaults.end)}, ${defaults.grace} min grace).`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          setBusy(person.id);
          try { await setStaffShift(person.id, null, null, null); showToast('Reset to company default'); load(); }
          catch (e) { Alert.alert('Could not reset', e?.response?.data?.message || 'Please try again'); }
          finally { setBusy(null); }
        } },
    ]);
  };

  // --- Bulk apply ---
  const applyBulk = async () => {
    if (selected.size === 0) return showToast('Select at least one person', 'error');
    if (bulkDraft.start == null && bulkDraft.end == null && bulkDraft.grace == null)
      return showToast('Pick a value first', 'error');
    setBulkBusy(true);
    try {
      const startArg = bulkDraft.start == null ? undefined : bulkDraft.start;
      const endArg   = bulkDraft.end   == null ? undefined : bulkDraft.end;
      const graceArg = bulkDraft.grace == null ? undefined : bulkDraft.grace;
      const r = await setBulkStaffShift(Array.from(selected), startArg, endArg, graceArg);
      showToast(`Applied to ${r.updated} employees`);
      exitSelectMode();
      load();
    } catch (e) {
      Alert.alert('Could not apply', e?.response?.data?.message || 'Please try again');
    } finally { setBulkBusy(false); }
  };

  const bulkReset = () => {
    if (selected.size === 0) return showToast('Select at least one person', 'error');
    Alert.alert('Reset shifts?', `${selected.size} employees will fall back to the company default.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        setBulkBusy(true);
        try { const r = await setBulkStaffShift(Array.from(selected), null, null, null); showToast(`Reset ${r.updated} employees`); exitSelectMode(); load(); }
        catch (e) { Alert.alert('Could not reset', e?.response?.data?.message || 'Please try again'); }
        finally { setBulkBusy(false); }
      } },
    ]);
  };

  const onPickerChange = (event, selectedDate) => {
    const p = picker; setPicker(null);
    if (!p) return;
    if (event.type === 'dismissed' || !selectedDate) return;
    const mins = dateToMinutes(selectedDate);

    if (p.kind === 'individual:start' || p.kind === 'individual:end') {
      const field = p.kind.endsWith('start') ? 'start' : 'end';
      const person = rows.find((x) => x.id === p.personId);
      const otherEff = field === 'start'
        ? (person?.shiftEndMinute ?? defaults.end)
        : (person?.shiftStartMinute ?? defaults.start);
      const startVal = field === 'start' ? mins : otherEff;
      const endVal   = field === 'end'   ? mins : otherEff;
      if (endVal <= startVal) { Alert.alert('Invalid shift', 'Shift end must be after shift start.'); return; }
      saveIndividual(p.personId, field, mins);
    } else if (p.kind === 'bulk:start' || p.kind === 'bulk:end') {
      const field = p.kind.endsWith('start') ? 'start' : 'end';
      setBulkDraft((prev) => {
        const next = { ...prev, [field]: mins };
        if (next.start != null && next.end != null && next.end <= next.start) {
          Alert.alert('Check your times', 'End is before start — the server will reject this. Adjust one of them.');
        }
        return next;
      });
    }
  };

  // Grace picker: modal-style chip menu with presets. Same modal for individual and bulk.
  const onGracePick = (value) => {
    const g = gracePicker; setGracePicker(null);
    if (!g) return;
    if (g.kind === 'individual') saveIndividual(g.personId, 'grace', value);
    else if (g.kind === 'bulk')  setBulkDraft((prev) => ({ ...prev, grace: value }));
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => (selectMode ? exitSelectMode() : navigation.goBack())} hitSlop={10}>
            <Ionicons name={selectMode ? 'close' : 'chevron-back'} size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.title}>{selectMode ? `${selected.size} selected` : 'Shift times'}</Text>
          {selectMode ? (
            <Pressable onPress={selected.size === rows.length ? clearSelection : selectAll} hitSlop={10}>
              <Ionicons name={selected.size === rows.length ? 'square-outline' : 'checkbox-outline'} size={22} color={COLORS.white} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setSelectMode(true)} hitSlop={10}>
              <Ionicons name="checkbox-outline" size={22} color={COLORS.white} />
            </Pressable>
          )}
        </View>
        <Text style={styles.sub}>
          {selectMode
            ? 'Pick people, then set the values below. Only what you set gets applied.'
            : `Company default: ${fmtMin(defaults.start)} – ${fmtMin(defaults.end)}, ${defaults.grace}min grace. Grace = little-late window (after shift start, before "very late").`}
        </Text>
      </LinearGradient>

      {selectMode && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkRow}>
            <Pressable style={styles.bulkChip} onPress={() => setPicker({ kind: 'bulk:start', initial: minutesToDate(bulkDraft.start ?? defaults.start) })}>
              <Ionicons name="sunny-outline" size={14} color={COLORS.primary} />
              <Text style={styles.bulkChipLbl}>Start</Text>
              <Text style={styles.bulkChipVal}>{bulkDraft.start == null ? '—' : fmtMin(bulkDraft.start)}</Text>
            </Pressable>
            <Pressable style={styles.bulkChip} onPress={() => setPicker({ kind: 'bulk:end', initial: minutesToDate(bulkDraft.end ?? defaults.end) })}>
              <Ionicons name="moon-outline" size={14} color={COLORS.primary} />
              <Text style={styles.bulkChipLbl}>End</Text>
              <Text style={styles.bulkChipVal}>{bulkDraft.end == null ? '—' : fmtMin(bulkDraft.end)}</Text>
            </Pressable>
            <Pressable style={styles.bulkChip} onPress={() => setGracePicker({ kind: 'bulk' })}>
              <Ionicons name="timer-outline" size={14} color={COLORS.primary} />
              <Text style={styles.bulkChipLbl}>Grace</Text>
              <Text style={styles.bulkChipVal}>{bulkDraft.grace == null ? '—' : `${bulkDraft.grace}m`}</Text>
            </Pressable>
          </View>
          <View style={styles.bulkActions}>
            <Pressable style={[styles.btnGhost, bulkBusy && { opacity: 0.5 }]} onPress={bulkReset} disabled={bulkBusy || selected.size === 0}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.danger} />
              <Text style={[styles.btnGhostTxt, { color: COLORS.danger }]}>Reset to default</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, (bulkBusy || selected.size === 0 || (bulkDraft.start == null && bulkDraft.end == null && bulkDraft.grace == null)) && { opacity: 0.5 }]}
              onPress={applyBulk}
              disabled={bulkBusy || selected.size === 0 || (bulkDraft.start == null && bulkDraft.end == null && bulkDraft.grace == null)}>
              {bulkBusy ? <ActivityIndicator size="small" color={COLORS.white} />
                : <><Ionicons name="checkmark" size={16} color={COLORS.white} /><Text style={styles.btnPrimaryTxt}>Apply</Text></>}
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {!loading && rows.length === 0 && <Text style={styles.empty}>No employees yet.</Text>}
        {rows.map((p) => {
          const isSelected = selected.has(p.id);
          const custom = p.shiftStartMinute != null || p.shiftEndMinute != null || p.graceMinutes != null;
          const effStart = p.effectiveShiftStartMinute ?? p.shiftStartMinute ?? defaults.start;
          const effEnd   = p.effectiveShiftEndMinute   ?? p.shiftEndMinute   ?? defaults.end;
          const effGrace = p.effectiveGraceMinutes     ?? p.graceMinutes     ?? defaults.grace;
          return (
            <Pressable
              key={p.id}
              onPress={selectMode ? () => toggleSelect(p.id) : undefined}
              onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSelect(p.id); } }}
              style={[styles.card, SHADOW.card, isSelected && styles.cardSelected]}>
              <View style={styles.rowTop}>
                {selectMode && (
                  <View style={[styles.check, isSelected && styles.checkOn]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                  </View>
                )}
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{p.name?.[0]?.toUpperCase() || '?'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.sub2}>
                    {custom
                      ? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Custom shift</Text>
                      : <Text style={{ color: COLORS.textMute }}>Company default</Text>}
                    <Text style={{ color: COLORS.textMute }}> · {p.designation || 'Team Member'}</Text>
                  </Text>
                </View>
                {busy === p.id && <ActivityIndicator size="small" color={COLORS.primary} />}
              </View>
              <View style={styles.timeRow}>
                <Pressable
                  disabled={selectMode || busy === p.id}
                  onPress={() => setPicker({ kind: 'individual:start', personId: p.id, initial: minutesToDate(effStart) })}
                  style={[styles.timeBtn, selectMode && { opacity: 0.7 }]}>
                  <Ionicons name="sunny-outline" size={14} color={COLORS.textSoft} />
                  <Text style={styles.timeLbl}>Start</Text>
                  <Text style={styles.timeVal}>{fmtMin(effStart)}</Text>
                </Pressable>
                <Pressable
                  disabled={selectMode || busy === p.id}
                  onPress={() => setPicker({ kind: 'individual:end', personId: p.id, initial: minutesToDate(effEnd) })}
                  style={[styles.timeBtn, selectMode && { opacity: 0.7 }]}>
                  <Ionicons name="moon-outline" size={14} color={COLORS.textSoft} />
                  <Text style={styles.timeLbl}>End</Text>
                  <Text style={styles.timeVal}>{fmtMin(effEnd)}</Text>
                </Pressable>
              </View>
              <View style={styles.timeRow}>
                <Pressable
                  disabled={selectMode || busy === p.id}
                  onPress={() => setGracePicker({ kind: 'individual', personId: p.id })}
                  style={[styles.timeBtn, { flex: 1 }, selectMode && { opacity: 0.7 }]}>
                  <Ionicons name="timer-outline" size={14} color={COLORS.textSoft} />
                  <Text style={styles.timeLbl}>Grace (little-late window)</Text>
                  <Text style={styles.timeVal}>{effGrace} min</Text>
                </Pressable>
                {custom && !selectMode && (
                  <Pressable disabled={busy === p.id} onPress={() => resetIndividual(p)} hitSlop={6} style={styles.resetBtn}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.danger} />
                  </Pressable>
                )}
              </View>
              {/* Preview the little-late/very-late thresholds so admin sees the effect */}
              <Text style={styles.preview}>
                On time ≤ {fmtMin(effStart)} · Little late ≤ {fmtMin(effStart + effGrace)} · Very late after
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {picker && (
        <DateTimePicker
          value={picker.initial}
          mode="time" is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      )}

      {/* Grace picker modal — chip menu of presets */}
      <Modal visible={!!gracePicker} transparent animationType="fade" onRequestClose={() => setGracePicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGracePicker(null)}>
          <Pressable style={styles.graceSheet} onPress={() => {}}>
            <Text style={styles.graceTitle}>Little-late window</Text>
            <Text style={styles.graceSub}>Minutes after shift start that still count as "little late" (before "very late").</Text>
            <View style={styles.graceChips}>
              {GRACE_PRESETS.map((v) => (
                <Pressable key={v} onPress={() => onGracePick(v)} style={styles.graceChip}>
                  <Text style={styles.graceChipTxt}>{v} min</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setGracePicker(null)} style={styles.graceCancel}>
              <Text style={styles.graceCancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub:   { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', marginTop: SP.sm, lineHeight: 18 },
  bulkBar: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: SP.lg, paddingVertical: SP.md, gap: SP.sm },
  bulkRow: { flexDirection: 'row', gap: SP.sm },
  bulkChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryTint, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  bulkChipLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700' },
  bulkChipVal: { ...TYPE.label, color: COLORS.primary, fontWeight: '800', marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  bulkActions: { flexDirection: 'row', gap: SP.sm, alignItems: 'center' },
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md },
  btnPrimaryTxt: { ...TYPE.label, color: COLORS.white, fontWeight: '800' },
  btnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.md, paddingVertical: SP.md, paddingHorizontal: SP.md, borderWidth: 1, borderColor: COLORS.dangerTint },
  btnGhostTxt: { ...TYPE.cap, fontWeight: '700' },
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  cardSelected: { borderColor: COLORS.primary, borderWidth: 1.5, backgroundColor: COLORS.primaryTint },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.textMute, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  name: { ...TYPE.title, color: COLORS.text },
  sub2: { ...TYPE.cap, marginTop: 2 },
  timeRow: { flexDirection: 'row', gap: SP.sm, alignItems: 'center', marginTop: SP.sm },
  timeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  timeLbl: { ...TYPE.cap, color: COLORS.textSoft },
  timeVal: { ...TYPE.label, color: COLORS.text, marginLeft: 'auto', fontWeight: '800', fontVariant: ['tabular-nums'] },
  resetBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.dangerTint, alignItems: 'center', justifyContent: 'center' },
  preview: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm, fontStyle: 'italic', textAlign: 'center' },
  // Grace picker modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.5)', alignItems: 'center', justifyContent: 'center' },
  graceSheet: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, marginHorizontal: SP.lg, width: '85%', maxWidth: 340 },
  graceTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.sm },
  graceSub: { ...TYPE.cap, color: COLORS.textSoft, marginBottom: SP.md, lineHeight: 18 },
  graceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.md },
  graceChip: { flexGrow: 1, minWidth: 80, backgroundColor: COLORS.primaryTint, borderRadius: R.md, paddingVertical: SP.md, paddingHorizontal: SP.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  graceChipTxt: { ...TYPE.title, fontSize: 15, color: COLORS.primary, fontWeight: '800' },
  graceCancel: { alignSelf: 'center', padding: SP.sm },
  graceCancelTxt: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700' },
});
