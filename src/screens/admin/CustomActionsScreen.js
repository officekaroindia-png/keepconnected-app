import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { listCustomActions, addCustomAction, updateCustomAction, deleteCustomAction } from '../../api/admin';
import { getCoordsAndAddress } from '../../hooks/useLocation';
import { resolveMapLink } from '../../api/extra';
import { Clipboard } from 'react-native';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const ICONS = ['location-outline', 'home-outline', 'business-outline', 'cafe-outline', 'car-outline', 'bag-outline', 'construct-outline', 'people-outline', 'flag-outline', 'navigate-outline'];

export default function CustomActionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('location-outline');
  const [radius, setRadius] = useState('100');
  const [coord, setCoord] = useState(null);

  const load = useCallback(async () => { try { setItems(await listCustomActions()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => { setName(''); setIcon('location-outline'); setRadius('100'); setCoord(null); setAdding(false); setEditKey(null); };

  const openEdit = (it) => {
    setEditKey(it.key); setName(it.name); setIcon(it.icon);
    setRadius(String(it.radius)); setCoord({ lat: it.lat, lng: it.lng }); setAdding(true);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try { const { lat, lng } = await getCoordsAndAddress(); setCoord({ lat, lng }); }
    catch (e) { Alert.alert('Location', e.message || 'Could not get your location'); }
    finally { setLocating(false); }
  };
  const pickOnMap = () => navigation.navigate('MapPicker', { initial: coord, onPick: (c) => setCoord(c) });

  const parseGoogleMapsUrl = (url) => {
    if (!url) return null;
    let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return null;
  };
  const [linkPasting, setLinkPasting] = useState(false);
  const pasteGoogleMapsLink = async () => {
    setLinkPasting(true);
    try {
      let text = '';
      try { text = await Clipboard.getString(); } catch { text = ''; }
      if (!text?.trim()) { Alert.alert('Nothing to paste', 'Copy a Google Maps link first.'); return; }
      const trimmed = text.trim();
      let parsed = parseGoogleMapsUrl(trimmed);
      if (!parsed && (trimmed.includes('goo.gl') || trimmed.includes('maps.app'))) {
        try { const r = await resolveMapLink(trimmed); if (r?.finalUrl) parsed = parseGoogleMapsUrl(r.finalUrl); } catch {}
      }
      if (!parsed) { Alert.alert('Could not read location', 'Copy the link from Google Maps → Share → Copy link.'); return; }
      setCoord(parsed);
    } catch (e) { Alert.alert('Error', e?.message || 'Failed'); }
    finally { setLinkPasting(false); }
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name', 'Enter an action name');
    if (!coord) return Alert.alert('Location', 'Set a location — use current location or pick on the map');
    setSaving(true);
    const body = { name: name.trim(), icon, lat: coord.lat, lng: coord.lng, radius: Number(radius) || 100 };
    try {
      if (editKey) await updateCustomAction(editKey, body);
      else await addCustomAction(body);
      reset(); load();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const remove = (it) => Alert.alert('Delete action', `Remove "${it.name}"?`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCustomAction(it.key); load(); } }]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Custom actions</Text><View style={{ width: 24 }} />
        </View>
        <Text style={styles.sub}>Location actions like "At Office" — a tap only counts when the person is within the radius you set.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 + kb }} keyboardShouldPersistTaps="handled">
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {items.map((it) => (
          <Pressable key={it.key} onPress={() => openEdit(it)} style={[styles.card, SHADOW.card]}>
            <View style={styles.cIcon}><Ionicons name={it.icon} size={20} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{it.name}</Text>
              <Text style={styles.cMeta}>within {it.radius} m · {it.lat.toFixed(4)}, {it.lng.toFixed(4)}</Text>
            </View>
            <Pressable onPress={() => openEdit(it)} hitSlop={8} style={{ padding: 6 }}><Ionicons name="create-outline" size={20} color={COLORS.textSoft} /></Pressable>
            <Pressable onPress={() => remove(it)} hitSlop={8} style={{ padding: 6 }}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></Pressable>
          </Pressable>
        ))}
        {!loading && !items.length && !adding && <Text style={styles.dim}>No custom actions yet.</Text>}

        {!adding ? (
          <Pressable onPress={() => setAdding(true)} style={[styles.addBtn, SHADOW.card]}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} /><Text style={styles.addTxt}>Add a custom action</Text>
          </Pressable>
        ) : (
          <View style={[styles.form, SHADOW.card]}>
            <Text style={styles.formTitle}>{editKey ? 'Edit action' : 'New action'}</Text>

            <Text style={styles.lbl}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. At Home" placeholderTextColor={COLORS.textMute} />

            <Text style={styles.lbl}>Icon</Text>
            <View style={styles.iconRow}>
              {ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconPick, icon === ic && styles.iconPickOn]}>
                  <Ionicons name={ic} size={20} color={icon === ic ? COLORS.white : COLORS.textSoft} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.lbl}>Location</Text>
            <Pressable onPress={pasteGoogleMapsLink} disabled={linkPasting} style={[styles.locOpt, { backgroundColor: '#FEF3C7', flex: 0, width: '100%', marginBottom: 8 }]}>
              {linkPasting ? <ActivityIndicator size="small" color="#D97706" /> : <Ionicons name="logo-google" size={17} color="#D97706" />}
              <Text style={[styles.locOptTxt, { color: '#D97706' }]}>Paste Google Maps link</Text>
            </Pressable>
            <View style={styles.locRow}>
              <Pressable onPress={useMyLocation} style={[styles.locOpt, { backgroundColor: COLORS.primaryTint }]}>
                {locating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="locate" size={17} color={COLORS.primary} />}
                <Text style={[styles.locOptTxt, { color: COLORS.primary }]}>Current location</Text>
              </Pressable>
              <Pressable onPress={pickOnMap} style={[styles.locOpt, { backgroundColor: '#E0F2F1' }]}>
                <Ionicons name="map" size={17} color="#0E7490" /><Text style={[styles.locOptTxt, { color: '#0E7490' }]}>Pick on map</Text>
              </Pressable>
            </View>
            {coord && <Text style={styles.coordSet}>✓ Location set: {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}</Text>}

            <Text style={styles.lbl}>Radius (metres)</Text>
            <TextInput style={styles.input} value={radius} onChangeText={setRadius} keyboardType="number-pad" placeholder="100" placeholderTextColor={COLORS.textMute} />

            <View style={styles.formBtns}>
              <Pressable onPress={reset} style={styles.cancelBtn}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, SHADOW.lift]}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveTxt}>{editKey ? 'Save changes' : 'Save action'}</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: SP.sm, lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  cIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  cName: { ...TYPE.title, color: COLORS.text },
  cMeta: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginVertical: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', marginTop: SP.sm },
  addTxt: { ...TYPE.title, fontSize: 15, color: COLORS.primary },
  form: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border, marginTop: SP.sm },
  formTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.sm },
  lbl: { ...TYPE.cap, color: COLORS.textSoft, marginBottom: 6, marginTop: SP.md },
  input: { height: 48, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconPick: { width: 44, height: 44, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  iconPickOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  locRow: { flexDirection: 'row', gap: SP.sm },
  locOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: R.md },
  locOptTxt: { ...TYPE.cap, fontWeight: '800' },
  coordSet: { ...TYPE.cap, color: COLORS.success, marginTop: SP.sm, fontWeight: '700' },
  formBtns: { flexDirection: 'row', gap: SP.md, marginTop: SP.lg },
  cancelBtn: { flex: 1, height: 50, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft },
  saveBtn: { flex: 1.4, height: 50, borderRadius: R.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white },
});
