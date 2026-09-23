import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Animated as RNAnimated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getToday, tapTask, myLeaves, mySalary } from '../api/day';
import { useClock } from '../hooks/useClock';
import { getCoordsAndAddress } from '../hooks/useLocation';
import LeaveEmoji from '../components/LeaveEmoji';
import MomentHero from '../components/MomentHero';
import WeatherWidget from '../components/WeatherWidget';
import LateWarningModal from '../components/LateWarningModal';
import SalaryPinModal from '../components/SalaryPinModal';
import { pickDashboardAnimation } from '../utils/dashboardMoments';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

const STATUS = {
  ontime:      { t: 'Present', c: COLORS.success },
  little_late: { t: 'Little late', c: COLORS.warn },
  late:        { t: 'Late', c: COLORS.danger },
  half_day:    { t: 'Half day', c: '#7C3AED' },
  wfh:         { t: 'WFH', c: COLORS.primary },
  wfh_pending: { t: 'WFH · Pending', c: COLORS.warn },
  absent:      { t: 'Absent', c: COLORS.textMute },
  pending:     { t: 'Not in', c: COLORS.textMute },
  off:         { t: 'Off day', c: COLORS.textMute },
  holiday:     { t: 'Holiday', c: COLORS.gold },
};
import { hhmm as _hhmm } from '../utils/timeFormat';
const time = (iso) => iso ? _hhmm(iso) : '—';

