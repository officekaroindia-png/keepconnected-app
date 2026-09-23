import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getTimeline, colleagueTimeline } from '../../api/day';
import { useAuth } from '../../context/AuthContext';
import EventAddress from '../../components/EventAddress';
import { hhmm } from '../../utils/timeFormat';

// Icon + colour per event type (mirrors the admin StaffTimeline styling).
const EV = {
  checkin:    { icon: 'log-in', c: COLORS.success, label: 'Checked In' },
  atoffice:   { icon: 'business', c: '#0E7490', label: 'At Office' },
  checkout:   { icon: 'log-out', c: COLORS.danger, label: 'Checked Out' },
  reached:    { icon: 'flag', c: COLORS.success, label: 'Reached' },
  leaving:    { icon: 'walk', c: COLORS.warn, label: 'Leaving' },
  wfh:        { icon: 'home', c: COLORS.primary, label: 'Work From Home' },
  remove_wfh: { icon: 'briefcase', c: COLORS.textSoft, label: 'Back to work' },
  lunch:      { icon: 'restaurant', c: COLORS.warn, label: 'Lunch' },
  lunch_in:   { icon: 'restaurant', c: COLORS.warn, label: 'Lunch In' },
  lunch_out:  { icon: 'fast-food-outline', c: COLORS.textSoft, label: 'Lunch Out' },
  absent:     { icon: 'close-circle', c: COLORS.danger, label: 'Absent' },
  half_day:   { icon: 'cut', c: '#7C3AED', label: 'Half Day' },
  overtime:   { icon: 'time', c: '#7C3AED', label: 'Overtime' },
};

const fmtTotal = (m) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—');
const fmtDist = (m) => (m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} kms` : `${Math.round(m)} mts`);
const DIST_FACTOR = 1.6;
const fmtDistTotal = (m) => { if (m == null) return '0 mts'; const a = m * DIST_FACTOR; return a >= 1000 ? `${(a / 1000).toFixed(1)} kms` : `${Math.round(a)} mts`; };

const prettyDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Open the dialler with the number filled in.
const dial = (mobile, name) => {
  const num = String(mobile || '').replace(/[^\d+]/g, '');
  if (num.replace(/\D/g, '').length < 7) {
    Alert.alert('No number saved', `There is no mobile number on ${name || 'this person'}'s profile yet.`);
    return;
  }
  Linking.openURL(`tel:${num}`).catch(() =>
    Alert.alert('Could not open the dialler', 'Your device blocked the call. Try dialling the number manually.'));
};

