import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
  RefreshControl, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffStatus, setCompulsoryLocation } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

// Compulsory locations: a place an employee MUST check in at daily.
// The name they type here becomes the "Check in at <name>" label the employee sees.
export default function CompulsoryLocationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { showToast } = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // The edit modal state. When non-null, the modal is open.
  //   { person, name, coord: {lat,lng} | null, radius }
  // We keep this on the screen (not inside the modal) so that navigating away to
  // MapPicker and back doesn't lose whatever the admin already typed.
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    try { const d = await staffStatus(); setStaff(d.staff || []); }
    catch (e) { showToast(e?.response?.data?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (person) => {
    const loc = person.compulsoryLocation;
    setEdit({
      person,
      name: loc?.name || '',
      coord: (loc && typeof loc.lat === 'number') ? { lat: loc.lat, lng: loc.lng } : null,
      radius: loc?.radius || 100,
    });
  };
  const closeEdit = () => setEdit(null);

  // Push MapPicker with a callback that ONLY updates state — we're still mounted
  // below the map in the stack, so setEdit here safely re-renders the modal with
  // the new coord when the user returns. No Alert.prompt, no hidden async gotchas.
  const pickOnMap = () => {
    if (!edit) return;
    navigation.navigate('MapPicker', {
      initial: edit.coord,
      onPick: (coord) => setEdit((prev) => (prev ? { ...prev, coord } : prev)),
    });
  };

  const save = async () => {
    if (!edit) return;
    const name = (edit.name || '').trim();
    if (!name) return showToast('Give this location a name', 'error');
    if (!edit.coord) return showToast('Pick the location on the map', 'error');
    setBusy(edit.person.id);
    try {
      await setCompulsoryLocation(edit.person.id, {
        name, lat: edit.coord.lat, lng: edit.coord.lng, radius: Number(edit.radius) || 100,
      });
      showToast(`Saved · ${edit.person.name.split(' ')[0]} must check in at ${name}`);
      closeEdit();
      load();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.message || 'Please try again');
    } finally { setBusy(null); }
  };

  const clear = (person) => {
    Alert.alert('Remove location?', `${person.name} will no longer have a compulsory check-in spot.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(person.id);
        try { await setCompulsoryLocation(person.id, {}); showToast('Removed'); load(); }
        catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        finally { setBusy(null); }
      } },
    ]);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Compulsory locations</Text><View style={{ width: 24 }} />
        </View>
        <Text style={styles.sub}>Assign a location an employee must check in at daily (e.g. your home for drivers). The name you give will show as "Check in at ___" in their app.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {!loading && staff.length === 0 && <Text style={styles.empty}>No employees yet.</Text>}
        {staff.map((p) => {
          const loc = p.compulsoryLocation;
          return (
            <View key={p.id} style={[styles.card, SHADOW.card]}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{p.name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                {loc?.name ? (
                  <Text style={styles.locSet}>Check in at <Text style={{ fontWeight: '800' }}>{loc.name}</Text> · {loc.radius || 100}m</Text>
                ) : (
                  <Text style={styles.locNone}>No compulsory location</Text>
                )}
              </View>
              {busy === p.id ? <ActivityIndicator size="small" color={COLORS.primary} /> : <>
                <Pressable onPress={() => openEdit(p)} hitSlop={8} style={styles.btn}>
                  <Ionicons name={loc ? 'create-outline' : 'add-circle-outline'} size={20} color={COLORS.primary} />
                </Pressable>
                {loc && <Pressable onPress={() => clear(p)} hitSlop={8} style={styles.btn}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.danger} />
                </Pressable>}
              </>}
            </View>
          );
        })}
      </ScrollView>

      {/* Edit modal — name input, coord display, save/cancel */}
      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={[styles.modalRoot, { paddingBottom: kb }]}>
          <Pressable style={styles.backdrop} onPress={closeEdit} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Compulsory location</Text>
            <Text style={styles.sheetSub}>for {edit?.person?.name}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={edit?.name ?? ''}
              onChangeText={(t) => setEdit((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="e.g. Home, Office, Site A, Warehouse"
              placeholderTextColor={COLORS.textMute}
              autoFocus
              returnKeyType="done"
              maxLength={40}
            />
            <Text style={styles.hint}>This shows in their app as "Check in at {edit?.name?.trim() || '<name>'}"</Text>

            <Text style={styles.label}>Location</Text>
            <Pressable style={styles.mapBtn} onPress={pickOnMap}>
              <Ionicons name={edit?.coord ? 'checkmark-circle' : 'map-outline'} size={20} color={edit?.coord ? COLORS.success : COLORS.primary} />
              <View style={{ flex: 1 }}>
                {edit?.coord ? (
                  <>
                    <Text style={styles.mapBtnTxt}>Location pinned</Text>
                    <Text style={styles.coord}>{edit.coord.lat.toFixed(5)}, {edit.coord.lng.toFixed(5)}</Text>
                  </>
                ) : (
                  <Text style={styles.mapBtnTxt}>Pick on map</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMute} />
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable style={styles.cancelBtn} onPress={closeEdit}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable
                style={[styles.saveBtn, (!edit?.name?.trim() || !edit?.coord || busy) && { opacity: 0.5 }]}
                onPress={save}
                disabled={!edit?.name?.trim() || !edit?.coord || !!busy}>
                {busy ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name="checkmark" size={18} color={COLORS.white} /><Text style={styles.saveTxt}>Save</Text></>}
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
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.primary },
  name: { ...TYPE.title, color: COLORS.text },
  locSet: { ...TYPE.cap, color: COLORS.success, marginTop: 2, fontWeight: '600' },
  locNone: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  btn: { padding: 8 },

  // Modal
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xl + SP.md },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text },
  sheetSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2, marginBottom: SP.lg },
  label: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: SP.md },
  input: { ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  hint: { ...TYPE.cap, fontSize: 11, color: COLORS.textMute, marginTop: 6, fontStyle: 'italic' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  mapBtnTxt: { ...TYPE.title, color: COLORS.text },
  coord: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2, fontVariant: ['tabular-nums'] },
  actionsRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.xl },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft, fontWeight: '700' },
  saveBtn: { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
});
