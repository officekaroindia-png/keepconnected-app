import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { mySalary, getSalaryPinQuestion } from '../../api/day';
import SalaryPinModal from '../../components/SalaryPinModal';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// How many working days have passed so far this month (including today)
function workingDaysSoFar(year, month) {
  const today = new Date();
  const lastDay = today.getFullYear() === year && today.getMonth() + 1 === month
    ? today.getDate()
    : new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0) count++; // exclude Sundays
  }
  return count;
}

function totalWorkingDays(year, month) {
  const last = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0) count++;
  }
  return count;
}

// Progress ring using a simple arc via border trick
const ProgressRing = ({ pct, size = 90, strokeWidth = 8, color }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: 'rgba(255,255,255,0.2)',
        position: 'absolute',
      }} />
      <View style={{
        width: size - strokeWidth * 2,
        height: size - strokeWidth * 2,
        borderRadius: (size - strokeWidth * 2) / 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        position: 'absolute',
      }} />
    </View>
  );
};

const StatChip = ({ icon, label, value, accent }) => (
  <View style={[styles.statChip, accent && styles.statChipAccent]}>
    <Ionicons name={icon} size={16} color={accent ? COLORS.white : COLORS.primary} />
    <Text style={[styles.statVal, accent && { color: COLORS.white }]}>{value}</Text>
    <Text style={[styles.statLbl, accent && { color: 'rgba(255,255,255,0.8)' }]}>{label}</Text>
  </View>
);

const InfoRow = ({ label, value, sub, danger, success, strong, highlight }) => (
  <View style={[styles.infoRow, highlight && styles.infoRowHL]}>
    <Text style={[styles.infoLbl, strong && { color: COLORS.text, fontWeight: '800' }]}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[
        styles.infoVal,
        danger && { color: COLORS.danger },
        success && { color: COLORS.success },
        strong && { fontSize: 18, color: COLORS.text },
        highlight && { color: COLORS.primary, fontWeight: '900' },
      ]}>{value}</Text>
      {sub ? <Text style={styles.infoSub}>{sub}</Text> : null}
    </View>
  </View>
);

const Divider = () => <View style={styles.div} />;