// Opened two ways:
//   { date }                     -> my own day  (unchanged behaviour)
//   { date, id, name, mobile }   -> a teammate's day, read-only, from Staff Status
export default function MyDayTimelineScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { date, id, name, mobile } = route.params || {};
  const myId = String(user?._id || user?.id || '');
  const isColleague = !!id && String(id) !== myId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(isColleague ? await colleagueTimeline(id, date) : await getTimeline(date));
    } catch { /* keep */ }
    finally { setLoading(false); }
  }, [date, id, isColleague]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const events = (data?.events || []);
  const who = isColleague ? (name || data?.name || 'Teammate') : 'My Timeline';

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title} numberOfLines={1}>{who}</Text>
          {isColleague
            ? <Pressable onPress={() => dial(mobile, who)} hitSlop={10} style={styles.callBtn} accessibilityRole="button" accessibilityLabel={`Call ${who}`}>
                <Ionicons name="call" size={17} color={COLORS.white} />
              </Pressable>
            : <View style={{ width: 24 }} />}
        </View>
        <Text style={styles.dateTxt}>{prettyDate(date || data?.date)}</Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}><Ionicons name="time-outline" size={15} color={COLORS.white} /><Text style={styles.pillTxt}>{fmtTotal(data?.totalMinutes)}</Text></View>
          <View style={styles.pill}><Ionicons name="navigate-outline" size={15} color={COLORS.white} /><Text style={styles.pillTxt}>{fmtDistTotal(data?.totalMeters)}</Text></View>
        </View>
        {data?.awayInfo && (data.awayInfo.used > 0 || data.awayInfo.allowed > 0 || data.awayInfo.unlimited) && (
          <View style={styles.awayBar}>
            <Ionicons name="airplane" size={13} color="#DDD6FE" />
            <Text style={styles.awayBarTxt}>
              Away check-ins this month: {data.awayInfo.used} used{data.awayInfo.unlimited ? ' · unlimited' : ` · ${data.awayInfo.remaining} left of ${data.awayInfo.allowed}`}
            </Text>
          </View>
        )}
        {data?.offsiteAuthToday && (
          <View style={styles.offsiteBar}>
            <Ionicons name="map" size={13} color="#67E8F9" />
            <Text style={styles.offsiteBarTxt}>Offsite authorization today · check-in from anywhere · no away count used</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && events.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.textMute} />
            <Text style={styles.emptyTxt}>{isColleague ? `${who} has no activity recorded on this day.` : 'No activity recorded on this day.'}</Text>
          </View>
        )}

        {!loading && events.map((e, i) => {
          let ev = EV[e.type] || (String(e.type).startsWith('ca_')
            ? { icon: e.icon || 'location', c: COLORS.primary, label: e.name || 'Location' }
            : { icon: 'ellipse', c: COLORS.textMute, label: e.type });
          // An off-location "away" check-in reads as its own thing, not a normal check-in.
          if (e.type === 'checkin' && e.away) ev = { icon: 'airplane', c: '#7C3AED', label: 'Away Check-in' };
          const last = i === events.length - 1;
          return (
            <View key={i} style={styles.row}>
              <View style={styles.timeCol}><Text style={styles.time}>{hhmm(e.at)}</Text></View>
              <View style={styles.railCol}>
                <View style={[styles.dot, { backgroundColor: ev.c }]}><Ionicons name={ev.icon} size={13} color={COLORS.white} /></View>
                {!last && <View style={styles.line} />}
              </View>
              <View style={styles.body}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: ev.c }]}>{ev.label}</Text>
                  {e.byAdmin && <View style={styles.adminTag}><Ionicons name="build" size={10} color={COLORS.textSoft} /><Text style={styles.adminTagTxt}>by admin</Text></View>}
                </View>
                {(e.address || (e.lat != null && e.lng != null)) && <EventAddress address={e.address} lat={e.lat} lng={e.lng} style={styles.addr} />}
                {e.distance != null && e.distance > 0 && <Text style={styles.dist}>Distance: {fmtDist(e.distance)}</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white, flex: 1, textAlign: 'center', marginHorizontal: SP.sm },
  callBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  dateTxt: { ...TYPE.title, fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: SP.sm },
  pillRow: { flexDirection: 'row', justifyContent: 'center', gap: SP.md, marginTop: SP.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 7 },
  pillTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  awayBar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: SP.sm, backgroundColor: 'rgba(124,58,237,0.25)', borderWidth: 1, borderColor: 'rgba(221,214,254,0.4)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 },
  awayBarTxt: { ...TYPE.cap, fontSize: 11, color: '#EDE9FE', fontWeight: '700' },
  offsiteBar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: SP.sm, backgroundColor: 'rgba(8,145,178,0.25)', borderWidth: 1, borderColor: 'rgba(103,232,249,0.4)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 },
  offsiteBarTxt: { ...TYPE.cap, fontSize: 11, color: '#CFFAFE', fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTxt: { ...TYPE.body, color: COLORS.textMute },
  row: { flexDirection: 'row', gap: SP.sm },
  timeCol: { width: 58, paddingTop: 2 },
  time: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', fontVariant: ['tabular-nums'] },
  railCol: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: SP.lg },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { ...TYPE.title, fontSize: 15 },
  adminTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.surfaceAlt, borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border },
  adminTagTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textSoft },
  addr: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 3, lineHeight: 16 },
  dist: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2, fontVariant: ['tabular-nums'] },
});
