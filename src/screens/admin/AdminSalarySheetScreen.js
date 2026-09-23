import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Dimensions, Animated, PanResponder,
  Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getSalary } from '../../api/admin';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_W } = Dimensions.get('window');

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function totalCalendarDays(year, month) {
  return new Date(year, month, 0).getDate();
}
function workingDaysSoFar(year, month) {
  const today = new Date();
  const lastDay = today.getFullYear() === year && today.getMonth() + 1 === month
    ? today.getDate()
    : new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) count++;
  }
  return count;
}

// ── HTML for single employee salary slip ────────────────────────────────────
function buildEmployeeSlipHtml(employeeName, data, year, month) {
  const monthName = MONTHS[month];
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const totalCalDays = totalCalendarDays(year, month);
  let salaryTillDate = null;
  if (isCurrentMonth && data.salary) {
    const raw = Math.round((data.salary / totalCalDays) * now.getDate());
    salaryTillDate = Math.max(0, raw - (data.deduction || 0));
  }
  const progressPct = data.salary
    ? Math.min(100, Math.round(((data.payable || 0) / data.salary) * 100))
    : 0;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 28px; }

  /* Top header */
  .slip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #1D4ED8; padding-bottom: 14px; }
  .slip-header h1 { font-size: 22px; font-weight: 900; color: #1D4ED8; }
  .slip-header .period { font-size: 13px; color: #475569; font-weight: 600; margin-top: 3px; }
  .slip-header .generated { font-size: 10px; color: #94a3b8; margin-top: 5px; }

  /* Employee hero card */
  .hero { background: linear-gradient(135deg, #0B1F3A 0%, #1D4ED8 60%, #2563EB 100%); border-radius: 12px; padding: 20px 24px; margin-bottom: 18px; color: #fff; display: flex; justify-content: space-between; align-items: center; }
  .hero-left .cap { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.7); text-transform: uppercase; }
  .hero-left .amount { font-size: 38px; font-weight: 900; margin-top: 4px; }
  .hero-left .sub { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 6px; }
  .hero-left .badge-deduct { background: #FEE2E2; color: #DC2626; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; display: inline-block; margin-top: 8px; }
  .hero-left .badge-full { background: #DCFCE7; color: #16A34A; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; display: inline-block; margin-top: 8px; }
  .hero-right { text-align: center; border: 4px solid ${data.deduction > 0 ? '#DC2626' : '#16A34A'}; border-radius: 50%; width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); }
  .hero-right .pct { font-size: 18px; font-weight: 900; }
  .hero-right .pct-lbl { font-size: 10px; color: rgba(255,255,255,0.7); }

  /* Section cards */
  .section { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #E2E8F0; }
  .section-title.blue { color: #1D4ED8; }
  .section-title.red { color: #DC2626; }
  .section-title.purple { color: #7C3AED; }

  /* Rows */
  .row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #E2E8F0; }
  .row:last-child { border-bottom: none; }
  .row .lbl { color: #64748b; }
  .row .val { font-weight: 700; font-variant-numeric: tabular-nums; }
  .row .val.red { color: #DC2626; }
  .row .val.green { color: #16A34A; }
  .row .val.big { font-size: 16px; color: #1e293b; }
  .row .val.highlight { color: #1D4ED8; font-size: 16px; font-weight: 900; }
  .row.strong .lbl { color: #1e293b; font-weight: 800; }

  /* Mini grid */
  .mini-grid { display: flex; gap: 8px; margin-top: 10px; }
  .mini { flex: 1; background: #EFF6FF; border-radius: 8px; padding: 10px; text-align: center; }
  .mini .num { font-size: 20px; font-weight: 900; color: #1D4ED8; }
  .mini .lbl { font-size: 10px; color: #64748b; margin-top: 3px; }

  /* Footer */
  .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 10px; line-height: 16px; }
  .attend-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .abadge { font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; }
  .abadge.present { background: #DCFCE7; color: #16A34A; }
  .abadge.llate { background: #FEF3C7; color: #D97706; }
  .abadge.vlate { background: #FFEDD5; color: #EA580C; }
  .abadge.absent { background: #FEE2E2; color: #DC2626; }

  /* Employee name plate */
  .name-plate { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .avatar { width: 52px; height: 52px; border-radius: 26px; background: #DBEAFE; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #1D4ED8; flex-shrink: 0; }
  .name-plate .name { font-size: 20px; font-weight: 900; color: #1e293b; }
  .name-plate .sub { font-size: 12px; color: #64748b; margin-top: 2px; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="slip-header">
    <div>
      <h1>Salary Slip</h1>
      <div class="period">${monthName} ${year}</div>
      <div class="generated">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} · Keep Konnected</div>
    </div>
  </div>

  <!-- Employee name -->
  <div class="name-plate">
    <div class="avatar">${employeeName?.[0]?.toUpperCase() || '?'}</div>
    <div>
      <div class="name">${employeeName}</div>
      <div class="sub">Employee · ${monthName} ${year} Salary Slip</div>
    </div>
  </div>

  <!-- Hero card -->
  <div class="hero">
    <div class="hero-left">
      ${isCurrentMonth && salaryTillDate != null ? `
        <div class="cap">MONTHLY PAYABLE</div>
        <div class="amount">${rupee(data.payable)}</div>
        <div class="sub">Till today (Day ${now.getDate()}/${totalCalDays}): ${rupee(salaryTillDate)}</div>
      ` : `
        <div class="cap">PAYABLE</div>
        <div class="amount">${rupee(data.payable)}</div>
      `}
      ${data.deduction > 0
        ? `<div class="badge-deduct">− ${rupee(data.deduction)} deducted</div>`
        : `<div class="badge-full">✓ Full inclusive salary</div>`}
    </div>
    <div class="hero-right">
      <div class="pct">${progressPct}%</div>
      <div class="pct-lbl">earned</div>
    </div>
  </div>

  <!-- Earnings Overview -->
  <div class="section">
    <div class="section-title blue">Earnings Overview</div>
    <div class="row strong"><span class="lbl">${data.isOverridden ? 'Final payable (admin adjusted)' : 'Monthly payable'}</span><span class="val big">${rupee(data.payable)}</span></div>
    ${isCurrentMonth && salaryTillDate != null ? `
    <div class="row"><span class="lbl">Till today (Day ${now.getDate()}/${totalCalDays})</span><span class="val">${rupee(salaryTillDate)}</span></div>
    ` : ''}

    <div class="row"><span class="lbl">Base monthly salary</span><span class="val">${rupee(data.salary)}</span></div>
    <div class="row"><span class="lbl">Daily rate (÷ ${data.daysInMonth} days)</span><span class="val">${rupee(data.dailyRate)}</span></div>
    ${data.isOverridden ? `<div class="row"><span class="lbl" style="color:#1D4ED8">✏️ Manually adjusted${data.overrideNote ? ' · ' + data.overrideNote : ''}</span><span></span></div>` : ''}
  </div>

  <!-- Deductions -->
  <div class="section">
    <div class="section-title red">Deductions</div>
    <div class="row"><span class="lbl">Excess leaves</span><span class="val ${data.excessLeaves > 0 ? 'red' : 'green'}">${data.excessLeaves}</span></div>
    <div class="row"><span class="lbl">Deduction amount</span><span class="val ${data.deduction > 0 ? 'red' : 'green'}">${data.deduction > 0 ? '− ' + rupee(data.deduction) : 'Nil'}</span></div>
    <div class="row strong"><span class="lbl">Calculated salary</span><span class="val big">${rupee(data.calculatedSalary)}</span></div>
  </div>

  <!-- Attendance -->
  <div class="section">
    <div class="section-title purple">Attendance Breakdown</div>
    <div class="row"><span class="lbl">Leaves allowed (paid)</span><span class="val">${data.allowedLeaves}${data.excusedLeaves ? ' + ' + data.excusedLeaves + ' excused' : ''}</span></div>
    <div class="row"><span class="lbl">Leaves taken</span><span class="val ${data.leavesConsumed > data.allowedLeaves ? 'red' : ''}">${data.leavesConsumed}</span></div>
    <div class="attend-row">
      ${data.present != null ? `<span class="abadge present">${data.present} Present</span>` : ''}
      ${data.littleLate > 0 ? `<span class="abadge llate">${data.littleLate} Little Late</span>` : ''}
      ${data.veryLate > 0 ? `<span class="abadge vlate">${data.veryLate} Very Late</span>` : ''}
      ${(data.effectiveAbsent ?? data.absent) > 0 ? `<span class="abadge absent">${data.effectiveAbsent ?? data.absent} Absent</span>` : ''}
    </div>
    <div class="mini-grid">
      <div class="mini"><div class="num">${data.effectiveAbsent ?? data.absent}</div><div class="lbl">Absent</div></div>
      <div class="mini"><div class="num">${data.veryLate}</div><div class="lbl">Very Late</div></div>
      <div class="mini"><div class="num">${data.littleLate}</div><div class="lbl">Little Late</div></div>
      <div class="mini"><div class="num">${data.lateDeductions}</div><div class="lbl">Late→Leave</div></div>
    </div>
  </div>

  <div class="footer">
    💡 Absent count includes leaves deducted for late arrivals (3 very-late = 1 leave, 6 little-late = 1 leave). Half-day = 0.5 leave. Sundays and holidays are not counted.${isCurrentMonth ? ' Salary till date is prorated on calendar days.' : ''}<br/>
    This is a computer-generated salary slip. Keep Konnected · ${monthName} ${year}
  </div>
</body>
</html>`;
}

const Row = ({ label, value, danger, success, strong, highlight }) => (
  <View style={[sh.row, highlight && sh.rowHL]}>
    <Text style={[sh.rowLbl, strong && { color: COLORS.text, fontWeight: '800' }, highlight && { color: COLORS.primary, fontWeight: '800' }]}>{label}</Text>
    <Text style={[
      sh.rowVal,
      danger && { color: COLORS.danger },
      success && { color: COLORS.success },
      strong && { fontSize: 17, color: COLORS.text },
      highlight && { color: COLORS.primary, fontWeight: '900', fontSize: 17 },
    ]}>{value}</Text>
  </View>
);
const Divider = () => <View style={sh.divider} />;
const SectionHeader = ({ icon, title, color }) => (
  <View style={sh.secHead}>
    <View style={[sh.secIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <Text style={[sh.secTitle, { color }]}>{title}</Text>
  </View>
);
const MiniStat = ({ label, value }) => (
  <View style={sh.mini}>
    <Text style={sh.miniNum}>{value}</Text>
    <Text style={sh.miniLbl}>{label}</Text>
  </View>
);

// ── Single employee salary sheet ─────────────────────────────────────────────
function EmployeeSheet({ employee, year, month, onDataLoaded }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const totalCalDays = totalCalendarDays(year, month);

  const load = useCallback(async () => {
    setLoading(true);
    setLocked(false);
    try {
      const res = await getSalary(employee.id, year, month);
      setData(res.data);
      onDataLoaded?.(res.data);
    } catch (e) {
      if (e?.response?.status === 403) setLocked(true);
    } finally {
      setLoading(false);
    }
  }, [employee.id, year, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  let salaryTillDate = null;
  if (data && isCurrentMonth && data.salary) {
    const todayDate = now.getDate();
    const raw = Math.round((data.salary / totalCalDays) * todayDate);
    salaryTillDate = Math.max(0, raw - (data.deduction || 0));
  }

  const progressPct = data?.salary
    ? Math.min(100, Math.round(((data.payable || 0) / data.salary) * 100))
    : 0;

  if (loading) {
    return (
      <View style={sh.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={sh.loadingTxt}>Loading {employee.name}'s salary…</Text>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={sh.center}>
        <Ionicons name="lock-closed" size={44} color={COLORS.textMute} />
        <Text style={sh.lockedTitle}>Salary is private</Text>
        <Text style={sh.lockedMsg}>You don't have access to {employee.name}'s salary. Ask the owner to grant you access.</Text>
      </View>
    );
  }

  if (!data || !data.hasSalary) {
    return (
      <View style={sh.center}>
        <Ionicons name="wallet-outline" size={44} color={COLORS.textMute} />
        <Text style={sh.lockedTitle}>No salary set</Text>
        <Text style={sh.lockedMsg}>No salary has been configured for {employee.name} yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero card ── */}
      <LinearGradient
        colors={['#0B1F3A', '#1D4ED8', '#2563EB']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={sh.heroCard}
      >
        <View style={sh.heroRow}>
          <View style={{ flex: 1 }}>
            {isCurrentMonth && salaryTillDate != null ? (
              <>
                <Text style={sh.heroCaption}>MONTHLY PAYABLE</Text>
                <Text style={sh.heroAmt}>{rupee(data.payable)}</Text>
                <View style={sh.monthlySub}>
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={sh.monthlySubTxt}>Till today: {rupee(salaryTillDate)}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={sh.heroCaption}>PAYABLE</Text>
                <Text style={sh.heroAmt}>{rupee(data.payable)}</Text>
              </>
            )}
            {data.deduction > 0 ? (
              <View style={sh.deductBadge}>
                <Ionicons name="arrow-down" size={11} color={COLORS.danger} />
                <Text style={sh.deductTxt}>{rupee(data.deduction)} deducted</Text>
              </View>
            ) : (
              <View style={sh.fullBadge}>
                <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
                <Text style={sh.fullTxt}>Full inclusive salary</Text>
              </View>
            )}
          </View>
          <View style={[sh.circle, {
            borderColor: progressPct >= 100 ? COLORS.success : progressPct >= 70 ? COLORS.gold : COLORS.danger,
          }]}>
            <Text style={sh.circleVal}>{progressPct}%</Text>
            <Text style={sh.circleSub}>earned</Text>
          </View>
        </View>
        <Text style={sh.heroMonth}>{MONTHS[month]} {year}</Text>
      </LinearGradient>

      {/* ── Earnings overview ── */}
      <View style={[sh.card, SHADOW.card]}>
        <SectionHeader icon="stats-chart" title="Earnings Overview" color={COLORS.primary} />

        <Row label={data.isOverridden ? 'Final payable (admin set)' : 'Monthly salary'}
          value={rupee(data.payable)}
          sub={data.isOverridden ? 'Amount fixed' : 'Full month'}
          strong />
        {isCurrentMonth && salaryTillDate != null && (
          <>
            <Divider />
            <Row label={`Till today (Day ${now.getDate()}/${totalCalDays})`} value={rupee(salaryTillDate)}
              sub="Prorated" />
          </>
        )}
        <Divider />
        <Row label="Base monthly salary" value={rupee(data.salary)} />
        <Divider />
        <Row label={`Daily rate (÷ ${data.daysInMonth} days)`} value={rupee(data.dailyRate)} />
        {data.isOverridden && (
          <>
            <Divider />
            <View style={sh.adjustBadge}>
              <Ionicons name="create" size={12} color={COLORS.primary} />
              <Text style={sh.adjustTxt}>Manually adjusted{data.overrideNote ? ` · ${data.overrideNote}` : ''}</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Deductions ── */}
      <View style={[sh.card, SHADOW.card]}>
        <SectionHeader icon="remove-circle" title="Deductions" color={COLORS.danger} />
        <Row label="Excess leaves" value={`${data.excessLeaves}`} danger={data.excessLeaves > 0} success={data.excessLeaves === 0} />
        <Divider />
        <Row label="Deduction amount" value={data.deduction > 0 ? `−${rupee(data.deduction)}` : 'Nil'}
          danger={data.deduction > 0} success={data.deduction === 0} />
        <Divider />
        <Row label="Calculated salary" value={rupee(data.calculatedSalary)} strong />
      </View>

      {/* ── Attendance breakdown ── */}
      <View style={[sh.card, SHADOW.card]}>
        <SectionHeader icon="calendar" title="Attendance" color="#7C3AED" />
        <Row label="Leaves allowed (paid)" value={`${data.allowedLeaves}${data.excusedLeaves ? ` + ${data.excusedLeaves} excused` : ''}`} />
        <Divider />
        <Row label="Leaves taken" value={`${data.leavesConsumed}`} danger={data.leavesConsumed > data.allowedLeaves} />
        <Divider />
        {/* Attendance counts row */}
        <View style={sh.attendCountRow}>
          {data.present != null && <View style={sh.attendBadge}><Text style={[sh.attendDot, { color: '#16A34A' }]}>●</Text><Text style={sh.attendLbl}>{data.present} Present</Text></View>}
          {data.littleLate > 0 && <View style={sh.attendBadge}><Text style={[sh.attendDot, { color: '#D97706' }]}>●</Text><Text style={sh.attendLbl}>{data.littleLate} Little Late</Text></View>}
          {data.veryLate > 0 && <View style={sh.attendBadge}><Text style={[sh.attendDot, { color: '#EA580C' }]}>●</Text><Text style={sh.attendLbl}>{data.veryLate} Very Late</Text></View>}
          {(data.effectiveAbsent ?? data.absent) > 0 && <View style={sh.attendBadge}><Text style={[sh.attendDot, { color: '#DC2626' }]}>●</Text><Text style={sh.attendLbl}>{data.effectiveAbsent ?? data.absent} Absent</Text></View>}
        </View>
        <View style={sh.miniGrid}>
          <MiniStat label="Absent" value={data.effectiveAbsent ?? data.absent} />
          <MiniStat label="Very late" value={data.veryLate} />
          <MiniStat label="Little late" value={data.littleLate} />
          <MiniStat label="Late→leave" value={data.lateDeductions} />
        </View>
      </View>

      <Text style={sh.footer}>
        💡 Absent count includes leaves deducted for late arrivals (3 very-late = 1 leave, 6 little-late = 1 leave). Half-day = 0.5 leave. Sundays and holidays are not counted.
        {isCurrentMonth ? ' Salary till date is prorated on calendar days.' : ''}
      </Text>
    </ScrollView>
  );
}

// ── Main screen with swipeable employees ─────────────────────────────────────
export default function AdminSalarySheetScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { employees, initialIndex = 0, year, month } = route.params;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [printing, setPrinting] = useState(false);
  // Store loaded data per employee id so print doesn't need a re-fetch
  const loadedDataRef = useRef({});

  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = SCREEN_W * 0.3;

  const goTo = (idx) => {
    if (idx < 0 || idx >= employees.length) return;
    const dir = idx > currentIndex ? -1 : 1;
    Animated.timing(translateX, { toValue: dir * SCREEN_W, duration: 180, useNativeDriver: true }).start(() => {
      setCurrentIndex(idx);
      translateX.setValue(-dir * SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    });
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_e, g) => { translateX.setValue(g.dx); },
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -SWIPE_THRESHOLD && currentIndex < employees.length - 1) {
        goTo(currentIndex + 1);
      } else if (g.dx > SWIPE_THRESHOLD && currentIndex > 0) {
        goTo(currentIndex - 1);
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    },
  })).current;

  const employee = employees[currentIndex];
  const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() + 1 === month;

  // ── Print current employee slip ──────────────────────────────────────────
  const printSlip = useCallback(async () => {
    const data = loadedDataRef.current[employee.id];
    if (!data) return Alert.alert('Not loaded', 'Salary data is still loading, please wait.');
    if (!data.hasSalary) return Alert.alert('No salary', `No salary is set for ${employee.name}.`);

    setPrinting(true);
    try {
      const html = buildEmployeeSlipHtml(employee.name, data, year, month);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${employee.name} · Salary Slip ${MONTHS_SHORT[month]} ${year}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('Print failed', e?.message || 'Could not generate PDF.');
    } finally {
      setPrinting(false);
    }
  }, [employee, year, month]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.ink, COLORS.primaryDeep]}
        style={[styles.header, { paddingTop: insets.top + 6 }]}
      >
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{employee.name}</Text>
            <Text style={styles.sub}>{MONTHS[month]} {year} · Salary Sheet</Text>
          </View>
          {/* Print button */}
          <Pressable onPress={printSlip} hitSlop={10} disabled={printing} style={{ opacity: printing ? 0.4 : 1 }}>
            {printing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="print-outline" size={22} color={COLORS.white} />}
          </Pressable>
        </View>

        {/* Employee indicator dots + arrows */}
        {employees.length > 1 && (
          <View style={styles.navRow}>
            <Pressable
              onPress={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              style={[styles.navArrow, currentIndex === 0 && { opacity: 0.3 }]}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={18} color={COLORS.white} />
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
              {employees.map((e, i) => (
                <Pressable key={e.id} onPress={() => goTo(i)} hitSlop={6}>
                  <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => goTo(currentIndex + 1)}
              disabled={currentIndex === employees.length - 1}
              style={[styles.navArrow, currentIndex === employees.length - 1 && { opacity: 0.3 }]}
              hitSlop={10}
            >
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
            </Pressable>
          </View>
        )}

        {employees.length > 1 && (
          <Text style={styles.swipeHint}>
            ← Swipe to see other employees · {currentIndex + 1} of {employees.length} →
          </Text>
        )}
      </LinearGradient>

      {/* Swipeable content */}
      <Animated.View
        style={{ flex: 1, transform: [{ translateX }] }}
        {...(employees.length > 1 ? pan.panHandlers : {})}
      >
        <EmployeeSheet
          key={`${employee.id}-${year}-${month}`}
          employee={employee}
          year={year}
          month={month}
          onDataLoaded={(d) => { loadedDataRef.current[employee.id] = d; }}
        />
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.md, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  title: { ...TYPE.h2, color: COLORS.white },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '700' },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.sm, gap: SP.sm },
  navArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SP.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 20, backgroundColor: COLORS.white },
  swipeHint: { ...TYPE.cap, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: SP.sm, fontSize: 11 },
});

// ── Sheet inner styles ────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl, gap: SP.md },
  loadingTxt: { ...TYPE.body, color: COLORS.textMute, marginTop: SP.sm },
  lockedTitle: { ...TYPE.h2, color: COLORS.text, textAlign: 'center' },
  lockedMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', lineHeight: 21 },
  heroCard: {
    borderRadius: R.lg, padding: SP.lg, marginBottom: SP.md,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroCaption: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 1 },
  heroAmt: { fontSize: 34, fontWeight: '900', color: COLORS.white, marginTop: 4, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  monthlySub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  monthlySubTxt: { ...TYPE.cap, color: 'rgba(255,255,255,0.65)', fontWeight: '700', fontSize: 12 },
  deductBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.sm, backgroundColor: '#FEE2E2', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  deductTxt: { ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  fullBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.sm, backgroundColor: '#DCFCE7', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  fullTxt: { ...TYPE.cap, color: COLORS.success, fontWeight: '700' },
  circle: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: SP.md },
  circleVal: { fontSize: 16, fontWeight: '900', color: COLORS.white },
  circleSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  heroMonth: { ...TYPE.cap, color: 'rgba(255,255,255,0.55)', marginTop: SP.sm, fontWeight: '700', textAlign: 'right' },
  card: { backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.md },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm },
  secIcon: { width: 26, height: 26, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  secTitle: { ...TYPE.title, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowHL: { backgroundColor: COLORS.primaryTint, borderRadius: R.sm, paddingHorizontal: SP.sm, marginHorizontal: -SP.sm },
  rowLbl: { ...TYPE.body, color: COLORS.textSoft, fontSize: 14, flex: 1 },
  rowVal: { ...TYPE.label, color: COLORS.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 2 },
  adjustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 6, marginTop: SP.sm },
  adjustTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  miniGrid: { flexDirection: 'row', marginTop: SP.sm, gap: 2 },
  mini: { flex: 1, alignItems: 'center', paddingVertical: SP.sm, backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm },
  miniNum: { ...TYPE.h2, color: COLORS.text, fontVariant: ['tabular-nums'], fontSize: 20 },
  miniLbl: { ...TYPE.cap, fontSize: 10, color: COLORS.textMute, marginTop: 2, textAlign: 'center' },
  footer: { ...TYPE.cap, color: COLORS.textMute, textAlign: 'center', lineHeight: 17, marginBottom: SP.lg },
  attendCountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.sm, paddingTop: SP.xs ?? 4 },
  attendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 4 },
  attendDot: { fontSize: 10, fontWeight: '900' },
  attendLbl: { ...TYPE.cap, fontSize: 11, color: COLORS.textSoft, fontWeight: '700' },
});
