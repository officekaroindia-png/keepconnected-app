import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { getSettings, updateSettings } from '../../api/extra';
import { getCoordsAndAddress } from '../../hooks/useLocation';

const DOW = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];
const toHHMM = (m) => `${String(Math.floor((m ?? 0) / 60)).padStart(2, '0')}:${String((m ?? 0) % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshMe } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [holiday, setHoliday] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const d = await getSettings();
      setS({
        lat: d.officeLocation?.lat != null ? String(d.officeLocation.lat) : '',
        lng: d.officeLocation?.lng != null ? String(d.officeLocation.lng) : '',
        radius: String(d.officeLocation?.radius ?? 150),
        start: toHHMM(d.settings?.shiftStartMinute), end: toHHMM(d.settings?.shiftEndMinute),
        grace: String(d.settings?.graceMinutes ?? 15),
        weeklyOffDay: d.settings?.weeklyOffDay ?? 0,
        nationalHolidays: d.settings?.nationalHolidays || [],
      });
    } catch {}
  }, [isAdmin]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v }));
  const useMyLocation = async () => {
    try { const c = await getCoordsAndAddress(); setS((o) => ({ ...o, lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) })); }
    catch (e) { Alert.alert('Location', e.message); }
  };
  const addHoliday = () => { if (!isDate(holiday)) return Alert.alert('Date', 'Use format YYYY-MM-DD'); setS((o) => ({ ...o, nationalHolidays: [...new Set([...o.nationalHolidays, holiday])].sort() })); setHoliday(''); };
  const removeHoliday = (d) => setS((o) => ({ ...o, nationalHolidays: o.nationalHolidays.filter((x) => x !== d) }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        officeLocation: { lat: s.lat ? Number(s.lat) : null, lng: s.lng ? Number(s.lng) : null, radius: Number(s.radius) || 150 },
        settings: { shiftStartMinute: toMin(s.start), shiftEndMinute: toMin(s.end), graceMinutes: Number(s.grace) || 15, weeklyOffDay: s.weeklyOffDay, nationalHolidays: s.nationalHolidays },
      });
      await refreshMe?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + SP.lg }]}>
          {navigation.canGoBack() && <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>}
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{user?.name?.[0]}</Text></View>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={styles.rolePill}><Text style={styles.roleTxt}>{isAdmin ? 'Admin' : 'Employee'} · {user?.company?.name}</Text></View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.secLabel}>Account</Text>
          <View style={[styles.card, SHADOW.card]}>
            <Row icon="call-outline" label="Mobile" value={user?.mobile} />
            {user?.email && <><Div /><Row icon="mail-outline" label="Email" value={user.email} /></>}
            <Div /><Row icon="business-outline" label="Company" value={user?.company?.name} />
            {isAdmin && <><Div /><Row icon="key-outline" label="Join code" value={user?.company?.joinCode} /></>}
            {isAdmin && <><Div /><Row icon="flash-outline" label="Manage tasks" onPress={() => navigation.navigate('TaskSetup')} /></>}
            {isAdmin && <><Div /><Row icon="shield-checkmark-outline" label="Admins" onPress={() => navigation.navigate('ManageAdmins')} /></>}
          </View>

          {isAdmin && s && <>
            <Text style={styles.secLabel}>Work hours & lateness</Text>
            <View style={[styles.card, SHADOW.card, styles.pad]}>
              <View style={styles.two}>
                <Labeled label="Shift start (HH:MM)"><TextInput style={styles.input} value={s.start} onChangeText={set('start')} placeholder="09:30" placeholderTextColor={COLORS.textMute} /></Labeled>
                <Labeled label="Shift end (HH:MM)"><TextInput style={styles.input} value={s.end} onChangeText={set('end')} placeholder="18:00" placeholderTextColor={COLORS.textMute} /></Labeled>
              </View>
              <Labeled label="Grace window — minutes for 'Little Late' (after this → 'Very Late')">
                <TextInput style={styles.input} value={s.grace} onChangeText={set('grace')} keyboardType="number-pad" />
              </Labeled>
            </View>

            <Text style={styles.secLabel}>Weekly off day</Text>
            <View style={[styles.card, SHADOW.card, styles.pad]}>
              <View style={styles.dowRow}>
                {DOW.map(([lbl, d]) => (
                  <Pressable key={d} onPress={() => set('weeklyOffDay')(d)} style={[styles.dow, s.weeklyOffDay === d && styles.dowOn]}>
                    <Text style={[styles.dowTxt, s.weeklyOffDay === d && styles.dowTxtOn]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.secLabel}>Office location</Text>
            <View style={[styles.card, SHADOW.card, styles.pad]}>
              <Pressable onPress={useMyLocation} style={styles.gpsBtn}><Ionicons name="locate" size={18} color={COLORS.primary} /><Text style={styles.gpsTxt}>Use my current location</Text></Pressable>
              <View style={styles.two}>
                <Labeled label="Latitude"><TextInput style={styles.input} value={s.lat} onChangeText={set('lat')} keyboardType="numbers-and-punctuation" placeholder="—" placeholderTextColor={COLORS.textMute} /></Labeled>
                <Labeled label="Longitude"><TextInput style={styles.input} value={s.lng} onChangeText={set('lng')} keyboardType="numbers-and-punctuation" placeholder="—" placeholderTextColor={COLORS.textMute} /></Labeled>
              </View>
              <Labeled label="Radius (metres)"><TextInput style={styles.input} value={s.radius} onChangeText={set('radius')} keyboardType="number-pad" /></Labeled>
            </View>

            <Text style={styles.secLabel}>National holidays</Text>
            <View style={[styles.card, SHADOW.card, styles.pad]}>
              <View style={styles.addRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={holiday} onChangeText={setHoliday} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
                <Pressable onPress={addHoliday} style={styles.addBtn}><Ionicons name="add" size={22} color={COLORS.white} /></Pressable>
              </View>
              {s.nationalHolidays.map((d) => (
                <View key={d} style={styles.holiday}><Text style={styles.holidayTxt}>{d}</Text><Pressable onPress={() => removeHoliday(d)} hitSlop={8}><Ionicons name="close-circle" size={18} color={COLORS.danger} /></Pressable></View>
              ))}
              {!s.nationalHolidays.length && <Text style={styles.dim}>None added.</Text>}
            </View>

            <Pressable onPress={save} disabled={saving}
              style={({ pressed }) => [styles.saveBtn, SHADOW.lift,
                (pressed || saved) && { backgroundColor: COLORS.success }]}>
              {saving
                ? <ActivityIndicator color={COLORS.white} />
                : saved
                  ? <View style={styles.savedRow}><Ionicons name="checkmark-circle" size={20} color={COLORS.white} /><Text style={styles.saveTxt}>Saved</Text></View>
                  : <Text style={styles.saveTxt}>Save settings</Text>}
            </Pressable>
          </>}

          <View style={[styles.card, SHADOW.card, { marginTop: SP.lg }]}>
            <Row icon="log-out-outline" label="Log out" danger onPress={logout} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
const Row = ({ icon, label, value, onPress, danger }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: COLORS.surfaceAlt }]}>
    <View style={[styles.rowIcon, danger && { backgroundColor: COLORS.dangerTint }]}><Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.primary} /></View>
    <Text style={[styles.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
    {value ? <Text style={styles.rowValue}>{value}</Text> : onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMute} /> : null}
  </Pressable>
);
const Div = () => <View style={styles.div} />;
const Labeled = ({ label, children }) => (<View style={{ flex: 1, marginBottom: SP.sm }}><Text style={styles.lbl}>{label}</Text>{children}</View>);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: 'center', paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  back: { position: 'absolute', left: SP.lg, top: SP.lg, padding: 6, zIndex: 2 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarTxt: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  name: { ...TYPE.h1, color: COLORS.white, marginTop: SP.md },
  rolePill: { marginTop: SP.sm, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.pill },
  roleTxt: { ...TYPE.cap, color: COLORS.white },
  section: { paddingHorizontal: SP.lg, marginTop: SP.lg },
  secLabel: { ...TYPE.cap, color: COLORS.textMute, textTransform: 'uppercase', marginTop: SP.lg, marginBottom: SP.sm, marginLeft: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  pad: { padding: SP.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: R.sm, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, ...TYPE.title, color: COLORS.text }, rowValue: { ...TYPE.body, color: COLORS.textSoft },
  div: { height: 1, backgroundColor: COLORS.border, marginLeft: 58 },
  lbl: { ...TYPE.cap, color: COLORS.textSoft, marginBottom: 6 },
  input: { height: 46, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  two: { flexDirection: 'row', gap: SP.md },
  dowRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dow: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: R.sm, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  dowOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dowTxt: { ...TYPE.label, color: COLORS.textSoft }, dowTxtOn: { color: COLORS.white },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: R.md, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint, marginBottom: SP.md },
  gpsTxt: { ...TYPE.title, fontSize: 15, color: COLORS.primary },
  addRow: { flexDirection: 'row', gap: SP.sm, alignItems: 'center' },
  addBtn: { width: 46, height: 46, borderRadius: R.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  holiday: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  holidayTxt: { ...TYPE.body, color: COLORS.text },
  dim: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm },
  saveBtn: { height: 54, borderRadius: R.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: SP.xl },
  saveTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