const SectionHeader = ({ icon, title, color }) => (
  <View style={styles.sectionHead}>
    <View style={[styles.sectionIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
  </View>
);

export default function MySalarySheetScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [unlocked, setUnlocked] = useState(false);
  const [sqPrompt, setSqPrompt] = useState(false);   // true = show "set up security questions" banner
  const [sqChecked, setSqChecked] = useState(false); // so we only check once per session
  const [pinVisible, setPinVisible] = useState(true);
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    setUnlocked(false);
    setPinVisible(true);
    setData(null);
    // Re-evaluate the "set up security questions" prompt on every visit: reset the
    // one-shot guard and hide any stale banner until the fresh check runs after unlock.
    // This is what makes the banner reappear each time until questions are set, and
    // disappear immediately once the user sets them up and returns.
    setSqChecked(false);
    setSqPrompt(false);
    return () => {};
  }, []));

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await mySalary(ym.year, ym.month)); }
    catch { /* keep */ }
    finally { setLoading(false); }
  }, [ym]);

  React.useEffect(() => { if (unlocked) load(); }, [unlocked, ym, load]);

  const stepMonth = (dir) => {
    setYm((prev) => {
      const d = new Date(prev.year, prev.month - 1 + dir, 1);
      if (dir > 0 && (d.getFullYear() > now.getFullYear() ||
        (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth()))) return prev;
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const isCurrentMonth = ym.year === now.getFullYear() && ym.month === now.getMonth() + 1;

  // Derived "till date" values
  const doneWorkingDays = isCurrentMonth ? workingDaysSoFar(ym.year, ym.month) : null;
  const totalWorkDays = totalWorkingDays(ym.year, ym.month);
  const totalCalDays = new Date(ym.year, ym.month, 0).getDate();

  let salaryTillDate = null;
  let tillDatePct = 0;
  if (data && isCurrentMonth && data.salary) {
    const todayDate = now.getDate();
    salaryTillDate = Math.round((data.salary / totalCalDays) * todayDate);
    // After deductions
    const deductedTillDate = Math.max(0, salaryTillDate - (data.deduction || 0));
    salaryTillDate = deductedTillDate;
    tillDatePct = Math.round((todayDate / totalCalDays) * 100);
  }

  const progressPct = data && data.salary
    ? Math.min(100, Math.round(((data.payable || 0) / data.salary) * 100))
    : 0;

  // Allowance shown = base + excused + any carried-over leaves (carry-over mode).
  const allowedShown = data ? (data.effectiveAllowed ?? data.allowedLeaves ?? 0) : 0;
  const carried = data?.carriedLeaves || 0;

  return (
    <View style={styles.root}>
      {/* ── HEADER ── */}
      <LinearGradient
        colors={['#0B1F3A', '#1D4ED8', '#2563EB']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 6 }]}
      >
        {/* Top bar */}
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>My Salary Sheet</Text>
            {unlocked && data && (
              <Text style={styles.headerSub}>{MONTHS[ym.month]} {ym.year}</Text>
            )}
          </View>
          <Pressable onPress={() => navigation.navigate('ChangeSalaryPin')} hitSlop={12}
            style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            accessibilityRole="button" accessibilityLabel="Change salary PIN">
            <Ionicons name="key-outline" size={18} color={COLORS.gold} />
          </Pressable>
        </View>

        {/* Month Nav (only when unlocked) */}
        {unlocked && (
          <View style={styles.monthNav}>
            <Pressable onPress={() => stepMonth(-1)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={COLORS.white} />
            </Pressable>
            <Text style={styles.monthLbl}>{MONTHS[ym.month]} {ym.year}</Text>
            <Pressable
              onPress={() => stepMonth(1)}
              style={[styles.navBtn, isCurrentMonth && { opacity: 0.3 }]}
              disabled={isCurrentMonth}
            >
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
            </Pressable>
          </View>
        )}

        {/* Big salary hero (only when unlocked & data loaded) */}
        {unlocked && !loading && data && (
          <View style={styles.heroBlock}>
            <View style={styles.heroLeft}>
              {isCurrentMonth && salaryTillDate != null ? (
                <>
                  <Text style={styles.heroCaption}>Monthly Payable</Text>
                  <Text style={styles.heroAmt}>{rupee(data.payable)}</Text>
                  {/* Secondary: till today shown small */}
                  <View style={styles.monthlySub}>
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.65)" />
                    <Text style={styles.monthlySubTxt}>
                      Till today: {rupee(salaryTillDate)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.heroCaption}>Payable</Text>
                  <Text style={styles.heroAmt}>{rupee(data.payable)}</Text>
                </>
              )}
              {data.deduction > 0 && (
                <View style={styles.deductBadge}>
                  <Ionicons name="arrow-down" size={11} color={COLORS.danger} />
                  <Text style={styles.deductBadgeTxt}>
                    {rupee(data.deduction)} deducted
                  </Text>
                </View>
              )}
              {!data.deduction && (
                <View style={styles.fullBadge}>
                  <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
                  <Text style={styles.fullBadgeTxt}>Full inclusive salary</Text>
                </View>
              )}
            </View>

            {/* Circular progress indicator */}
            <View style={styles.heroRight}>
              <View style={styles.circleWrap}>
                <View style={[styles.circleOuter, {
                  borderColor: progressPct >= 100
                    ? COLORS.success
                    : progressPct >= 70
                      ? COLORS.gold
                      : COLORS.danger,
                }]}>
                  <Text style={styles.circleVal}>{progressPct}%</Text>
                  <Text style={styles.circleSub}>earned</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── LOCKED STATE ── */}
      {!unlocked ? (
        <View style={styles.lockedBox}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.lockedTitle}>Salary is PIN protected</Text>
          <Text style={styles.lockedMsg}>Enter your 4–6 digit PIN to view your salary details.</Text>
          <Pressable onPress={() => setPinVisible(true)} style={styles.unlockBtn}>
            <Ionicons name="keypad" size={16} color={COLORS.white} />
            <Text style={styles.unlockTxt}>Enter PIN</Text>
          </Pressable>
          <Pressable onPress={() => { setPinVisible(false); navigation.navigate('ChangeSalaryPin'); }}
            hitSlop={8} style={styles.pinLink}>
            <Ionicons name="key-outline" size={14} color={COLORS.primary} />
            <Text style={styles.pinLinkTxt}>Forgot PIN? Reset it here</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SP.lg, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={[styles.dimTxt, { marginTop: 12 }]}>Loading your salary…</Text>
            </View>
          )}

          {/* ── NO SALARY SET ── */}
          {!loading && !data && (
            <View style={[styles.emptyCard, SHADOW.card]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cash-outline" size={36} color={COLORS.textMute} />
              </View>
              <Text style={styles.emptyTitle}>No salary set</Text>
              <Text style={styles.emptyMsg}>Your admin hasn't configured a salary for you yet. Check back later.</Text>
            </View>
          )}

          {!loading && data && (
            <>
              {/* ── CARD 1: Current Month Summary ── */}
              <View style={[styles.card, SHADOW.card, { marginBottom: SP.md }]}>
                <SectionHeader icon="stats-chart" title="Earnings Overview" color={COLORS.primary} />

                <InfoRow
                  label={data.isOverridden ? 'Final payable (admin set)' : 'Monthly salary'}
                  value={rupee(data.payable)}
                  sub={data.isOverridden ? 'Amount fixed by your admin' : 'Full month amount'}
                  strong
                />

                {isCurrentMonth && salaryTillDate != null && (
                  <>
                    <Divider />
                    <InfoRow
                      label={`Till today (Day ${now.getDate()}/${totalCalDays})`}
                      value={rupee(salaryTillDate)}
                      sub="Prorated on calendar days"
                    />
                  </>
                )}
                <Divider />
                <InfoRow
                  label="Base monthly salary"
                  value={rupee(data.salary)}
                  sub="Fixed monthly amount"
                />
                <Divider />
                <InfoRow
                  label="Per day salary"
                  value={rupee(Math.round(data.salary / totalCalDays))}
                  sub={`${totalCalDays} days in ${MONTHS[ym.month]}`}
                />
              </View>

              {/* ── CARD 2: Attendance Breakdown ── */}
              <View style={[styles.card, SHADOW.card, { marginBottom: SP.md }]}>
                <SectionHeader icon="calendar" title="Attendance This Month" color="#7C3AED" />

                {/* Attendance counts row — present/little late/very late/absent */}
                {(data.present != null || data.littleLate > 0 || data.veryLate > 0 || data.absent > 0) && (
                  <View style={styles.attendCountRow}>
                    {data.present != null && <View style={styles.attendBadge}><Text style={[styles.attendDot, { color: '#16A34A' }]}>●</Text><Text style={styles.attendBadgeTxt}>{data.present} Present</Text></View>}
                    {data.littleLate > 0 && <View style={styles.attendBadge}><Text style={[styles.attendDot, { color: '#D97706' }]}>●</Text><Text style={styles.attendBadgeTxt}>{data.littleLate} Little Late</Text></View>}
                    {data.veryLate > 0 && <View style={styles.attendBadge}><Text style={[styles.attendDot, { color: '#EA580C' }]}>●</Text><Text style={styles.attendBadgeTxt}>{data.veryLate} Very Late</Text></View>}
                    {(data.absent ?? 0) > 0 && <View style={styles.attendBadge}><Text style={[styles.attendDot, { color: '#DC2626' }]}>●</Text><Text style={styles.attendBadgeTxt}>{data.absent} Absent</Text></View>}
                  </View>
                )}

                {/* Stat chips row */}
                <View style={styles.chipRow}>
                  <StatChip icon="checkmark-circle" label="Allowed" value={`${allowedShown}L`} />
                  <StatChip icon="close-circle" label="Taken" value={`${data.leavesConsumed}L`}
                    accent={data.leavesConsumed > allowedShown} />
                  <StatChip icon="alert-circle" label="Extra" value={`${data.excessLeaves}L`}
                    accent={data.excessLeaves > 0} />
                </View>

                {carried > 0 && (
                  <View style={styles.carryPill}>
                    <Ionicons name="trending-up" size={13} color="#0D9488" />
                    <Text style={styles.carryPillTxt}>
                      Includes {carried} leave{carried === 1 ? '' : 's'} carried over from earlier months
                    </Text>
                  </View>
                )}

                {/* Progress bar: leaves used */}
                {allowedShown > 0 && (
                  <View style={{ marginTop: SP.sm }}>
                    <View style={styles.leaveBarTrack}>
                      <View style={[
                        styles.leaveBarFill,
                        {
                          width: `${Math.min(100, (data.leavesConsumed / allowedShown) * 100)}%`,
                          backgroundColor: data.leavesConsumed > allowedShown
                            ? COLORS.danger : COLORS.success,
                        },
                      ]} />
                    </View>
                    <Text style={styles.leaveBarLbl}>
                      {data.leavesConsumed} / {allowedShown} leaves used
                    </Text>
                  </View>
                )}

                <Divider />

                <InfoRow label="Leaves allowed" value={`${allowedShown} days${carried > 0 ? ` (incl. ${carried} carried)` : ''}`} />
                <Divider />
                <InfoRow label="Leaves taken" value={`${data.leavesConsumed} days`}
                  danger={data.leavesConsumed > allowedShown} />
                <Divider />
                <InfoRow
                  label="Extra / unpaid leaves"
                  value={data.excessLeaves > 0 ? `${data.excessLeaves} days` : 'None'}
                  danger={data.excessLeaves > 0}
                  success={data.excessLeaves === 0}
                />
                {/* Breakdown: how leaves were consumed */}
                {(data.absent != null || data.lateDeductions != null) && (
                  <>
                    <Divider />
                    <InfoRow label="Absent days" value={`${data.absent ?? 0}`} />
                    {data.veryLate > 0 && (
                      <>
                        <Divider />
                        <InfoRow
                          label={`Very late (${data.veryLate} days → ${data.lateDeductions ?? 0} leave${(data.lateDeductions ?? 0) !== 1 ? 's' : ''})`}
                          value={`${data.veryLate} days`}
                        />
                      </>
                    )}
                    {data.littleLate > 0 && (
                      <>
                        <Divider />
                        <InfoRow
                          label={`Little late (${data.littleLate} days)`}
                          value={`${data.littleLate} days`}
                        />
                      </>
                    )}
                  </>
                )}
              </View>

              {/* ── CARD 3: Deductions ── */}
              <View style={[styles.card, SHADOW.card, { marginBottom: SP.md }]}>
                <SectionHeader icon="remove-circle" title="Deductions" color={COLORS.danger} />

                {data.deduction > 0 ? (
                  <>
                    <InfoRow
                      label="Deduction amount"
                      value={`−${rupee(data.deduction)}`}
                      sub={`For ${data.excessLeaves} extra leave${data.excessLeaves !== 1 ? 's' : ''}`}
                      danger
                    />
                    <Divider />
                    <InfoRow
                      label="Base salary"
                      value={rupee(data.salary)}
                    />
                    <Divider />
                    <InfoRow
                      label="After deduction"
                      value={rupee(data.payable)}
                      strong
                    />
                  </>
                ) : (
                  <InfoRow
                    label="Deduction amount"
                    value="Nil"
                    success
                  />
                )}
              </View>

              <Text style={styles.hint}>
                💡 {(() => {
                  const ll = data?.littleLatePerLeave ?? 6;
                  const vl = data?.veryLatePerLeave ?? 3;
                  const hc = data?.halfDayLeaveCost ?? 0.5;
                  const parts = [];
                  parts.push(`Half-day = ${hc} leave.`);
                  const rules = [];
                  if (vl > 0) rules.push(`${vl} very-late days`);
                  if (ll > 0) rules.push(`${ll} little-late days`);
                  if (rules.length) parts.push(`Every ${rules.join(' or ')} deducts 1 leave (shown in Absent count).`);
                  parts.push('Sundays and holidays are never counted.');
                  return parts.join(' ');
                })()}
                {isCurrentMonth ? ' Salary till date is prorated on calendar days.' : ''}
              </Text>
            </>
          )}
        </ScrollView>
      )}

      {/* Security questions setup prompt — shown once after first unlock if SQ not set */}
      {unlocked && sqPrompt && (
        <View style={styles.sqBanner}>
          <View style={styles.sqBannerInner}>
            <View style={styles.sqBannerIcon}>
              <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sqBannerTitle}>Set up a recovery option</Text>
              <Text style={styles.sqBannerSub}>
                Add 3 security questions so you can reset your salary PIN anytime — no admin needed.
              </Text>
            </View>
            <Pressable onPress={() => setSqPrompt(false)} hitSlop={8} style={styles.sqBannerClose}>
              <Ionicons name="close" size={16} color={COLORS.textMute} />
            </Pressable>
          </View>
          <View style={styles.sqBannerActions}>
            <Pressable onPress={() => { setSqPrompt(false); navigation.navigate('SecurityQuestionsSetup', { firstTime: true }); }}
              style={styles.sqBannerBtn}>
              <Text style={styles.sqBannerBtnTxt}>Set up now</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </Pressable>
            <Pressable onPress={() => setSqPrompt(false)} hitSlop={8}>
              <Text style={styles.sqBannerSkip}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      )}

      <SalaryPinModal
        visible={pinVisible}
        purpose="view your salary sheet"
        onClose={() => { setPinVisible(false); if (!unlocked) navigation.goBack(); }}
        onUnlocked={() => {
          setPinVisible(false);
          setUnlocked(true);
          // After unlocking, check whether the user has security questions set up.
          // Only a 404 means "none set up" → show the recovery prompt. A network or
          // other error must NOT nag them to set up recovery.
          if (!sqChecked) {
            setSqChecked(true);
            getSalaryPinQuestion()
              .then(() => setSqPrompt(false))                 // has questions — no prompt
              .catch((e) => setSqPrompt(e?.response?.status === 404)); // 404 = none set up
          }
        }}
        onForgotPin={() => { setPinVisible(false); navigation.navigate('ChangeSalaryPin'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // ── Header
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom: SP.xl,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...TYPE.h2, color: COLORS.white },
  headerSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Month Nav
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SP.lg, marginTop: SP.md,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  monthLbl: { ...TYPE.title, fontSize: 17, color: COLORS.white, fontWeight: '800', minWidth: 150, textAlign: 'center' },

  // Hero block
  heroBlock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SP.lg,
  },
  heroLeft: { flex: 1 },
  heroCaption: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroAmt: { fontSize: 36, fontWeight: '900', color: COLORS.white, marginTop: 4, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  monthlySub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  monthlySubTxt: { ...TYPE.cap, color: 'rgba(255,255,255,0.65)', fontWeight: '700', fontSize: 12 },
  deductBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.sm,
    backgroundColor: '#FEE2E2', borderRadius: R.pill,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  deductBadgeTxt: { ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  fullBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.sm,
    backgroundColor: '#DCFCE7', borderRadius: R.pill,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  fullBadgeTxt: { ...TYPE.cap, color: COLORS.success, fontWeight: '700' },

  heroRight: { marginLeft: SP.md },
  circleWrap: { alignItems: 'center', justifyContent: 'center' },
  circleOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  circleVal: { fontSize: 18, fontWeight: '900', color: COLORS.white },
  circleSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', fontSize: 10 },

  // Till date pills
  tillDateRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md },
  tillDateChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.white, borderRadius: R.pill,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  tillDateTxt: { ...TYPE.cap, color: COLORS.ink, fontSize: 11, flex: 1 },

  // ── Locked
  lockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl, gap: SP.sm },
  lockIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SP.sm,
  },
  lockedTitle: { ...TYPE.h2, color: COLORS.text, textAlign: 'center' },
  lockedMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', maxWidth: 260 },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: R.md,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: SP.md,
  },
  unlockTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white },
  pinLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.md, paddingVertical: 6 },
  pinLinkTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '800' },

  // ── Cards
  card: {
    backgroundColor: COLORS.surface, borderRadius: R.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.sm,
  },
  sectionIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { ...TYPE.label, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.lg, paddingVertical: 13,
  },
  infoRowHL: { backgroundColor: COLORS.primaryTint },
  infoLbl: { ...TYPE.body, color: COLORS.textSoft },
  infoVal: { ...TYPE.title, color: COLORS.text, fontVariant: ['tabular-nums'] },
  infoSub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2, textAlign: 'right' },
  div: { height: 1, backgroundColor: COLORS.border },

  // Stat chips
  chipRow: { flexDirection: 'row', gap: SP.sm, paddingHorizontal: SP.lg, paddingVertical: SP.sm },
  statChip: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: SP.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statChipAccent: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  statVal: { ...TYPE.title, fontSize: 15, color: COLORS.primary, fontVariant: ['tabular-nums'] },
  statLbl: { ...TYPE.cap, fontSize: 10, color: COLORS.textMute },

  // Leave progress bar
  leaveBarTrack: {
    height: 6, backgroundColor: COLORS.border, borderRadius: 3,
    marginHorizontal: SP.lg, overflow: 'hidden',
  },
  leaveBarFill: { height: 6, borderRadius: 3 },
  leaveBarLbl: { ...TYPE.cap, color: COLORS.textMute, marginTop: 4, marginHorizontal: SP.lg, marginBottom: SP.sm },
  carryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: SP.sm, marginHorizontal: SP.lg, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  carryPillTxt: { ...TYPE.cap, color: '#0D9488', fontWeight: '700', flexShrink: 1 },

  // No deduction
  noDeductRow: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    paddingHorizontal: SP.lg, paddingVertical: SP.lg,
  },
  noDeductIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.successTint,
    alignItems: 'center', justifyContent: 'center',
  },
  noDeductTitle: { ...TYPE.title, color: COLORS.success },
  noDeductSub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },

  // Final card
  finalCard: {
    borderRadius: R.lg, padding: SP.lg,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SP.md,
  },
  finalTop: { flexDirection: 'row', alignItems: 'center' },
  finalLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  finalAmt: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 2 },

  overrideBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SP.md, padding: SP.sm,
    backgroundColor: 'rgba(217,119,6,0.08)', borderRadius: R.sm,
  },
  overrideTxt: { ...TYPE.cap, color: COLORS.warn },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: R.lg,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', paddingVertical: SP.xxl, paddingHorizontal: SP.xl,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: SP.md,
  },
  emptyTitle: { ...TYPE.title, color: COLORS.text, marginBottom: SP.sm },
  emptyMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', lineHeight: 20 },

  dimTxt: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center' },
  hint: {
    ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm,
    lineHeight: 18, textAlign: 'center', paddingHorizontal: SP.lg,
  },
  attendCountRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: 4,
  },
  attendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  attendDot: { fontSize: 10, fontWeight: '900' },
  attendBadgeTxt: { ...TYPE.cap, fontSize: 11, color: COLORS.textSoft, fontWeight: '700' },

  // Security question setup banner
  sqBanner:       { margin: SP.md, marginTop: 0, backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.primary + '40', overflow: 'hidden' },
  sqBannerInner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: SP.md },
  sqBannerIcon:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  sqBannerTitle:  { ...TYPE.label, color: COLORS.text, fontWeight: '800', marginBottom: 3 },
  sqBannerSub:    { ...TYPE.cap, color: COLORS.textSoft, lineHeight: 16 },
  sqBannerClose:  { padding: 4 },
  sqBannerActions:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.md, paddingBottom: SP.md, paddingTop: 0 },
  sqBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14 },
  sqBannerBtnTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '800' },
  sqBannerSkip:   { ...TYPE.cap, color: COLORS.textMute, fontWeight: '600' },
});
