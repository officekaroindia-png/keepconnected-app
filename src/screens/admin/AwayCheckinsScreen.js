import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { listAwayCheckins, setAwayCheckins, setBulkAwayCheckins, setOffsiteAuth } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

export default function AwayCheckinsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  // editModal now carries: { id, name, used } for single | { bulk: true } for bulk
  const [editModal, setEditModal] = useState(null);
  const [countInput, setCountInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [offsiteBusy, setOffsiteBusy] = useState(null);

  const load = useCallback(async () => {
    try { setData(await listAwayCheckins()); }
    catch (e) { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = data?.rows || [];

  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  // Pre-fill with how many are REMAINING (what the card shows) + carry usedThisMonth so save can reconstruct perMonth
  const openEdit = (row) => {
    const used = row.unlimited ? 0 : Math.max(0, (row.usedThisMonth ?? (row.perMonth - row.remaining)));
    setCountInput(row.unlimited ? '' : String(row.remaining ?? row.perMonth));
    setEditModal({ id: row.id, name: row.name, unlimited: row.unlimited, used });
  };

  const openBulkEdit = () => {
    if (selected.size === 0) return showToast('Select people first', 'error');
    setCountInput('');
    setEditModal({ bulk: true });
  };

  const applyCount = async () => {
    const n = Number(countInput);
    if (countInput === '' || isNaN(n) || n < 0) return showToast('Enter a valid number', 'error');

    // For single edit: user typed how many remaining they want → actual perMonth = used + remaining
    // For bulk edit: user types a total perMonth directly (no used context across multiple people)
    const used = editModal?.used ?? 0;
    const newPerMonth = editModal?.bulk ? n : used + n;

    if (newPerMonth > 31) return showToast('Total would exceed 31', 'error');

    setSaving(true);
    try {
      if (editModal.bulk) {
        const r = await setBulkAwayCheckins(Array.from(selected), newPerMonth, false);
        showToast(`Updated ${r.updated}`);
        exitSelect();
      } else {
        await setAwayCheckins(editModal.id, newPerMonth, false);
        showToast('Saved');
      }
      setEditModal(null);
      load();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const setUnlimited = async (row) => {
    setBusy(row.id);
    try { await setAwayCheckins(row.id, undefined, !row.unlimited); showToast(row.unlimited ? 'Unlimited off' : 'Set to unlimited'); load(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setBusy(null); }
  };

  const doOffsiteToggle = async (row) => {
    setOffsiteBusy(row.id);
    try {
      const r = await setOffsiteAuth(row.id);
      showToast(r?.data?.revoked
        ? `Removed offsite authorization for ${row.name}`
        : `${row.name} has offsite authorization for today`);
      load();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setOffsiteBusy(null); }
  };

  const grantOffsiteAuth = (row) => {
    if (row.offsiteAuthToday) {
      // Already granted → clicking again revokes it, but confirm first so a stray
      // tap can't silently strip someone's authorization.
      Alert.alert(
        'Remove offsite authorization?',
        `${row.name} will no longer be able to check in from anywhere today, and any away check-in they make will count against their monthly quota.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => doOffsiteToggle(row) },
        ],
      );
      return;
    }
    doOffsiteToggle(row);
  };

  const bulkUnlimited = async () => {
    if (selected.size === 0) return showToast('Select people first', 'error');
    setSaving(true);
    try { const r = await setBulkAwayCheckins(Array.from(selected), undefined, true); showToast(`${r.updated} set unlimited`); exitSelect(); load(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // Live preview: what the card will show after saving
  const previewUsed = editModal?.used ?? 0;
  const previewN = Number(countInput);
  const previewTotal = !editModal?.bulk && countInput !== '' && !isNaN(previewN) ? previewUsed + previewN : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => (selectMode ? exitSelect() : navigation.goBack())} hitSlop={10}>
            <Ionicons name={selectMode ? 'close' : 'chevron-back'} size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.title}>{selectMode ? `${selected.size} selected` : 'Away check-ins'}</Text>
          {!selectMode
            ? <Pressable onPress={() => setSelectMode(true)} hitSlop={10}><Ionicons name="checkbox-outline" size={22} color={COLORS.white} /></Pressable>
            : <View style={{ width: 24 }} />}
        </View>
        <Text style={styles.sub}>By default everyone must check in at the office (or their compulsory location). Give some people a few off-location check-ins per month — or unlimited for field workers.</Text>
      </LinearGradient>

      {selectMode && (
        <View style={styles.bulkBar}>
          <Pressable style={styles.bulkBtn} onPress={openBulkEdit}><Ionicons name="create-outline" size={16} color={COLORS.primary} /><Text style={styles.bulkTxt}>Set count</Text></Pressable>
          <Pressable style={styles.bulkBtn} onPress={bulkUnlimited}><Ionicons name="infinite" size={16} color={COLORS.primary} /><Text style={styles.bulkTxt}>Unlimited</Text></Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {!loading && rows.length === 0 && <Text style={styles.empty}>No people yet.</Text>}

        {rows.map((r) => {
          const isSel = selected.has(r.id);
          return (
            <Pressable key={r.id}
              onPress={selectMode ? () => toggleSelect(r.id) : () => openEdit(r)}
              style={[styles.card, SHADOW.card, isSel && styles.cardSel]}>
              <View style={styles.cardRow}>
                {selectMode && <View style={[styles.check, isSel && styles.checkOn]}>{isSel && <Ionicons name="checkmark" size={13} color={COLORS.white} />}</View>}
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{r.name?.[0]?.toUpperCase() || '?'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name}{r.role === 'admin' ? '  · Admin' : ''}</Text>
                  {r.unlimited ? (
                    <Text style={styles.unlimited}><Ionicons name="infinite" size={12} color={COLORS.success} /> Unlimited — checks in anywhere</Text>
                  ) : (
                    <Text style={styles.usage}>
                      <Text style={{ color: r.remaining > 0 ? COLORS.success : COLORS.danger, fontWeight: '700' }}>{r.remaining}</Text>
                      <Text style={{ color: COLORS.textSoft }}> of {r.perMonth} left this month</Text>
                      {r.usesCompanyDefault ? <Text style={{ color: COLORS.textMute }}> · default</Text> : null}
                    </Text>
                  )}
                  {r.hasCompulsory && <Text style={styles.compulsory}><Ionicons name="navigate" size={10} color={COLORS.textMute} /> Also checks in at {r.compulsoryName}</Text>}
                  {r.offsiteAuthToday && (
                    <Text style={styles.offsiteTag}><Ionicons name="map" size={10} color="#0891B2" /> Offsite authorization · today</Text>
                  )}
                </View>
                {!selectMode && (
                  <View style={styles.btnGroup}>
                    {busy === r.id || offsiteBusy === r.id
                      ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : <>
                          <Pressable onPress={() => setUnlimited(r)} hitSlop={8} style={[styles.infBtn, r.unlimited && styles.infBtnOn]}>
                            <Ionicons name="infinite" size={16} color={r.unlimited ? COLORS.white : COLORS.textSoft} />
                          </Pressable>
                          <Pressable onPress={() => grantOffsiteAuth(r)} hitSlop={8} style={[styles.offsiteBtn, r.offsiteAuthToday && styles.offsiteBtnOn]}>
                            <Ionicons name="map" size={14} color={r.offsiteAuthToday ? COLORS.white : COLORS.textSoft} />
                          </Pressable>
                        </>
                    }
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!editModal} transparent animationType="slide" onRequestClose={() => setEditModal(null)}>
        <View style={[styles.modalRoot, { paddingBottom: kb }]}>
          <Pressable style={styles.backdrop} onPress={() => setEditModal(null)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{editModal?.bulk ? `${selected.size} people` : editModal?.name}</Text>

            {/* For single-person: show the used count so admin knows context */}
            {!editModal?.bulk && editModal?.used != null && (
              <View style={styles.usedBadge}>
                <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.textSoft} />
                <Text style={styles.usedBadgeTxt}>{editModal.used} already used this month</Text>
              </View>
            )}

            <Text style={styles.fieldLbl}>
              {editModal?.bulk ? 'Away check-ins per month (total)' : 'Away check-ins remaining'}
            </Text>
            <TextInput
              style={styles.input}
              value={countInput}
              onChangeText={setCountInput}
              placeholder={editModal?.bulk ? 'e.g. 10' : 'e.g. 8'}
              placeholderTextColor={COLORS.textMute}
              keyboardType="number-pad"
              autoFocus
            />

            {/* Live preview for single-person: show what the card will look like */}
            {previewTotal !== null && (
              <View style={styles.previewRow}>
                <Ionicons name="eye-outline" size={13} color={COLORS.textMute} />
                <Text style={styles.previewTxt}>
                  Will show: <Text style={{ color: previewN > 0 ? COLORS.success : COLORS.danger, fontWeight: '700' }}>{previewN}</Text>
                  <Text style={{ color: COLORS.textSoft }}> of {previewTotal} left this month</Text>
                </Text>
              </View>
            )}

            <Text style={styles.hint}>
              {editModal?.bulk
                ? 'Sets the total monthly allowance for all selected people.'
                : 'How many away check-ins they should have left from today. Their already-used check-ins this month are not affected.'}
            </Text>

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditModal(null)}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={applyCount} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveTxt}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', marginTop: SP.sm, lineHeight: 18 },
  bulkBar: { flexDirection: 'row', gap: SP.sm, padding: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primaryTint, borderRadius: R.md, paddingVertical: SP.md },
  bulkTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '800' },
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  cardSel: { borderColor: COLORS.primary, borderWidth: 1.5, backgroundColor: COLORS.primaryTint },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.textMute, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.primary },
  name: { ...TYPE.title, color: COLORS.text },
  usage: { ...TYPE.cap, marginTop: 2 },
  unlimited: { ...TYPE.cap, color: COLORS.success, marginTop: 2, fontWeight: '600' },
  compulsory: { ...TYPE.cap, fontSize: 11, color: COLORS.textMute, marginTop: 2 },
  infBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  infBtnOn: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  btnGroup: { flexDirection: 'column', gap: 6, alignItems: 'center' },
  offsiteBtn: { width: 38, height: 34, borderRadius: 10, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  offsiteBtnOn: { backgroundColor: '#0891B2', borderColor: '#0891B2' },
  offsiteTag: { ...TYPE.cap, fontSize: 11, color: '#0891B2', marginTop: 2 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xl + SP.md },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.sm },
  usedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SP.md },
  usedBadgeTxt: { ...TYPE.cap, color: COLORS.textSoft },
  fieldLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', marginBottom: 6 },
  input: { ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SP.sm, padding: SP.sm, backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm },
  previewTxt: { ...TYPE.cap, color: COLORS.textMute },
  hint: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm, fontStyle: 'italic', lineHeight: 16 },
  modalBtns: { flexDirection: 'row', gap: SP.sm, marginTop: SP.xl },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
});
