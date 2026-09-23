import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SP, R, TYPE, SHADOW, fmtMin } from '../../theme/theme';
import { getSettings, updateSettings } from '../../api/extra';
import { useToast } from '../../context/ToastContext';

const minToDate = (m) => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
const dateToMin = (d) => d.getHours() * 60 + d.getMinutes();

// The window-based animations (each needs a time slot). Sunday & weather are automatic.
// Weekend is omitted for now — no animation provided yet.
const SLOTS = [
  { key: 'morning', label: 'Morning greeting', icon: 'sunny', desc: 'Cheerful good-morning animation + line', color: '#F59E0B' },
  { key: 'late',    label: 'Running late',      icon: 'alarm',  desc: 'Shows when someone opens the app late', color: '#EF4444' },
  { key: 'lunch',   label: 'Lunch time',        icon: 'restaurant', desc: 'Food animation during the lunch window', color: '#F97316' },
];

export default function AnimationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [anim, setAnim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null); // { key, edge: 'start'|'end' }

  const load = useCallback(async () => {
    try {
      const s = await getSettings();
      // Merge with defaults so missing keys don't crash the UI.
      const a = s?.animations || {};
      setAnim({
        morning: { enabled: a.morning?.enabled ?? true, start: a.morning?.start ?? 360, end: a.morning?.end ?? 600 },
        late:    { enabled: a.late?.enabled ?? true,    start: a.late?.start ?? 660,    end: a.late?.end ?? 720 },
        lunch:   { enabled: a.lunch?.enabled ?? true,   start: a.lunch?.start ?? 780,   end: a.lunch?.end ?? 900 },
        weekend: { enabled: a.weekend?.enabled ?? false,start: a.weekend?.start ?? 960, end: a.weekend?.end ?? 1140 },
        weather: { enabled: a.weather?.enabled ?? true },
      });
    } catch (e) { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Check the ENABLED window animations for overlap. Returns [{a,b}] pairs that clash.
  const overlaps = useMemo(() => {
    if (!anim) return [];
    const active = SLOTS.map((s) => s.key).filter((k) => anim[k]?.enabled);
    const clashes = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const A = anim[active[i]], B = anim[active[j]];
        // Overlap if A.start < B.end AND B.start < A.end
        if (A.start < B.end && B.start < A.end) clashes.push([active[i], active[j]]);
      }
    }
    return clashes;
  }, [anim]);

  const onPick = (event, date) => {
    const p = picker; setPicker(null);
    if (!p || event.type === 'dismissed' || !date) return;
    const mins = dateToMin(date);
    setAnim((prev) => {
      const cur = { ...prev[p.key] };
      if (p.edge === 'start') {
        if (mins >= cur.end) { Alert.alert('Invalid time', 'Start must be before end.'); return prev; }
        cur.start = mins;
      } else {
        if (mins <= cur.start) { Alert.alert('Invalid time', 'End must be after start.'); return prev; }
        cur.end = mins;
      }
      return { ...prev, [p.key]: cur };
    });
  };

  const save = async () => {
    if (overlaps.length > 0) {
      const [a, b] = overlaps[0];
      const la = SLOTS.find((s) => s.key === a)?.label;
      const lb = SLOTS.find((s) => s.key === b)?.label;
      return Alert.alert('Times overlap', `“${la}” and “${lb}” share the same time. Only one animation can play at a time — adjust their windows so they don’t overlap.`);
    }
    setSaving(true);
    try {
      await updateSettings({ animations: anim });
      showToast('Animations saved');
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const isClashing = (key) => overlaps.some(([a, b]) => a === key || b === key);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Fun animations</Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveHdr}>Save</Text>}
          </Pressable>
        </View>
        <Text style={styles.sub}>Set when each animation shows on everyone’s dashboard. Only one plays at a time — windows can’t overlap.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {anim && SLOTS.map((slot) => {
          const w = anim[slot.key];
          const clash = w.enabled && isClashing(slot.key);
          return (
            <View key={slot.key} style={[styles.card, SHADOW.card, clash && styles.cardClash]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: slot.color + '22' }]}>
                  <Ionicons name={slot.icon} size={20} color={slot.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{slot.label}</Text>
                  <Text style={styles.cardDesc}>{slot.desc}</Text>
                </View>
                <Switch
                  value={w.enabled}
                  onValueChange={(v) => setAnim((prev) => ({ ...prev, [slot.key]: { ...prev[slot.key], enabled: v } }))}
                  trackColor={{ true: slot.color }}
                />
              </View>

              {slot.needsFile && (
                <Text style={styles.fileNote}><Ionicons name="information-circle" size={12} color={COLORS.textSoft} /> Uses a placeholder until you add your weekend animation file.</Text>
              )}

              {w.enabled && (
                <View style={styles.timeRow}>
                  <Pressable style={styles.timeBtn} onPress={() => setPicker({ key: slot.key, edge: 'start' })}>
                    <Ionicons name="time-outline" size={14} color={COLORS.textSoft} />
                    <Text style={styles.timeLbl}>From</Text>
                    <Text style={styles.timeVal}>{fmtMin(w.start)}</Text>
                  </Pressable>
                  <Pressable style={styles.timeBtn} onPress={() => setPicker({ key: slot.key, edge: 'end' })}>
                    <Ionicons name="time-outline" size={14} color={COLORS.textSoft} />
                    <Text style={styles.timeLbl}>Until</Text>
                    <Text style={styles.timeVal}>{fmtMin(w.end)}</Text>
                  </Pressable>
                </View>
              )}
              {clash && <Text style={styles.clashTxt}>⚠️ Overlaps another animation — adjust the window</Text>}
            </View>
          );
        })}

        {/* Sunday & Weather — automatic */}
        {anim && (
          <>
            <Text style={styles.sectionLbl}>Automatic</Text>
            <View style={[styles.card, SHADOW.card]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: '#6366F122' }]}><Ionicons name="moon" size={20} color="#6366F1" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Sunday sleepy cat</Text>
                  <Text style={styles.cardDesc}>Shows automatically all day every Sunday</Text>
                </View>
                <View style={styles.autoBadge}><Text style={styles.autoTxt}>Auto</Text></View>
              </View>
            </View>
            <View style={[styles.card, SHADOW.card]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: '#0EA5E922' }]}><Ionicons name="partly-sunny" size={20} color="#0EA5E9" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Weather widget</Text>
                  <Text style={styles.cardDesc}>Live weather at your office location. Rain shows a rain animation.</Text>
                </View>
                <Switch
                  value={anim.weather.enabled}
                  onValueChange={(v) => setAnim((prev) => ({ ...prev, weather: { enabled: v } }))}
                  trackColor={{ true: '#0EA5E9' }}
                />
              </View>
              <Text style={styles.fileNote}><Ionicons name="location" size={12} color={COLORS.textSoft} /> Set your office location in Settings for accurate weather.</Text>
            </View>
          </>
        )}
      </ScrollView>

      {picker && (
        <DateTimePicker
          value={minToDate(anim[picker.key][picker.edge])}
          mode="time" is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPick}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  saveHdr: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', marginTop: SP.sm, lineHeight: 18 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  cardClash: { borderColor: COLORS.danger, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...TYPE.title, color: COLORS.text },
  cardDesc: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2, lineHeight: 15 },
  timeRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md },
  timeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, borderWidth: 1, borderColor: COLORS.border },
  timeLbl: { ...TYPE.cap, color: COLORS.textSoft },
  timeVal: { ...TYPE.label, color: COLORS.text, marginLeft: 'auto', fontWeight: '800', fontVariant: ['tabular-nums'] },
  clashTxt: { ...TYPE.cap, color: COLORS.danger, marginTop: SP.sm, fontWeight: '600' },
  fileNote: { ...TYPE.cap, fontSize: 11, color: COLORS.textMute, marginTop: SP.sm, fontStyle: 'italic' },
  sectionLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SP.lg, marginBottom: SP.sm },
  autoBadge: { backgroundColor: COLORS.surfaceAlt, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  autoTxt: { ...TYPE.cap, fontSize: 10, color: COLORS.textSoft, fontWeight: '800' },
});
