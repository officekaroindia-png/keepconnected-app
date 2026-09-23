import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
  RefreshControl, Modal, TextInput, Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import {
  staffStatus, listCheckinSpots, createCheckinSpot, updateCheckinSpot,
  deleteCheckinSpot, setCheckinSpotEmployees,
} from '../../api/admin';
import { resolveMapLink } from '../../api/extra';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

// Predefined check-in spots. The office is always valid for everyone; these are extra
// named locations, each assigned to a set of employees (bulk-assignable). An assigned
// person may check in at the office OR any of their spots.
export default function CheckinSpotsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { showToast } = useToast();
  const [spots, setSpots] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Add/edit spot modal:  { id?, name, coord:{lat,lng}|null, radius }
  const [spotModal, setSpotModal] = useState(null);
  // Assign-people modal:  { spotId, spotName, selected:Set<id> }
  const [peopleModal, setPeopleModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [sp, st] = await Promise.all([listCheckinSpots(), staffStatus()]);
      setSpots(sp || []);
      setStaff((st?.staff || []).map((s) => ({ id: String(s.id), name: s.name })));
    } catch (e) { showToast(e?.response?.data?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ---- Google Maps link parser ----
  // Extracts lat/lng from any Google Maps URL format.
  const parseGoogleMapsUrl = (url) => {
    if (!url) return null;
    // Format 1: @lat,lng  (most common in share links)
    let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    // Format 2: ?q=lat,lng
    m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    // Format 3: /place/.../@lat,lng or ll=lat,lng
    m = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    // Format 4: maps/search/lat,lng
    m = url.match(/\/search\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return null;
  };

  const [linkPasting, setLinkPasting] = useState(false);

  const pasteGoogleMapsLink = async () => {
    setLinkPasting(true);
    try {
      // Read from clipboard
      let text = '';
      try { text = await Clipboard.getString(); } catch { text = ''; }

      if (!text?.trim()) {
        Alert.alert('Nothing to paste', 'Copy a Google Maps link first, then tap this button.');
        return;
      }

      const trimmed = text.trim();

      // Try to parse directly first (works for most share links)
      let coord = parseGoogleMapsUrl(trimmed);

      // If not found and it looks like a short link, resolve via backend
      if (!coord && (trimmed.includes('goo.gl') || trimmed.includes('maps.app'))) {
        try {
          const result = await resolveMapLink(trimmed);
          if (result?.finalUrl) coord = parseGoogleMapsUrl(result.finalUrl);
        } catch { /* will show error below */ }
      }

      if (!coord) {
        Alert.alert(
          'Could not read location',
          'Make sure you copy the link from Google Maps → Share → Copy link. The link should look like:\nmaps.app.goo.gl/... or google.com/maps/...'
        );
        return;
      }

      // Got coords — update the modal
      setSpotModal((prev) => prev ? { ...prev, coord } : prev);

    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to read clipboard');
    } finally {
      setLinkPasting(false);
    }
  };

  // ---- Spot add/edit ----
  const openAdd = () => setSpotModal({ name: '', coord: null, radius: 150 });
  const openEdit = (s) => setSpotModal({ id: s.id, name: s.name, coord: { lat: s.lat, lng: s.lng }, radius: s.radius || 150 });
  const closeSpot = () => setSpotModal(null);

  const pickOnMap = () => {
    if (!spotModal) return;
    navigation.navigate('MapPicker', {
      initial: spotModal.coord,
      onPick: (coord) => setSpotModal((prev) => (prev ? { ...prev, coord } : prev)),
    });
  };

  const saveSpot = async () => {
    if (!spotModal) return;
    const name = (spotModal.name || '').trim();
    if (!name) return showToast('Give this spot a name', 'error');
    if (!spotModal.coord) return showToast('Pick the spot on the map', 'error');
    setBusy(true);
    try {
      const payload = { name, lat: spotModal.coord.lat, lng: spotModal.coord.lng, radius: Number(spotModal.radius) || 150 };
      if (spotModal.id) await updateCheckinSpot(spotModal.id, payload);
      else await createCheckinSpot(payload);
      showToast(spotModal.id ? 'Spot updated' : `Spot "${name}" added`);
      closeSpot();
      load();
    } catch (e) { Alert.alert('Could not save', e?.response?.data?.message || 'Please try again'); }
    finally { setBusy(false); }
  };

  const removeSpot = (s) => {
    Alert.alert('Delete spot?', `"${s.name}" will be removed and its people will lose this check-in spot.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCheckinSpot(s.id); showToast('Spot deleted'); load(); }
        catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
      } },
    ]);
  };

  // ---- People assignment (bulk) ----
  const openPeople = (s) => setPeopleModal({ spotId: s.id, spotName: s.name, selected: new Set((s.employeeIds || []).map(String)) });
  const closePeople = () => setPeopleModal(null);
  const togglePerson = (id) => setPeopleModal((prev) => {
    if (!prev) return prev;
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });
  const allSelected = peopleModal && staff.length > 0 && staff.every((s) => peopleModal.selected.has(s.id));
  const toggleAll = () => setPeopleModal((prev) => {
    if (!prev) return prev;
    const all = staff.every((s) => prev.selected.has(s.id));
    return { ...prev, selected: all ? new Set() : new Set(staff.map((s) => s.id)) };
  });
  const savePeople = async () => {
    if (!peopleModal) return;
    setBusy(true);
    try {
      await setCheckinSpotEmployees(peopleModal.spotId, [...peopleModal.selected]);
      showToast(`${peopleModal.selected.size} assigned to ${peopleModal.spotName}`);
      closePeople();
      load();
    } catch (e) { Alert.alert('Could not save', e?.response?.data?.message || 'Please try again'); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Check-in spots</Text>
          <Pressable onPress={openAdd} hitSlop={10}><Ionicons name="add-circle" size={26} color={COLORS.white} /></Pressable>
        </View>
        <Text style={styles.sub}>The office is a check-in spot for everyone. Add extra spots here (sites, warehouses, a home) and assign people — they can then check in at the office or any of their spots.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && spots.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="location-outline" size={44} color={COLORS.textMute} />
            <Text style={styles.emptyTitle}>No extra spots yet</Text>
            <Text style={styles.emptyMsg}>The office already works for everyone. Add a spot for people who check in elsewhere.</Text>
            <Pressable onPress={openAdd} style={styles.emptyBtn}>
              <Ionicons name="add" size={18} color={COLORS.white} /><Text style={styles.emptyBtnTxt}>Add a spot</Text>
            </Pressable>
          </View>
        )}

        {spots.map((s) => (
          <View key={s.id} style={[styles.card, SHADOW.card]}>
            <View style={styles.cardTop}>
              <View style={styles.spotIcon}><Ionicons name="location" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.spotName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.spotMeta}>{s.radius || 150}m radius · {(s.employeeIds || []).length} {(s.employeeIds || []).length === 1 ? 'person' : 'people'}</Text>
              </View>
              <Pressable onPress={() => openEdit(s)} hitSlop={8} style={styles.iconBtn}><Ionicons name="create-outline" size={20} color={COLORS.primary} /></Pressable>
              <Pressable onPress={() => removeSpot(s)} hitSlop={8} style={styles.iconBtn}><Ionicons name="trash-outline" size={19} color={COLORS.danger} /></Pressable>
            </View>
            {(s.employeeNames || []).length > 0 && (
              <Text style={styles.assignedTxt} numberOfLines={2}>{s.employeeNames.join(', ')}</Text>
            )}
            <Pressable onPress={() => openPeople(s)} style={styles.peopleBtn}>
              <Ionicons name="people" size={16} color={COLORS.primary} />
              <Text style={styles.peopleBtnTxt}>{(s.employeeIds || []).length ? 'Manage people' : 'Assign people'}</Text>
              <Ionicons name="chevron-forward" size={15} color={COLORS.textMute} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit spot modal */}
      <Modal visible={!!spotModal} transparent animationType="slide" onRequestClose={closeSpot}>
        <View style={[styles.modalRoot, { paddingBottom: kb }]}>
          <Pressable style={styles.backdrop} onPress={closeSpot} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{spotModal?.id ? 'Edit spot' : 'New check-in spot'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={spotModal?.name ?? ''}
              onChangeText={(t) => setSpotModal((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="e.g. Warehouse, Site A, Boss's home"
              placeholderTextColor={COLORS.textMute}
              autoFocus
              returnKeyType="done"
              maxLength={60}
            />

            <Text style={styles.label}>Location</Text>

            {/* Paste from Google Maps */}
            <Pressable
              onPress={pasteGoogleMapsLink}
              disabled={linkPasting}
              style={({ pressed }) => [styles.pasteBtn, pressed && { opacity: 0.8 }]}
            >
              {linkPasting
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name="logo-google" size={17} color={COLORS.primary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.pasteTxt}>Paste Google Maps link</Text>
                <Text style={styles.pasteSub}>Copy a location in Google Maps → Share → Copy link, then tap here</Text>
              </View>
              {spotModal?.coord
                ? <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                : <Ionicons name="clipboard-outline" size={18} color={COLORS.textMute} />}
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} /><Text style={styles.orTxt}>or pick manually</Text><View style={styles.orLine} />
            </View>

            <Pressable style={styles.mapBtn} onPress={pickOnMap}>
              <Ionicons name={spotModal?.coord ? 'checkmark-circle' : 'map-outline'} size={20} color={spotModal?.coord ? COLORS.success : COLORS.primary} />
              <View style={{ flex: 1 }}>
                {spotModal?.coord
                  ? <><Text style={styles.mapBtnTxt}>Location pinned</Text><Text style={styles.coord}>{spotModal.coord.lat.toFixed(5)}, {spotModal.coord.lng.toFixed(5)}</Text></>
                  : <Text style={styles.mapBtnTxt}>Search or pick on map</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMute} />
            </Pressable>

            <Text style={styles.label}>Radius (metres)</Text>
            <View style={styles.radiusRow}>
              {[100, 150, 300, 500].map((r) => (
                <Pressable key={r} onPress={() => setSpotModal((prev) => (prev ? { ...prev, radius: r } : prev))}
                  style={[styles.radiusChip, Number(spotModal?.radius) === r && styles.radiusChipOn]}>
                  <Text style={[styles.radiusTxt, Number(spotModal?.radius) === r && styles.radiusTxtOn]}>{r}m</Text>
                </Pressable>
              ))}
              <TextInput
                style={styles.radiusInput}
                value={String(spotModal?.radius ?? '')}
                onChangeText={(t) => setSpotModal((prev) => (prev ? { ...prev, radius: t.replace(/[^0-9]/g, '') } : prev))}
                keyboardType="number-pad" placeholder="Custom" placeholderTextColor={COLORS.textMute} maxLength={4}
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.cancelBtn} onPress={closeSpot}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable
                style={[styles.saveBtn, (!spotModal?.name?.trim() || !spotModal?.coord || busy) && { opacity: 0.5 }]}
                onPress={saveSpot}
                disabled={!spotModal?.name?.trim() || !spotModal?.coord || busy}>
                {busy ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name="checkmark" size={18} color={COLORS.white} /><Text style={styles.saveTxt}>Save spot</Text></>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign-people modal (bulk) */}
      <Modal visible={!!peopleModal} transparent animationType="slide" onRequestClose={closePeople}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closePeople} />
          <View style={[styles.sheet, { maxHeight: '82%' }]}>
            <View style={styles.grabber} />
            <View style={styles.peopleHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Assign people</Text>
                <Text style={styles.sheetSub}>to {peopleModal?.spotName} · {peopleModal?.selected.size || 0} selected</Text>
              </View>
              <Pressable onPress={toggleAll} style={styles.selectAllBtn}>
                <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={16} color={COLORS.primary} />
                <Text style={styles.selectAllTxt}>{allSelected ? 'None' : 'All'}</Text>
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: SP.sm }} keyboardShouldPersistTaps="handled">
              {staff.length === 0 && <Text style={styles.empty}>No employees yet.</Text>}
              {staff.map((p) => {
                const on = peopleModal?.selected.has(p.id);
                return (
                  <Pressable key={p.id} onPress={() => togglePerson(p.id)} style={styles.personRow}>
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on && <Ionicons name="checkmark" size={15} color={COLORS.white} />}
                    </View>
                    <View style={styles.pAvatar}><Text style={styles.pAvatarTxt}>{p.name?.[0]?.toUpperCase() || '?'}</Text></View>
                    <Text style={styles.personName} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.actionsRow, { paddingBottom: insets.bottom + SP.sm }]}>
              <Pressable style={styles.cancelBtn} onPress={closePeople}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={[styles.saveBtn, busy && { opacity: 0.5 }]} onPress={savePeople} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name="checkmark" size={18} color={COLORS.white} /><Text style={styles.saveTxt}>Save ({peopleModal?.selected.size || 0})</Text></>}
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
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30 },
  emptyBox: { alignItems: 'center', marginTop: 50, paddingHorizontal: SP.lg },
  emptyTitle: { ...TYPE.h2, color: COLORS.text, marginTop: SP.md },
  emptyMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: SP.lg },
  emptyBtnTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white },

  card: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  spotIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  spotName: { ...TYPE.title, fontSize: 16, color: COLORS.text },
  spotMeta: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  iconBtn: { padding: 6 },
  assignedTxt: { ...TYPE.cap, color: COLORS.textSoft, marginTop: SP.sm, lineHeight: 17 },
  peopleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: 11, marginTop: SP.md, borderWidth: 1, borderColor: COLORS.border },
  peopleBtnTxt: { ...TYPE.title, fontSize: 14, color: COLORS.primary },

  // Modals
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xl },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text },
  sheetSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2 },
  label: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: SP.md },
  input: { ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  mapBtnTxt: { ...TYPE.title, color: COLORS.text },
  coord: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2, fontVariant: ['tabular-nums'] },
  radiusRow: { flexDirection: 'row', gap: SP.sm, alignItems: 'center', flexWrap: 'wrap' },
  radiusChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  radiusChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radiusTxt: { ...TYPE.title, fontSize: 14, color: COLORS.textSoft },
  radiusTxtOn: { color: COLORS.white },
  radiusInput: { minWidth: 76, ...TYPE.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 8, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.xl },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft, fontWeight: '700' },
  saveBtn: { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },

  // People picker
  peopleHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 },
  selectAllTxt: { ...TYPE.cap, fontWeight: '800', color: COLORS.primary },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  pAvatarTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft },
  personName: { flex: 1, ...TYPE.title, fontSize: 15, color: COLORS.text },

  // Paste link feature
  pasteBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.primaryTint, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.primary + '44', paddingHorizontal: SP.md, paddingVertical: SP.md },
  pasteTxt: { ...TYPE.title, fontSize: 14, color: COLORS.primary },
  pasteSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2, lineHeight: 16 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: SP.sm, marginBottom: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orTxt: { ...TYPE.cap, color: COLORS.textMute, fontWeight: '700' },
});