export default function ActionsHomeScreen({ navigation, day, loading, reload }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const now = useClock();
  const [tapping, setTapping] = React.useState(null);
  const [leaves, setLeaves] = React.useState(null);
  const [salary, setSalary] = React.useState(null);
  const [dismissedMoment, setDismissedMoment] = React.useState(null);
  const [shownWarningLevel, setShownWarningLevel] = React.useState(0); // which level popup was last shown
  const [warningVisible, setWarningVisible] = React.useState(false);
  const [pinVisible, setPinVisible] = React.useState(false);
  useFocusEffect(useCallback(() => {
    reload?.();
    const now = new Date();
    myLeaves(now.getFullYear(), now.getMonth() + 1).then(setLeaves).catch(() => {});
    mySalary(now.getFullYear(), now.getMonth() + 1).then(setSalary).catch(() => {});
    // Re-lock the salary each time the dashboard is focused — PIN is required every time.
    setPinVisible(false);
  }, [reload]));

  // Live minute-of-day from the ticking clock. Computed BEFORE any early return so the
  // hooks below always run in the same order (React requires stable hook counts).
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Pick the fun animation for right now (morning/late/lunch/sunday) based on the company's
  // configured windows. These hooks MUST be before the early return below.
  const momentType = React.useMemo(() => pickDashboardAnimation(user?.company?.animations || {})?.type || null,
    [Math.floor(nowMin / 5), user?.company?.animations]); // eslint-disable-line
  const moment = React.useMemo(() => {
    if (!momentType || momentType === dismissedMoment) return null;
    return pickDashboardAnimation(user?.company?.animations || {});
  }, [momentType, dismissedMoment]); // eslint-disable-line

  // ---- Late-day popup warning ----
  // Show once per app focus per warning level. Stored in component state so it only
  // fires once per session at each threshold (not every re-render / reload).
  React.useEffect(() => {
    const level = day?.lateWarningLevel ?? 0;
    if (level > 0 && level !== shownWarningLevel) {
      setShownWarningLevel(level);
      setWarningVisible(true);
    }
  }, [day?.lateWarningLevel]);

  // ---- Leave-risk blink logic ----
  // Thresholds come from the leaves payload (admin-configurable in Settings). We warn
  // when the NEXT little-late / very-late will tip over into a deducted leave — i.e. at
  // one below the threshold (e.g. at 5 when the rule is "every 6"). A threshold of 0
  // means that deduction is disabled, so there's nothing to warn about.
  const blinkAnim = React.useRef(new RNAnimated.Value(1)).current;
  const llPer = leaves?.littleLatePerLeave ?? 6;
  const vlPer = leaves?.veryLatePerLeave ?? 3;
  const leaveAtRisk = React.useMemo(() => {
    if (!leaves) return false;
    const llRisk = llPer > 0 && (leaves.littleLate % llPer) === llPer - 1;
    const vlRisk = vlPer > 0 && (leaves.veryLate % vlPer) === vlPer - 1;
    return llRisk || vlRisk;
  }, [leaves, llPer, vlPer]);
  // Per-counter blink: at exactly one-below-threshold, the very next one deducts a leave —
  // so that counter blinks in its own colour.
  const littleLateAtRisk = !!leaves && llPer > 0 && (leaves.littleLate % llPer) === llPer - 1;
  const veryLateAtRisk   = !!leaves && vlPer > 0 && (leaves.veryLate % vlPer) === vlPer - 1;
  React.useEffect(() => {
    if (!leaveAtRisk) { blinkAnim.setValue(1); return; }
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(blinkAnim, { toValue: 0.2, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        RNAnimated.timing(blinkAnim, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [leaveAtRisk]);

  if (loading && !day) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  const st = STATUS[day?.status] || STATUS.pending;
  const prog = day?.taskProgress || { done: 0, total: 0 };

  const allTasks = day?.tasks || [];
  const maxEnd = allTasks.reduce((mx, t) => Math.max(mx, t.window?.end ?? 0), 0);
  // Show the whole task block from midnight until the last task's deadline.
  // Don't show tasks on off days / holidays / Sundays
  const isOffDay = day?.status === 'off' || day?.status === 'holiday';
  const showTasks = allTasks.length > 0 && nowMin <= maxEnd && !isOffDay;
  const fmtMin = (m) => { const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM', hh = h % 12 || 12; return `${hh}:${String(mm).padStart(2, '0')} ${ap}`; };
  const taskState = (t) => {
    if (t.done) return 'done';
    if (nowMin < t.window.start) return 'soon';
    if (nowMin > t.window.end) return 'late';
    return 'open';
  };
  const onTapTask = async (t) => {
    const st = taskState(t);
    if (st === 'soon') return showToast(`Opens at ${fmtMin(t.window.start)}`, 'error');
    if (st === 'late') return showToast("You're too late for this one", 'error');
    if (st === 'done') return;
    setTapping(t.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // STRICT MODE — location is required. If we can't get one, the tap is REFUSED so
      // the person has to move somewhere with signal and try again. Better than saving
      // a locationless tap that admin can never verify.
      let lat, lng, address;
      try { const loc = await getCoordsAndAddress({ strict: false }); lat=loc.lat; lng=loc.lng; address=loc.address; }
      catch (e) {
        const msg = e?.code === 'NO_PERMISSION' ? 'Location permission is off — enable it in Settings and tap again'
                  : e?.code === 'GPS_OFF' ? 'Turn on GPS/Location and tap again'
                  : 'Could not get your location — move to an open area and tap again';
        showToast(msg, 'error');
        return; // do NOT record the tap
      }
      const res = await tapTask(t.id, lat, lng, address);
      if (res.success) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); showToast(`${t.name} · +${t.points}`); reload?.(); }
      else showToast(res.message || 'Could not record', 'error');
    } catch (e) { showToast(e?.response?.data?.message || 'Could not record', 'error'); }
    finally { setTapping(null); }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={COLORS.primary} />}>

        <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + SP.lg }]}>
          {/* Utility row: leaderboard · weather · settings. Weather lives here so the
              brand line below has room to breathe (was cramped 3-in-a-row before). */}
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.navigate('Leaderboard')} hitSlop={8} style={styles.hIcon}><Ionicons name="trophy-outline" size={18} color={COLORS.white} /></Pressable>
            <View style={{ flex: 1 }} />
            <WeatherWidget />
            <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} style={styles.hIcon}><Ionicons name="settings-outline" size={18} color={COLORS.white} /></Pressable>
          </View>

          <View style={styles.brand}>
            {/* Logo + title on one clean line */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="link" size={22} color={COLORS.gold} />
              </View>
              <Text style={styles.brandTitle}>Keep Konnected</Text>
            </View>
            <Text style={styles.brandTagline}>KARO INDIA FOUNDATION INITIATIVE</Text>
            {!!user?.company?.name && (
              <View style={styles.companyPill}>
                <Ionicons name="business" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={styles.companyTxt}>{user.company.name}</Text>
              </View>
            )}
          </View>

          <View style={styles.hairline} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0]}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.clock}>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
              <Text style={styles.today}>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.14)', marginTop: SP.sm }]}>
                <View style={[styles.dot, { backgroundColor: st.c }]} /><Text style={styles.pillTxt}>{st.t}</Text>
              </View>
            </View>
          </View>
          {/* Sunday animation sits exactly where the leave counters normally live.
               On all other days the leave counters show as normal. */}
          {moment?.type === 'sunday' ? (
            <View style={styles.monthWrap}>
              <MomentHero moment={moment} insetTop={0} onDismiss={() => setDismissedMoment(moment.type)} inline />
            </View>
          ) : leaves ? (
            <View style={styles.monthWrap}>
              <LeaveEmoji quota={leaves.quota} balance={leaves.balance} leaveAtRisk={leaveAtRisk} blinkAnim={blinkAnim} />
              <View style={styles.monthHeader}>
                <Ionicons name="calendar" size={16} color={COLORS.gold} />
                <Text style={styles.monthTitle}>This month</Text>
              </View>
              <View style={styles.monthGrid}>
                <View style={styles.monthItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.monthNum}>{leaves.present}</Text>
                  <Text style={styles.monthLbl}>Present</Text>
                </View>
                <View style={styles.monthItem}>
                  <RNAnimated.View style={littleLateAtRisk ? { opacity: blinkAnim } : undefined}>
                    <Ionicons name="time" size={18} color={COLORS.warn} />
                  </RNAnimated.View>
                  <Text style={styles.monthNum}>{leaves.littleLate}</Text>
                  <Text style={styles.monthLbl}>Little late</Text>
                </View>
                <View style={styles.monthItem}>
                  <RNAnimated.View style={veryLateAtRisk ? { opacity: blinkAnim } : undefined}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                  </RNAnimated.View>
                  <Text style={styles.monthNum}>{leaves.veryLate}</Text>
                  <Text style={styles.monthLbl}>Very late</Text>
                </View>
                <View style={styles.monthItem}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  <Text style={styles.monthNum}>{leaves.effectiveAbsent ?? leaves.absent}</Text>
                  <Text style={styles.monthLbl}>Absent</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={[styles.statNum, { color: st.c }]}>{time(day?.checkIn)}</Text><Text style={styles.statLbl}>Check in</Text></View>
            <View style={styles.statDiv} />
            <View style={styles.stat}><Text style={styles.statNum}>{time(day?.checkOut)}</Text><Text style={styles.statLbl}>Check out</Text></View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: COLORS.gold }]}>{leaves?.monthPoints ?? day?.points ?? 0}</Text>
              <Text style={styles.statLbl}>This month</Text>
            </View>
          </View>

          {day?.status === 'half_day' && (
            <View style={[styles.awayChip, { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.4)' }]}>
              <Ionicons name="cut" size={13} color="#C4B5FD" />
              <Text style={[styles.awayTxt, { color: '#C4B5FD' }]}>Half day — 0.5 leave deducted</Text>
            </View>
          )}
          {day?.wfhPending && (
            <View style={[styles.awayChip, { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.4)' }]}>
              <Ionicons name="home" size={13} color={COLORS.warn} />
              <Text style={[styles.awayTxt, { color: COLORS.warn }]}>WFH pending admin approval — hours will be credited once approved</Text>
            </View>
          )}
          {day?.offsiteAuthToday && (
            <View style={[styles.awayChip, { backgroundColor: 'rgba(8,145,178,0.25)', borderColor: 'rgba(103,232,249,0.4)' }]}>
              <Ionicons name="map" size={13} color="#67E8F9" />
              <Text style={[styles.awayTxt, { color: '#CFFAFE' }]}>You are on offsite authorization today · check in from anywhere</Text>
            </View>
          )}
          {day?.awayCheckin?.relevant && !day?.offsiteAuthToday && (
            <View style={styles.awayChip}>
              <Ionicons name="airplane" size={13} color={COLORS.white} />
              {day.awayCheckin.unlimited ? (
                <Text style={styles.awayTxt}>Check in from anywhere · unlimited</Text>
              ) : (
                <Text style={styles.awayTxt}>
                  <Text style={{ fontWeight: '900' }}>{day.awayCheckin.remaining}</Text> away check-in{day.awayCheckin.remaining === 1 ? '' : 's'} left this month
                </Text>
              )}
            </View>
          )}
          {day?.checkinCutoff?.closed && !day?.checkIn && (
            <View style={[styles.awayChip, { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.35)' }]}>
              <Ionicons name="lock-closed" size={13} color="#FCA5A5" />
              <Text style={[styles.awayTxt, { color: '#FCA5A5' }]}>Check-in has closed for today</Text>
            </View>
          )}
        </LinearGradient>
        {!isOffDay && day?.announcement?.body ? (
          <View style={styles.section}>
            <Pressable onPress={() => navigation.navigate('Announcements')} style={({ pressed }) => [styles.annCard, SHADOW.card, pressed && { opacity: 0.92 }]}>
              <View style={styles.annHead}>
                <View style={styles.annIcon}><Ionicons name="megaphone" size={16} color={COLORS.primary} /></View>
                <Text style={styles.annTitle}>Announcement</Text>
                {day.announcementCount > 0 && (
                  <View style={styles.annBadge}><Text style={styles.annBadgeTxt}>{day.announcementCount}</Text></View>
                )}
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMute} />
              </View>
              <Text style={styles.annBody} numberOfLines={4}>{day.announcement.body}</Text>
              <Text style={styles.annMeta}>{day.announcement.authorName || 'Admin'}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Quick view — everyone opens their OWN attendance chart & salary sheet */}
        <View style={styles.section}>
          <View style={styles.quickRow}>
            <Pressable onPress={() => navigation.navigate('AttendanceDashboard', { self: true, name: user?.name })} style={({ pressed }) => [styles.quickBtn, SHADOW.card, pressed && { opacity: 0.9 }]}>
              <View style={[styles.quickIcon, { backgroundColor: COLORS.primaryTint }]}><Ionicons name="stats-chart" size={22} color={COLORS.primary} /></View>
              <Text style={styles.quickTxt} numberOfLines={2}>Attendance Chart</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('MySalarySheet')} style={({ pressed }) => [styles.quickBtn, SHADOW.card, pressed && { opacity: 0.9 }]}>
              <Ionicons name="lock-closed" size={12} color={COLORS.textMute} style={styles.quickLock} />
              <View style={[styles.quickIcon, { backgroundColor: COLORS.goldTint }]}><Ionicons name="document-text" size={22} color={COLORS.gold} /></View>
              <Text style={styles.quickTxt} numberOfLines={2}>Salary Sheet</Text>
            </Pressable>
          </View>
          {/* Second row — Old Timelines + Staff Status (admin only) */}
          <View style={[styles.quickRow, { marginTop: SP.md }]}>
            <Pressable
              onPress={() => user?.role === 'admin'
                ? navigation.navigate('StaffTimelines')
                : navigation.navigate('StaffMonthly', { id: user?._id || user?.id, name: user?.name, selfView: true })}
              style={({ pressed }) => [styles.quickBtn, SHADOW.card, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="calendar-outline" size={22} color="#7C3AED" />
              </View>
              <Text style={styles.quickTxt} numberOfLines={2}>Old Timelines</Text>
            </Pressable>
            {user?.role === 'admin' && (
              <Pressable
                onPress={() => navigation.navigate('StaffStatus')}
                style={({ pressed }) => [styles.quickBtn, SHADOW.card, pressed && { opacity: 0.9 }]}
              >
                <View style={[styles.quickIcon, { backgroundColor: COLORS.successTint }]}>
                  <Ionicons name="people" size={22} color={COLORS.success} />
                </View>
                <Text style={styles.quickTxt} numberOfLines={2}>Staff Status</Text>
              </Pressable>
            )}
            {user?.role !== 'admin' && <View style={{ flex: 1 }} />}
          </View>
        </View>



        {!isOffDay && (
        <View style={styles.section}>
          {showTasks && (
            <View style={styles.tasksBlock}>
              <Text style={styles.tasksHead}>My Tasks</Text>
              {allTasks.map((t) => {
                const st = taskState(t);
                // Hide cards once their own deadline is past AND they weren't completed —
                // no need to show a "too late" tombstone on the dashboard. Done cards stay
                // visible for the rest of the day so the person can see their progress.
                if (st === 'late') return null;
                const busy = tapping === t.id;
                return (
                  <Pressable key={t.id} onPress={() => onTapTask(t)} disabled={busy || st !== 'open'}
                    style={({ pressed }) => [
                      styles.taskBtn, SHADOW.card,
                      st === 'done' && styles.taskDone,
                      st === 'open' && styles.taskOpen,
                      st === 'soon' && styles.taskLocked,
                      pressed && st === 'open' && { opacity: 0.9 },
                    ]}>
                    <View style={[styles.taskIcon,
                      st === 'done' && { backgroundColor: COLORS.successTint },
                      st === 'soon' && { backgroundColor: COLORS.surfaceAlt }]}>
                      <Ionicons
                        name={st === 'done' ? 'checkmark-circle' : st === 'soon' ? 'time-outline' : (t.icon || 'ellipse-outline')}
                        size={20}
                        color={st === 'done' ? COLORS.success : st === 'open' ? COLORS.primary : COLORS.textMute} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskName, st === 'soon' && { color: COLORS.textMute }]}>{t.name}</Text>
                      <Text style={styles.taskSub}>
                        {st === 'done' ? 'Done · nice one!'
                          : st === 'soon' ? `Opens at ${fmtMin(t.window.start)}`
                          : `Open till ${fmtMin(t.window.end)}`}
                      </Text>
                    </View>
                    {busy ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : st === 'done' ? <Ionicons name="checkmark-done" size={20} color={COLORS.success} />
                      : st === 'open' ? <View style={styles.taskPts}><Text style={styles.taskPtsTxt}>+{t.points}</Text></View>
                      : <Ionicons name="hourglass-outline" size={18} color={COLORS.textMute} />}
                  </Pressable>
                );
              })}
              {/* If every task's deadline has passed AND none are done, the block
                  effectively empties — surface a friendly line so it doesn't look broken. */}
              {allTasks.every((t) => taskState(t) === 'late') && (
                <Text style={styles.note}>That's all your tasks for today — see you tomorrow.</Text>
              )}
            </View>
          )}

          {!showTasks && (
            <Text style={styles.note}>{allTasks.length === 0 ? 'No tasks set up yet.' : "That's all your tasks for today — see you tomorrow."}</Text>
          )}
        </View>
        )}
      </ScrollView>

      {/* The Actions trigger — opens the "What do you want to do?" sheet */}

      <LateWarningModal
        level={shownWarningLevel}
        visible={warningVisible}
        onDismiss={() => setWarningVisible(false)}
      />

      <SalaryPinModal
        visible={pinVisible}
        purpose="view your salary"
        onClose={() => setPinVisible(false)}
        onUnlocked={() => setPinVisible(false)}
      />
    </View>
  );
}
const Counter = ({ n, label, c }) => (
  <View style={styles.counter}><Text style={[styles.counterN, { color: c }]}>{n}</Text><Text style={styles.counterL}>{label}</Text></View>
);
const styles = StyleSheet.create({
  monthWrap: { paddingTop: SP.sm, paddingBottom: SP.md, marginBottom: SP.md, alignItems: 'stretch' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SP.sm, marginBottom: SP.md },
  monthTitle: { ...TYPE.cap, color: 'rgba(255,255,255,0.85)', fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  monthGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  monthItem: { alignItems: 'center', flex: 1, gap: 2 },
  monthNum: { fontSize: 20, fontWeight: '800', color: COLORS.white, fontVariant: ['tabular-nums'] },
  monthLbl: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  monthDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: SP.sm },
  leaveStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: SP.sm, marginTop: SP.md },
  leaveChip: { flex: 1, flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: R.md, paddingVertical: SP.sm, gap: 2 },
  leaveChipDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  leaveChipNum: { fontSize: 18, fontWeight: '800', color: COLORS.white, fontVariant: ['tabular-nums'] },
  leaveChipLbl: { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  tasksBlock: { marginTop: SP.md },
  tasksHead: { ...TYPE.title, color: COLORS.text, marginBottom: SP.sm },
  taskBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  taskIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  taskName: { ...TYPE.title, color: COLORS.text },
  taskSub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  taskDone: { backgroundColor: COLORS.successTint, borderColor: '#A7F3C0' },
  taskOpen: { borderColor: COLORS.primary, borderWidth: 1.5 },
  taskLocked: { opacity: 0.7 },
  taskPts: { backgroundColor: COLORS.goldTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  taskPtsTxt: { ...TYPE.cap, color: COLORS.gold, fontWeight: '800' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SP.sm, marginBottom: SP.sm },
  annIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  annBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  annBadgeTxt: { color: COLORS.white, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  quickRow: { flexDirection: 'row', gap: SP.md },
  quickBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: R.lg, paddingVertical: SP.lg, paddingHorizontal: SP.sm, borderWidth: 1, borderColor: COLORS.border, minHeight: 98 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickTxt: { ...TYPE.title, fontSize: 13, color: COLORS.text, textAlign: 'center', lineHeight: 17 },
  quickLock: { position: 'absolute', top: 10, right: 10 },
  brand: { alignItems: 'center', marginTop: SP.xs },
  logoBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.xs },
  brandTitle: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  leaveWrap: { alignItems: 'center' },
  brandTagline: { fontSize: 10.5, color: COLORS.gold, fontWeight: '800', letterSpacing: 1.8, marginTop: 5 },
  companyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.md, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill },
  companyTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '700' },
  rightCol: { alignItems: 'flex-end' },
  clock: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  today: { ...TYPE.cap, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  hairline: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: SP.lg },
  hIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  pillRow: { alignSelf: 'flex-start', marginTop: SP.md, flexDirection: 'row' },
  countersRow: { flexDirection: 'row', gap: SP.md, marginTop: SP.md },
  counter: { flex: 1, backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, padding: SP.md, alignItems: 'center' },
  counterN: { fontSize: 22, fontWeight: '800' },
  counterL: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  annCard: { backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, padding: SP.lg, marginTop: SP.md },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SP.sm },
  annTitle: { flex: 1, ...TYPE.title, color: COLORS.text },
  annBody: { ...TYPE.body, color: COLORS.textSoft, lineHeight: 20 },
  annMeta: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm },
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SP.md },
  hello: { ...TYPE.label, color: 'rgba(255,255,255,0.65)' },
  name: { ...TYPE.h1, color: COLORS.white, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillTxt: { ...TYPE.cap, color: COLORS.white },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: SP.md },
  awayChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SP.sm, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  awayTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '600' },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  statNum: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  statLbl: { ...TYPE.cap, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  section: { paddingHorizontal: SP.lg, marginTop: SP.lg },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border },
  progressTxt: { ...TYPE.body, color: COLORS.textSoft },
  note: { ...TYPE.body, color: COLORS.textMute, marginTop: SP.lg, lineHeight: 20 },
});
