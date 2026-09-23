import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getLeaderboard } from '../../api/extra';
import { colleagueDirectory } from '../../api/day';
import { useAuth } from '../../context/AuthContext';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const minutesOf = (r) => {
  if (r == null) return 0;
  if (typeof r.workedMinutes === 'number') return r.workedMinutes;
  if (typeof r.minutes === 'number') return r.minutes;
  return Math.round((Number(r.hours) || 0) * 60);
};
const fmtHM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const dial = (mobile, name) => {
  const num = String(mobile || '').replace(/[^\d+]/g, '');
  if (num.replace(/\D/g, '').length < 7) {
    Alert.alert('No number saved', `${name || 'This person'} has no mobile number on their profile yet.`);
    return;
  }
  Linking.openURL(`tel:${num}`).catch(() =>
    Alert.alert('Could not open the dialler', 'Your device blocked the call.'));
};

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phones, setPhones] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getLeaderboard(ym.y, ym.m)); } catch {} finally { setLoading(false); }
  }, [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    let alive = true;
    colleagueDirectory()
      .then((list) => {
        if (!alive) return;
        const map = {};
        (list || []).forEach((p) => { if (p?.id != null) map[String(p.id)] = p.mobile; });
        setPhones(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []));

  const shift = (d) => setYm(({ y, m }) => {
    let nm = m + d, ny = y;
    if (nm < 1) { nm = 12; ny--; }
    if (nm > 12) { nm = 1; ny++; }
    return { y: ny, m: nm };
  });

  const isAdmin = user?.role === 'admin';
  const openPerson = (r) => {
    if (isAdmin) navigation.navigate('StaffMonthly', { id: r.id, name: r.name });
    else if (r.id === user?.id) navigation.navigate('StaffMonthly', { id: user._id || user.id, name: user.name });
  };

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
  const pillHours = isCurrentMonth ? (data?.expectedHoursSoFar ?? null) : (data?.targetHours ?? null);
  const pillDays  = isCurrentMonth ? (data?.workingDaysDone ?? null)    : (data?.workingDays ?? null);

  // Always sort by hours
  const rows = React.useMemo(() => {
    const list = [...(data?.rows || [])];
    list.sort((a, b) => {
      const am = minutesOf(a), bm = minutesOf(b);
      const ap = Number(a.points) || 0, bp = Number(b.points) || 0;
      if (bm !== am) return bm - am;
      if (bp !== ap) return bp - ap;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return list;
  }, [data]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          {navigation.canGoBack()
            ? <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
            : <View style={{ width: 24 }} />}
          <Text style={styles.title}>Leaderboard</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} style={styles.navBtn}><Text style={styles.navTxt}>‹ Prev</Text></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.month}>{MONTHS[ym.m]}</Text>
            <Text style={styles.byTxt}>{isCurrentMonth ? 'This month' : String(ym.y)}</Text>
          </View>
          <Pressable onPress={() => shift(1)} style={styles.navBtn}><Text style={styles.navTxt}>Next ›</Text></Pressable>
        </View>

        <View style={styles.totalPill}>
          <Ionicons name="time-outline" size={15} color={COLORS.ink} />
          <Text style={styles.totalTxt}>
            {pillHours != null ? `${pillHours}h` : '—'}
            {pillDays != null ? `  ·  ${pillDays} day${pillDays !== 1 ? 's' : ''} worked` : ''}
          </Text>
        </View>

        {data?.targetHours != null && (
          <View style={styles.goalPill}>
            <Ionicons name="flag" size={13} color={COLORS.gold} />
            <Text style={styles.goalTxt}>Monthly target: {data.targetHours}h · {data.workingDays} working days</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        {/* Column headers */}
        <View style={[styles.rowHead, SHADOW.card]}>
          <Text style={styles.hRank}>#</Text>
          <Text style={[styles.hName, { flex: 1 }]}>Name</Text>
          <Text style={[styles.hCol, { width: 70 }]}>Hours</Text>
          <Text style={[styles.hCol, { width: 46 }]}>Pts</Text>
          <Text style={[styles.hCol, { width: 38, textAlign: 'center' }]}>Call</Text>
        </View>

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {rows.map((r, idx) => {
          const tappable = isAdmin || r.id === user?.id;
          const isMe = r.id === user?.id;
          const mins = minutesOf(r);
          const pts = Number(r.points) || 0;
          const mobile = r.mobile || phones[String(r.id)] || null;

          return (
            <Pressable
              key={r.id}
              onPress={() => openPerson(r)}
              disabled={!tappable}
              style={({ pressed }) => [styles.row, SHADOW.card, isMe && styles.rowMe, pressed && tappable && { opacity: 0.9 }]}
            >
              {/* Rank badge */}
              <View style={[styles.rankBadge, idx === 0 && styles.rankGold, idx === 1 && styles.rankSilver, idx === 2 && styles.rankBronze]}>
                <Text style={[styles.rankTxt, idx < 3 && { color: COLORS.white }]}>{idx + 1}</Text>
              </View>

              {/* Name only — no progress bar */}
              <Text style={[styles.name, { flex: 1 }, isMe && { color: COLORS.primary }]} numberOfLines={1}>{r.name}</Text>

              {/* Hours */}
              <View style={[styles.metricCol, { width: 70 }]}>
                <Text style={styles.metricNum}>{fmtHM(mins)}</Text>
                <Text style={styles.metricSub}>worked</Text>
              </View>

              {/* Points */}
              <View style={[styles.metricCol, { width: 46 }]}>
                <Text style={[styles.metricNum, { color: pts > 0 ? COLORS.gold : COLORS.textMute }]}>
                  {pts > 0 ? pts : '—'}
                </Text>
                <Text style={styles.metricSub}>pts</Text>
              </View>

              {/* Call */}
              <Pressable
                onPress={() => dial(mobile, r.name)}
                hitSlop={8}
                style={({ pressed }) => [styles.callBtn, !mobile && styles.callBtnOff, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="call" size={15} color={mobile ? COLORS.white : COLORS.textMute} />
              </Pressable>

              {tappable && <Ionicons name="chevron-forward" size={15} color={COLORS.textMute} style={{ marginLeft: 2 }} />}
            </Pressable>
          );
        })}

        {!loading && !rows.length && <Text style={styles.dim}>No data for this month.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.md },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.sm },
  navTxt: { ...TYPE.label, color: COLORS.white },
  month: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  byTxt: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)' },
  totalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, marginTop: SP.md },
  totalTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '700' },
  goalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, marginTop: SP.sm },
  goalTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '700' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  hRank: { ...TYPE.title, color: COLORS.textSoft, width: 28 },
  hName: { ...TYPE.title, color: COLORS.text },
  hCol: { ...TYPE.title, color: COLORS.textSoft, textAlign: 'right', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  rowMe: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rankGold:   { backgroundColor: '#F59E0B' },
  rankSilver: { backgroundColor: '#94A3B8' },
  rankBronze: { backgroundColor: '#B45309' },
  rankTxt: { ...TYPE.title, fontSize: 13, color: COLORS.textSoft },
  name: { ...TYPE.title, color: COLORS.text },
  metricCol: { alignItems: 'flex-end' },
  metricNum: { ...TYPE.title, fontSize: 14, color: COLORS.text, fontVariant: ['tabular-nums'] },
  metricSub: { ...TYPE.cap, fontSize: 10, color: COLORS.textMute, marginTop: 1 },
  callBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  callBtnOff: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30 },
});
