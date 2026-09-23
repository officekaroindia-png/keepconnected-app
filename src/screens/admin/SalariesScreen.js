import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { listSalaries } from '../../api/admin';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Calendar days in a given month
function calDays(year, month) {
  return new Date(year, month, 0).getDate();
}

// Prorated salary up to today's date (calendar-day basis, after deductions)
function salaryTillToday(r, year, month) {
  const now = new Date();
  if (!r.salary || r.salary <= 0) return null;
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return null;
  const total = calDays(year, month);
  const raw = Math.round((r.salary / total) * now.getDate());
  return Math.max(0, raw - (r.deduction || 0));
}

// ── HTML for the all-employees salary table ──────────────────────────────────
function buildAllSalariesHtml(rows, year, month, totalExpense) {
  const monthName = MONTHS[month];
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayLabel = isCurrent ? `Till Today (Day ${now.getDate()}/${calDays(year, month)})` : null;

  const visibleRows = rows.filter((r) => r.hasSalary && r.access);

  const tableRows = visibleRows.map((r, i) => {
    const till = salaryTillToday(r, year, month);
    return `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td>${i + 1}</td>
        <td class="name">${r.name || '—'}</td>
        <td class="money">${rupee(r.salary ?? 0)}</td>
        <td class="center">${r.absent ?? 0}</td>
        <td class="center">${r.excessLeaves ?? 0}</td>
        <td class="money red">${r.deduction > 0 ? '− ' + rupee(r.deduction) : '—'}</td>
        <td class="money bold">${rupee(r.payable ?? 0)}</td>
        ${isCurrent ? `<td class="money blue">${till != null ? rupee(till) : '—'}</td>` : ''}
        <td class="status">${r.isOverridden ? '✏️ Adjusted' : r.deduction > 0 ? '⚠️ Deducted' : '✅ Full'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1D4ED8; padding-bottom: 14px; }
  .company { font-size: 10px; color: #64748b; margin-top: 4px; }
  h1 { font-size: 20px; font-weight: 800; color: #1D4ED8; }
  .period { font-size: 13px; color: #475569; font-weight: 600; margin-top: 4px; }
  .summary-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px 20px; text-align: right; }
  .summary-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  .summary-amount { font-size: 24px; font-weight: 900; color: #1D4ED8; }
  .summary-count { font-size: 11px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead tr { background: #1D4ED8; color: #fff; }
  thead th { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap; }
  thead th.center { text-align: center; }
  thead th.right { text-align: right; }
  tbody tr { border-bottom: 1px solid #E2E8F0; }
  tbody tr.even { background: #F8FAFC; }
  tbody td { padding: 9px 8px; vertical-align: middle; }
  td.name { font-weight: 700; color: #1e293b; }
  td.money { text-align: right; font-variant-numeric: tabular-nums; }
  td.center { text-align: center; }
  td.bold { font-weight: 800; font-size: 13px; }
  td.red { color: #DC2626; }
  td.blue { color: #1D4ED8; font-weight: 700; }
  td.status { font-size: 11px; }
  .total-row td { background: #EFF6FF; font-weight: 800; border-top: 2px solid #1D4ED8; color: #1D4ED8; font-size: 13px; }
  .today-note { font-size: 10px; color: #1D4ED8; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; display: inline-block; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Salary Sheet</h1>
      <div class="period">${monthName} ${year}</div>
      <div class="company">Generated via Keep Konnected · ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Total Salary Expense</div>
      <div class="summary-amount">${rupee(totalExpense)}</div>
      <div class="summary-count">${visibleRows.length} employee${visibleRows.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  ${isCurrent ? `<div class="today-note">💡 "Till Today" column shows prorated salary up to Day ${now.getDate()} of ${calDays(year, month)}, after deductions.</div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Employee Name</th>
        <th class="right">Base Salary</th>
        <th class="center">Absent</th>
        <th class="center">Excess Leaves</th>
        <th class="right">Deduction</th>
        <th class="right">Monthly Payable</th>
        ${isCurrent ? `<th class="right" style="background:#1a40b0">${todayLabel}</th>` : ''}
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="total-row">
        <td colspan="${isCurrent ? 6 : 5}" style="text-align:right; padding-right:8px;">TOTAL PAYABLE</td>
        <td class="money bold">${rupee(totalExpense)}</td>
        ${isCurrent ? `<td></td>` : ''}
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    💡 Absent = actual absent days + leaves deducted for late arrivals (every 3 very-late = 1 leave, every 6 little-late = 1 leave). Half-day = 0.5 leave. Sundays and holidays are never counted.<br/>
    Keep Konnected Salary Management · ${monthName} ${year}
  </div>
</body>
</html>`;
}

export default function SalariesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await listSalaries(ym.year, ym.month)); }
    catch { /* keep */ }
    finally { setLoading(false); }
  }, [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stepMonth = (dir) => {
    setYm((prev) => {
      const d = new Date(prev.year, prev.month - 1 + dir, 1);
      // Block going past current month
      if (dir > 0 && (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth()))) return prev;
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };
  const isCurrentMonth = ym.year === now.getFullYear() && ym.month === now.getMonth() + 1;

  const rows = data?.rows || [];
  const withSalary = rows.filter((r) => r.hasSalary);
  const noSalary = rows.filter((r) => !r.hasSalary);

  // ── Print all employees ──────────────────────────────────────────────────
  const printAll = useCallback(async () => {
    if (!data || withSalary.length === 0) return Alert.alert('Nothing to print', 'No salary data loaded yet.');
    setPrinting(true);
    try {
      const html = buildAllSalariesHtml(rows, ym.year, ym.month, data.totalExpense ?? 0);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Salary Sheet — ${MONTHS[ym.month]} ${ym.year}`,
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
  }, [data, rows, withSalary, ym]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Salaries</Text>
          <Pressable onPress={printAll} hitSlop={10} disabled={printing || loading || withSalary.length === 0}
            style={{ opacity: (printing || loading || withSalary.length === 0) ? 0.4 : 1 }}>
            {printing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="print-outline" size={22} color={COLORS.white} />}
          </Pressable>
        </View>

        <View style={styles.monthNav}>
          <Pressable onPress={() => stepMonth(-1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </Pressable>
          <Text style={styles.monthLbl}>{MONTHS[ym.month]} {ym.year}</Text>
          <Pressable onPress={() => stepMonth(1)} hitSlop={10}
            style={[styles.navBtn, isCurrentMonth && { opacity: 0.3 }]}
            disabled={isCurrentMonth}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
          </Pressable>
        </View>

        {/* Expense summary */}
        <View style={styles.expenseCard}>
          <Text style={styles.expenseLbl}>
            {isCurrentMonth ? 'This month\'s salary expense' : `${MONTHS[ym.month]} ${ym.year} salary expense`}
          </Text>
          <Text style={styles.expenseAmt}>{rupee(data?.totalExpense)}</Text>
          <Text style={styles.expenseSub}>
            {data?.visibleCount || 0} {data?.visibleCount === 1 ? 'employee' : 'employees'}
            {data?.lockedCount > 0 ? ` · ${data.lockedCount} locked` : ''}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && withSalary.map((r, idx) => {
          const till = salaryTillToday(r, ym.year, ym.month);
          return (
            <Pressable key={r.id} onPress={() => navigation.navigate('SalaryDetail', {
                id: r.id, name: r.name, year: ym.year, month: ym.month,
                allEmployees: withSalary.map((e) => ({ id: e.id, name: e.name })),
                employeeIndex: idx,
              })}
              style={[styles.card, SHADOW.card, !r.access && styles.cardLocked]}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{r.name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                {r.access ? (
                  <>
                    {/* Deduction formula or full salary badge */}
                    {r.deduction > 0 ? (
                      <Text style={styles.sub}>
                        <Text style={{ color: COLORS.textMute }}>{rupee(r.salary)}</Text>
                        <Text style={{ color: COLORS.danger }}>{' − '}{rupee(r.deduction)}</Text>
                        {r.excessLeaves > 0 ? <Text style={{ color: COLORS.textMute }}> · {r.excessLeaves}L extra</Text> : null}
                        {r.isOverridden ? <Text style={{ color: COLORS.textMute }}> · adj</Text> : null}
                      </Text>
                    ) : (
                      <Text style={[styles.sub, { color: COLORS.success }]}>
                        Full salary{r.isOverridden ? ' · adjusted' : ''}
                      </Text>
                    )}
                    {/* Attendance counts row */}
                    {(r.present != null || r.littleLate > 0 || r.veryLate > 0 || (r.absent ?? 0) > 0) && (
                      <View style={styles.attendRow}>
                        {r.present != null && r.present > 0 ? <Text style={styles.attendChip}><Text style={{ color: '#16A34A' }}>●</Text> {r.present}P</Text> : null}
                        {r.littleLate > 0 ? <Text style={styles.attendChip}><Text style={{ color: '#D97706' }}>●</Text> {r.littleLate}LL</Text> : null}
                        {r.veryLate > 0 ? <Text style={styles.attendChip}><Text style={{ color: '#EA580C' }}>●</Text> {r.veryLate}VL</Text> : null}
                        {(r.absent ?? 0) > 0 ? <Text style={styles.attendChip}><Text style={{ color: '#DC2626' }}>●</Text> {r.absent}A</Text> : null}
                      </View>
                    )}
                    {/* Salary till today — current month only, small */}
                    {till != null && (
                      <Text style={styles.tillToday}>
                        Till today: <Text style={styles.tillAmt}>{rupee(till)}</Text>
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.lockedSub}><Ionicons name="lock-closed" size={11} color={COLORS.textMute} /> Access from {r.ownerName || 'owner'}</Text>
                )}
              </View>
              {r.access ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.payable}>{rupee(r.payable)}</Text>
                  <Text style={styles.payableLbl}>{r.deduction > 0 ? 'payable' : 'monthly'}</Text>
                  {r.isOverridden && <Ionicons name="create" size={13} color={COLORS.primary} />}
                </View>
              ) : (
                <Ionicons name="lock-closed" size={20} color={COLORS.textMute} />
              )}
            </Pressable>
          );
        })}

        {!loading && noSalary.length > 0 && (
          <>
            <Text style={styles.sectionLbl}>No salary set</Text>
            {noSalary.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('SalaryDetail', {
                  id: r.id, name: r.name, year: ym.year, month: ym.month,
                  allEmployees: withSalary.map((e) => ({ id: e.id, name: e.name })),
                  employeeIndex: 0,
                })}
                style={[styles.card, SHADOW.card, { opacity: 0.85 }]}>
                <View style={[styles.avatar, { backgroundColor: COLORS.surfaceAlt }]}><Text style={[styles.avatarTxt, { color: COLORS.textMute }]}>{r.name?.[0]?.toUpperCase() || '?'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.sub}>{r.designation || 'Team Member'}</Text>
                </View>
                <View style={styles.addBtn}><Ionicons name="add" size={16} color={COLORS.primary} /><Text style={styles.addTxt}>Set</Text></View>
              </Pressable>
            ))}
          </>
        )}

        {!loading && rows.length === 0 && <Text style={styles.empty}>No employees yet.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.lg, marginTop: SP.md },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  monthLbl: { ...TYPE.title, fontSize: 17, color: COLORS.white, fontWeight: '800', minWidth: 150, textAlign: 'center' },
  expenseCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.lg, padding: SP.lg, marginTop: SP.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  expenseLbl: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  expenseAmt: { fontSize: 34, fontWeight: '900', color: COLORS.white, marginTop: 4, fontVariant: ['tabular-nums'] },
  expenseSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sectionLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SP.lg, marginBottom: SP.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  cardLocked: { backgroundColor: COLORS.surfaceAlt },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.primary },
  name: { ...TYPE.title, color: COLORS.text },
  sub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2 },
  tillToday: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 3 },
  tillAmt: { color: COLORS.primary, fontWeight: '800' },
  lockedSub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  payable: { ...TYPE.title, fontSize: 17, color: COLORS.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  payableLbl: { ...TYPE.cap, color: COLORS.textMute, fontSize: 10, textAlign: 'right', marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primaryTint, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 },
  addTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '800' },
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  attendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  attendChip: { ...TYPE.cap, fontSize: 10, color: COLORS.textMute, fontWeight: '700' },
});
