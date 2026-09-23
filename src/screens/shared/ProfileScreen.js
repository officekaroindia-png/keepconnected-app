import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Modal, Switch, Animated, LayoutAnimation,
  UIManager, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { getSettings, updateSettings } from '../../api/extra';
import { updateMyProfile } from '../../api/day';
import { getCoordsAndAddress } from '../../hooks/useLocation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOW = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];
const toHHMM = (m) => `${String(Math.floor((m ?? 0) / 60)).padStart(2, '0')}:${String((m ?? 0) % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// ─── Tab definitions ───────────────────────────────────────────────────────
const TABS = [
  { id: 'general', label: 'General', icon: 'settings-outline' },
  { id: 'account', label: 'Account', icon: 'person-outline' },
  { id: 'management', label: 'Management', icon: 'grid-outline' },
];

// ─── All searchable settings keywords (for search to work) ────────────────
const SEARCH_MAP = {
  'shift start': 'general', 'shift end': 'general', 'work hours': 'general',
  'lateness': 'general', 'grace': 'general', 'late': 'general',
  'half day': 'general', 'weekly off': 'general', 'off day': 'general',
  'leave deduction': 'general', 'leave deductions': 'general', 'little late leave': 'general',
  'very late leave': 'general', 'half day leave': 'general', 'deduction': 'general',
  'leaves per month': 'general', 'leave quota': 'general',
  'leave accrual': 'general', 'carry over': 'general', 'carryover': 'general', 'accrue': 'general', 'rollover': 'general',
  'overtime': 'general', 'work from home': 'general', 'wfh': 'general',
  'auto checkout': 'general', 'auto check-out': 'general', 'checkout': 'general',
  'check-out': 'general', 'forgot checkout': 'general', 'automatic checkout': 'general',
  'auto absent': 'general', 'automatic absent': 'general', 'mark absent': 'general', 'absent': 'general',
  'office location': 'general', 'holiday': 'general', 'checkin cutoff': 'general',
  'block checkin': 'general', 'on-time window': 'general', 'fun': 'general',
  'animation': 'general', 'radius': 'general', 'latitude': 'general',
  'mobile': 'account', 'email': 'account', 'company': 'account',
  'join code': 'account', 'logout': 'account', 'password': 'account',
  'profile': 'account', 'name': 'account',
  'admins': 'management', 'tasks': 'management', 'custom actions': 'management',
  'check-in spots': 'management', 'away': 'management', 'shifts': 'management',
  'salaries': 'management', 'employees': 'management', 'staff': 'management',
};

// ─── Tooltip/accordion item ────────────────────────────────────────────────
const TooltipRow = ({ label, tip, children, icon, color }) => {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };
  return (
    <View style={ttStyles.wrap}>
      <View style={ttStyles.labelRow}>
        <Text style={ttStyles.label}>{label}</Text>
        <Pressable onPress={toggle} hitSlop={10} style={ttStyles.infoBtn}>
          <Ionicons name={open ? 'information-circle' : 'information-circle-outline'} size={17} color={open ? COLORS.primary : COLORS.textMute} />
        </Pressable>
      </View>
      {open && (
        <View style={ttStyles.tipBox}>
          <Ionicons name="bulb-outline" size={14} color={COLORS.gold} style={{ marginTop: 1 }} />
          <Text style={ttStyles.tipTxt}>{tip}</Text>
        </View>
      )}
      {children}
    </View>
  );
};
const ttStyles = StyleSheet.create({
  wrap: { marginBottom: SP.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700' },
  infoBtn: { padding: 2 },
  tipBox: { flexDirection: 'row', gap: 6, backgroundColor: '#FEFCE8', borderRadius: R.sm, padding: SP.sm, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  tipTxt: { ...TYPE.cap, color: '#92400E', lineHeight: 16, flex: 1 },
});

// ─── Section header ────────────────────────────────────────────────────────
const SectionHead = ({ icon, title, color }) => (
  <View style={secStyles.wrap}>
    <View style={[secStyles.icon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
    <Text style={[secStyles.title, { color }]}>{title}</Text>
  </View>
);
const secStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: SP.lg, paddingTop: SP.lg, paddingBottom: SP.sm },
  icon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.label, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
});

// ─── Navigation row (goes to another screen) ───────────────────────────────
const NavRow = ({ icon, label, desc, color, onPress, badge }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [navStyles.row, pressed && { backgroundColor: COLORS.surfaceAlt }]}>
    <View style={[navStyles.icon, { backgroundColor: (color || COLORS.primary) + '18' }]}>
      <Ionicons name={icon} size={18} color={color || COLORS.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={navStyles.label}>{label}</Text>
      {desc && <Text style={navStyles.desc}>{desc}</Text>}
    </View>
    {badge && <View style={navStyles.badge}><Text style={navStyles.badgeTxt}>{badge}</Text></View>}
    <Ionicons name="chevron-forward" size={16} color={COLORS.textMute} />
  </Pressable>
);
const navStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: 13 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { ...TYPE.title, fontSize: 14, color: COLORS.text },
  desc: { ...TYPE.cap, color: COLORS.textMute, marginTop: 1 },
  badge: { backgroundColor: COLORS.primary, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4 },
  badgeTxt: { ...TYPE.cap, color: COLORS.white, fontSize: 10 },
});

// ─── Info row (static display) ─────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <View style={infoStyles.row}>
    <View style={infoStyles.icon}><Ionicons name={icon} size={16} color={COLORS.primary} /></View>
    <Text style={infoStyles.label}>{label}</Text>
    <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
  </View>
);
const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: 13 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, ...TYPE.title, fontSize: 14, color: COLORS.text },
  value: { ...TYPE.body, color: COLORS.textSoft, maxWidth: 130 },
});

// ─── Styled input ─────────────────────────────────────────────────────────
const SInput = (props) => <TextInput style={inputStyles.input} placeholderTextColor={COLORS.textMute} {...props} />;
const inputStyles = StyleSheet.create({
  input: { height: 46, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
});

// ─── Toggle row ────────────────────────────────────────────────────────────
const ToggleRow = ({ label, tip, value, onChange, borderTop }) => (
  <TooltipRow label={label} tip={tip}>
    <View style={[togStyles.row, borderTop && { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SP.md }]}>
      <Switch value={!!value} onValueChange={onChange} trackColor={{ true: COLORS.primary, false: COLORS.border }} thumbColor={COLORS.white} />
      <Text style={togStyles.state}>{value ? 'On' : 'Off'}</Text>
    </View>
  </TooltipRow>
);
const togStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  state: { ...TYPE.cap, color: COLORS.textMute },
});

const Div = () => <View style={{ height: 1, backgroundColor: COLORS.border }} />;
const Card = ({ children, style }) => <View style={[cStyles.card, SHADOW.card, style]}>{children}</View>;
const cStyles = StyleSheet.create({ card: { backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SP.md } });

// ═══════════════════════════════════════════════════════════════════════════
export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshMe } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [holiday, setHoliday] = useState('');

  const [mobileModal, setMobileModal] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [mobileBusy, setMobileBusy] = useState(false);
  const [mobileErr, setMobileErr] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const d = await getSettings();
      setS({
        lat: d.officeLocation?.lat != null ? String(d.officeLocation.lat) : '',
        lng: d.officeLocation?.lng != null ? String(d.officeLocation.lng) : '',
        radius: String(d.officeLocation?.radius ?? 150),
        start: toHHMM(d.settings?.shiftStartMinute),
        end: toHHMM(d.settings?.shiftEndMinute),
        grace: String(d.settings?.graceMinutes ?? 15),
        onTimeWindow: String(d.settings?.onTimeWindowMinutes ?? 0),
        lpm: String(d.settings?.leavesPerMonth ?? 2),
        littleLatePerLeave: String(d.settings?.littleLatePerLeave ?? 6),
        veryLatePerLeave: String(d.settings?.veryLatePerLeave ?? 3),
        halfDayLeaveCost: String(d.settings?.halfDayLeaveCost ?? 0.5),
        leaveCarryOver: d.settings?.leaveCarryOver === true,
        halfDayEnabled: d.settings?.halfDayEnabled !== false,
        halfDayAfter: String(d.settings?.halfDayAfterMinutes ?? 120),
        checkinCutoffEnabled: d.settings?.checkinCutoffEnabled === true,
        checkinCutoff: toHHMM(d.settings?.checkinCutoffMinutes ?? 720),
        weeklyOffDays: Array.isArray(d.settings?.weeklyOffDays) && d.settings.weeklyOffDays.length
          ? d.settings.weeklyOffDays : [d.settings?.weeklyOffDay ?? 0],
        blockCheckinOnOffDays: d.settings?.blockCheckinOnOffDays ?? false,
        overtimeWindowHours: String(d.settings?.overtimeWindowHours ?? 4),
        autoCheckoutEnabled: d.settings?.autoCheckoutEnabled !== false,
        autoCheckoutTime: toHHMM(d.settings?.autoCheckoutMinute ?? d.settings?.shiftEndMinute ?? 1080),
        autoAbsentEnabled: d.settings?.autoAbsentEnabled === true,
        autoAbsentTime: toHHMM(d.settings?.autoAbsentMinute ?? 780),
        autoApproveWFH: d.settings?.autoApproveWFH !== false,
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

  const addHoliday = () => {
    if (!isDate(holiday)) return Alert.alert('Date format', 'Please use YYYY-MM-DD format (e.g. 2025-08-15)');
    setS((o) => ({ ...o, nationalHolidays: [...new Set([...o.nationalHolidays, holiday])].sort() }));
    setHoliday('');
  };
  const removeHoliday = (d) => setS((o) => ({ ...o, nationalHolidays: o.nationalHolidays.filter((x) => x !== d) }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        officeLocation: { lat: s.lat ? Number(s.lat) : null, lng: s.lng ? Number(s.lng) : null, radius: Number(s.radius) || 150 },
        settings: {
          shiftStartMinute: toMin(s.start), shiftEndMinute: toMin(s.end),
          graceMinutes: Number(s.grace) || 15,
          onTimeWindowMinutes: Math.max(0, Number(s.onTimeWindow) || 0),
          leavesPerMonth: Number(s.lpm) || 2,
          littleLatePerLeave: s.littleLatePerLeave === '' ? 6 : Math.max(0, Math.round(Number(s.littleLatePerLeave) || 0)),
          veryLatePerLeave: s.veryLatePerLeave === '' ? 3 : Math.max(0, Math.round(Number(s.veryLatePerLeave) || 0)),
          halfDayLeaveCost: s.halfDayLeaveCost === '' ? 0.5 : Math.max(0, Number(s.halfDayLeaveCost) || 0),
          leaveCarryOver: !!s.leaveCarryOver,
          halfDayEnabled: s.halfDayEnabled,
          halfDayAfterMinutes: Math.max(0, Number(s.halfDayAfter) || 120),
          checkinCutoffEnabled: !!s.checkinCutoffEnabled,
          checkinCutoffMinutes: toMin(s.checkinCutoff),
          weeklyOffDays: s.weeklyOffDays,
          weeklyOffDay: s.weeklyOffDays?.[0] ?? 0,
          nationalHolidays: s.nationalHolidays,
          blockCheckinOnOffDays: !!s.blockCheckinOnOffDays,
          overtimeWindowHours: Math.max(1, Number(s.overtimeWindowHours) || 4),
          autoCheckoutEnabled: !!s.autoCheckoutEnabled,
          autoCheckoutMinute: toMin(s.autoCheckoutTime),
          autoAbsentEnabled: !!s.autoAbsentEnabled,
          autoAbsentMinute: toMin(s.autoAbsentTime),
          autoApproveWFH: !!s.autoApproveWFH,
        },
      });
      await refreshMe?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Could not save settings'); }
    finally { setSaving(false); }
  };

  const openMobileEdit = () => { setMobileInput(user?.mobile || ''); setMobileErr(''); setMobileModal(true); };
  const saveMobile = async () => {
    setMobileErr('');
    const digits = String(mobileInput).replace(/\D/g, '');
    if (digits.length < 7) { setMobileErr('Enter a valid mobile number'); return; }
    setMobileBusy(true);
    try { await updateMyProfile({ mobile: mobileInput }); await refreshMe?.(); setMobileModal(false); }
    catch (e) { setMobileErr(e?.response?.data?.message || 'Could not update'); }
    finally { setMobileBusy(false); }
  };

  // ── Search: auto-switch tab on match ─────────────────────────────────────
  const searchLower = search.toLowerCase().trim();
  const searchTargetTab = useMemo(() => {
    if (!searchLower) return null;
    for (const [kw, tab] of Object.entries(SEARCH_MAP)) {
      if (kw.includes(searchLower) || searchLower.includes(kw)) return tab;
    }
    return null;
  }, [searchLower]);

  const displayTab = searchLower && searchTargetTab ? searchTargetTab : activeTab;

  // ── Derived time labels for display ──────────────────────────────────────
  const onTimeEnd = s ? toHHMM(toMin(s.start) + (Number(s.onTimeWindow) || 0)) : '';
  const lateEnd = s ? toHHMM(toMin(s.start) + (Number(s.onTimeWindow) || 0) + (Number(s.grace) || 0)) : '';
  const halfDayFrom = s ? toHHMM(toMin(s.start) + (Number(s.onTimeWindow) || 0) + (Number(s.grace) || 0) + (Number(s.halfDayAfter) || 0)) : '';

  // ═══════════════════════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      {/* ── Gradient Header ── */}
      <LinearGradient colors={['#0B1F3A', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <View style={styles.headerBar}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </Pressable>
          )}
          <View style={styles.userPill}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{user?.name?.[0]}</Text></View>
            <View>
              <Text style={styles.headerName}>{user?.name}</Text>
              <Text style={styles.headerRole}>{isAdmin ? '⚙ Admin' : '👤 Employee'} · {user?.company?.name}</Text>
            </View>
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={16} color={searchFocused ? COLORS.primary : COLORS.textMute} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search settings…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>

        {/* ── Tab bar (only when not searching) ── */}
        {!searchLower && (
          <View style={styles.tabBar}>
            {TABS.map((t) => {
              // Hide management tab for non-admin
              if (t.id === 'management' && !isAdmin) return null;
              if (t.id === 'general' && !isAdmin) return null;
              const active = activeTab === t.id;
              return (
                <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={[styles.tab, active && styles.tabActive]}>
                  <Ionicons name={t.icon} size={14} color={active ? COLORS.primary : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {searchLower && searchTargetTab && (
          <View style={styles.searchHint}>
            <Ionicons name="arrow-forward-circle" size={14} color={COLORS.gold} />
            <Text style={styles.searchHintTxt}>Showing results in "{TABS.find(t => t.id === searchTargetTab)?.label}"</Text>
          </View>
        )}
      </LinearGradient>

      {/* ═══════════════════════════════════════════════════════════════
          GENERAL SETTINGS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {displayTab === 'general' && isAdmin && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}>
          {!s && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

          {s && (
            <>
              {/* ── WORK HOURS & LATENESS ── */}
              <SectionHead icon="time-outline" title="Work Hours & Lateness" color={COLORS.primary} />
              <Card>
                <View style={styles.cardInner}>
                  {/* Shift times */}
                  <View style={styles.twoCol}>
                    <TooltipRow label="Shift starts" tip="The official start time of the workday. Hours worked are always counted from this time onwards, regardless of when the employee checks in.">
                      <SInput value={s.start} onChangeText={set('start')} placeholder="09:00" />
                    </TooltipRow>
                    <TooltipRow label="Shift ends" tip="The official end time of the workday. Forgotten check-outs are closed by the separate Auto Check-out setting below (which defaults to this time).">
                      <SInput value={s.end} onChangeText={set('end')} placeholder="18:00" />
                    </TooltipRow>
                  </View>

                  {/* On-time window */}
                  <TooltipRow label="On-time window (minutes)" tip={`Employees who check in within this many minutes after shift start are still marked 'On Time' (green). Example: with a 10-min window, anyone checking in by ${onTimeEnd} is on time.`}>
                    <SInput value={s.onTimeWindow} onChangeText={set('onTimeWindow')} keyboardType="number-pad" placeholder="0" />
                  </TooltipRow>

                  {/* Late window */}
                  <TooltipRow label="'Little Late' window (minutes)" tip={`After the on-time window ends, employees checking in within this many extra minutes are 'Little Late' (yellow). Beyond this → 'Very Late' (red). Currently: little late until ${lateEnd}.`}>
                    <SInput value={s.grace} onChangeText={set('grace')} keyboardType="number-pad" placeholder="15" />
                  </TooltipRow>

                  {/* Half-day toggle */}
                  <ToggleRow
                    label="Half-day for very-late check-ins"
                    tip="When on, employees who check in very late and then stay much later get marked as half-day instead of a full absence. This is kinder than a full leave deduction for people who come in extremely late but still work."
                    value={s.halfDayEnabled}
                    onChange={(v) => setS((o) => ({ ...o, halfDayEnabled: v }))}
                  />
                  {s.halfDayEnabled && (
                    <TooltipRow label={`Half-day after (minutes past 'Very Late' mark)`} tip={`Check-ins beyond this point count as half-day. With current settings, that's anyone arriving after ~${halfDayFrom}.`}>
                      <SInput value={s.halfDayAfter} onChangeText={set('halfDayAfter')} keyboardType="number-pad" placeholder="120" />
                    </TooltipRow>
                  )}

                  {/* Default leaves */}
                  <TooltipRow label="Paid leaves per month (default)" tip="How many paid leaves each employee gets by default each month before salary deductions apply. Individual employees can have a custom allowance set under Salaries.">
                    <SInput value={s.lpm} onChangeText={set('lpm')} keyboardType="number-pad" placeholder="2" />
                  </TooltipRow>

                  {/* Check-in cutoff */}
                  <ToggleRow
                    label="Lock check-in after a cut-off time"
                    tip="After this time, employees can no longer check in themselves. Admins can still manually record attendance. Useful for preventing very-late check-ins that skew records."
                    value={s.checkinCutoffEnabled}
                    onChange={(v) => setS((o) => ({ ...o, checkinCutoffEnabled: v }))}
                  />
                  {s.checkinCutoffEnabled && (
                    <TooltipRow label="Check-in closes at" tip="No employee self-check-in is accepted after this time. Admins bypass this.">
                      <SInput value={s.checkinCutoff} onChangeText={set('checkinCutoff')} placeholder="12:00" />
                    </TooltipRow>
                  )}
                </View>
              </Card>

              {/* ── LEAVE DEDUCTIONS ── */}
              <SectionHead icon="remove-circle-outline" title="Leave Deductions" color="#DC2626" />
              <Card>
                <View style={styles.cardInner}>
                  <TooltipRow
                    label="Little-late days per 1 leave"
                    tip="How many 'Little Late' (yellow) days add up to one deducted leave. Example: 6 means every 6 little-late days costs 1 leave. Set 0 to never deduct a leave for little-late days."
                  >
                    <SInput value={s.littleLatePerLeave} onChangeText={set('littleLatePerLeave')} keyboardType="number-pad" placeholder="6" />
                  </TooltipRow>
                  <TooltipRow
                    label="Very-late days per 1 leave"
                    tip="How many 'Very Late' (red) days add up to one deducted leave. Example: 3 means every 3 very-late days costs 1 leave. Set 0 to never deduct a leave for very-late days."
                  >
                    <SInput value={s.veryLatePerLeave} onChangeText={set('veryLatePerLeave')} keyboardType="number-pad" placeholder="3" />
                  </TooltipRow>
                  <TooltipRow
                    label="Half-day leave cost"
                    tip="How many leaves one half-day consumes — this is also its salary impact. Default 0.5. Use 0 for no deduction, or 1 to count a half-day as a full leave."
                  >
                    <SInput value={s.halfDayLeaveCost} onChangeText={set('halfDayLeaveCost')} keyboardType="decimal-pad" placeholder="0.5" />
                  </TooltipRow>
                  <View style={styles.acNote}>
                    <Ionicons name="information-circle-outline" size={15} color={COLORS.textMute} />
                    <Text style={styles.acNoteTxt}>
                      These come off each employee's monthly paid-leave quota and stack together. Sundays, weekly-offs and holidays never count. The timing that defines little-late vs very-late is set above in Work Hours & Lateness.
                    </Text>
                  </View>
                </View>
              </Card>

              {/* ── LEAVE ACCRUAL ── */}
              <SectionHead icon="albums-outline" title="Leave Accrual" color="#0D9488" />
              <Card>
                <View style={styles.cardInner}>
                  <ToggleRow
                    label="Carry over unused leaves"
                    tip="OFF (default): each month starts fresh — the monthly quota resets and unused leaves are lost. ON: unused leaves roll over and add up, so an employee's available balance grows month over month. Overusing in a month is still deducted from that month's salary and never carries a negative into the next month."
                    value={s.leaveCarryOver}
                    onChange={(v) => setS((o) => ({ ...o, leaveCarryOver: v }))}
                  />
                  <View style={styles.acNote}>
                    <Ionicons name={s.leaveCarryOver ? 'trending-up' : 'refresh'} size={15} color={COLORS.textMute} />
                    <Text style={styles.acNoteTxt}>
                      {s.leaveCarryOver
                        ? `Unused leaves accumulate. Each month adds ${s.lpm || 2} new paid leave${Number(s.lpm) === 1 ? '' : 's'} on top of whatever was left over — employees see their growing balance on their dashboard.`
                        : `Everyone gets ${s.lpm || 2} paid leave${Number(s.lpm) === 1 ? '' : 's'} each month; unused ones don't carry into the next month.`}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* ── AUTO CHECK-OUT ── */}
              <SectionHead icon="log-out-outline" title="Auto Check-out" color="#0EA5E9" />
              <Card>
                <View style={styles.cardInner}>
                  <ToggleRow
                    label="Automatic check-out"
                    tip="When ON: if an employee forgets to check out, the app closes their day automatically at the time below, and records THAT time as their check-out so worked hours stay accurate. When OFF: a forgotten day stays open with no check-out until an admin sets it manually from that person's timeline."
                    value={s.autoCheckoutEnabled}
                    onChange={(v) => setS((o) => ({ ...o, autoCheckoutEnabled: v }))}
                  />
                  {s.autoCheckoutEnabled ? (
                    <>
                      <TooltipRow
                        label="Auto check-out time"
                        tip={`If someone forgets to check out, their check-out is recorded at this time on that day. Overtime days close later — ${s.overtimeWindowHours || 4}h after shift end. Employees who have their own shift end are closed at their personal end time instead.`}
                      >
                        <SInput value={s.autoCheckoutTime} onChangeText={set('autoCheckoutTime')} placeholder="18:30" />
                      </TooltipRow>
                      <View style={styles.acNote}>
                        <Ionicons name="information-circle-outline" size={15} color={COLORS.textMute} />
                        <Text style={styles.acNoteTxt}>
                          Forgot to check out? The day is auto-closed at {s.autoCheckoutTime} and counts hours up to then.
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.acNote}>
                      <Ionicons name="alert-circle-outline" size={15} color={COLORS.warn} />
                      <Text style={styles.acNoteTxt}>
                        Forgotten check-outs stay open. Close them manually from the staff member's timeline — tap the day, then edit the check-out time.
                      </Text>
                    </View>
                  )}
                </View>
              </Card>

              {/* ── AUTO ABSENT ── */}
              <SectionHead icon="close-circle-outline" title="Auto Absent" color="#DC2626" />
              <Card>
                <View style={styles.cardInner}>
                  <ToggleRow
                    label="Automatically mark absent"
                    tip="When ON: on a working day, anyone who hasn't checked in by the time below is marked Absent automatically, and shows up instantly in Staff Status and their timeline. If they check in later, it changes to the correct late status. Weekly-offs and holidays are never auto-marked."
                    value={s.autoAbsentEnabled}
                    onChange={(v) => setS((o) => ({ ...o, autoAbsentEnabled: v }))}
                  />
                  {s.autoAbsentEnabled && (
                    <>
                      <TooltipRow
                        label="Mark absent after"
                        tip="The cut-off time. Anyone with no check-in once this time passes is marked Absent for the day."
                      >
                        <SInput value={s.autoAbsentTime} onChangeText={set('autoAbsentTime')} placeholder="13:00" />
                      </TooltipRow>
                      <View style={styles.acNote}>
                        <Ionicons name="information-circle-outline" size={15} color={COLORS.textMute} />
                        <Text style={styles.acNoteTxt}>
                          After {s.autoAbsentTime}, no check-in = Absent (counts toward leave/salary like any absent day). A later check-in still overrides it.
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </Card>

              {/* ── WEEKLY OFF DAYS ── */}
              <SectionHead icon="calendar-outline" title="Weekly Off Days" color="#7C3AED" />
              <Card>
                <View style={styles.cardInner}>
                  <TooltipRow label="Select weekly off days" tip="Days marked here are never counted as leaves and never deduct salary. Employees absent on an off-day are simply not working — no penalty.">
                    <View style={styles.dowGrid}>
                      {DOW.map(([lbl, d]) => {
                        const on = s.weeklyOffDays?.includes(d);
                        return (
                          <Pressable key={d} onPress={() => setS((o) => {
                            const cur = o.weeklyOffDays || [];
                            let next;
                            if (cur.includes(d)) {
                              next = cur.filter((x) => x !== d);
                              if (next.length === 0) return o;
                            } else {
                              if (cur.length >= 6) { Alert.alert('Too many off days', 'At least one working day must remain.'); return o; }
                              next = [...cur, d].sort();
                            }
                            return { ...o, weeklyOffDays: next };
                          })} style={[styles.dowChip, on && styles.dowChipOn]}>
                            <Text style={[styles.dowTxt, on && styles.dowTxtOn]}>{lbl}</Text>
                            {on && <Ionicons name="checkmark" size={11} color={COLORS.white} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  </TooltipRow>

                  <ToggleRow
                    label="Block check-in on off days"
                    tip="Prevents employees from checking in on weekly off days. The app will reject their check-in. Admins can still record attendance manually if needed."
                    value={s.blockCheckinOnOffDays}
                    onChange={(v) => setS((o) => ({ ...o, blockCheckinOnOffDays: v }))}
                  />
                </View>
              </Card>

              {/* ── OVERTIME ── */}
              <SectionHead icon="trending-up-outline" title="Overtime" color="#059669" />
              <Card>
                <View style={styles.cardInner}>
                  <TooltipRow label="Overtime window (hours)" tip="When an admin marks an employee on overtime, the employee can check out themselves for this many hours after their shift ends. After this window, auto-checkout fires. Maximum effective window is capped at 11:59 PM.">
                    <SInput value={s.overtimeWindowHours} onChangeText={set('overtimeWindowHours')} keyboardType="decimal-pad" placeholder="4" />
                  </TooltipRow>
                </View>
              </Card>

              {/* ── WORK FROM HOME ── */}
              <SectionHead icon="home-outline" title="Work From Home" color="#0E7490" />
              <Card>
                <View style={styles.cardInner}>
                  <ToggleRow
                    label="Auto-approve WFH requests"
                    tip="ON: WFH check-ins are approved immediately and hours count at once — no admin action needed. OFF: Each WFH request waits for admin approval before hours are credited. Good for companies that want oversight on remote work."
                    value={s.autoApproveWFH}
                    onChange={(v) => setS((o) => ({ ...o, autoApproveWFH: v }))}
                  />
                </View>
              </Card>

              {/* ── OFFICE LOCATION ── */}
              <SectionHead icon="location-outline" title="Office Location" color={COLORS.warn} />
              <Card>
                <View style={styles.cardInner}>
                  <Pressable onPress={useMyLocation} style={styles.gpsBtn}>
                    <Ionicons name="locate" size={17} color={COLORS.primary} />
                    <Text style={styles.gpsTxt}>Use my current location</Text>
                  </Pressable>
                  <View style={styles.twoCol}>
                    <TooltipRow label="Latitude" tip="GPS latitude of your office. Tap 'Use my current location' while at the office for the most accurate value.">
                      <SInput value={s.lat} onChangeText={set('lat')} keyboardType="numbers-and-punctuation" placeholder="—" />
                    </TooltipRow>
                    <TooltipRow label="Longitude" tip="GPS longitude. Pair with latitude to define the office centre point.">
                      <SInput value={s.lng} onChangeText={set('lng')} keyboardType="numbers-and-punctuation" placeholder="—" />
                    </TooltipRow>
                  </View>
                  <TooltipRow label="Check-in radius (metres)" tip="Employees must be within this distance from the office coordinates to check in. 100–200 m works well for most offices. Increase if GPS variance causes false rejects.">
                    <SInput value={s.radius} onChangeText={set('radius')} keyboardType="number-pad" placeholder="150" />
                  </TooltipRow>
                </View>
              </Card>

              {/* ── NATIONAL HOLIDAYS ── */}
              <SectionHead icon="flag-outline" title="National Holidays" color={COLORS.danger} />
              <Card>
                <View style={styles.cardInner}>
                  <TooltipRow label="Add a holiday (YYYY-MM-DD)" tip="Holidays are never counted as leaves or absences. Employees absent on a holiday face no salary deduction. Example: 2025-08-15 for Independence Day.">
                    <View style={styles.addRow}>
                      <SInput style={{ flex: 1 }} value={holiday} onChangeText={setHoliday} placeholder="2025-08-15" />
                      <Pressable onPress={addHoliday} style={styles.addBtn}>
                        <Ionicons name="add" size={20} color={COLORS.white} />
                      </Pressable>
                    </View>
                  </TooltipRow>
                  {s.nationalHolidays.length > 0 ? (
                    s.nationalHolidays.map((d) => (
                      <View key={d} style={styles.holidayChip}>
                        <Ionicons name="flag" size={14} color={COLORS.danger} />
                        <Text style={styles.holidayTxt}>{d}</Text>
                        <Pressable onPress={() => removeHoliday(d)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                          <Ionicons name="close-circle" size={18} color={COLORS.textMute} />
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyHoliday}>
                      <Ionicons name="calendar-clear-outline" size={20} color={COLORS.textMute} />
                      <Text style={styles.emptyHolidayTxt}>No holidays added yet</Text>
                    </View>
                  )}
                </View>
              </Card>

              {/* ── FUN ANIMATIONS ── */}
              <SectionHead icon="sparkles-outline" title="Fun & Animations" color={COLORS.gold} />
              <Card>
                <NavRow
                  icon="sparkles"
                  label="Fun Animations"
                  desc="Configure celebration animations for your team"
                  color={COLORS.gold}
                  onPress={() => navigation.navigate('Animations')}
                />
              </Card>

              {/* ── SAVE BUTTON ── */}
              <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.saveBtn, SHADOW.lift, (pressed || saved) && { backgroundColor: COLORS.success }]}>
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : saved
                    ? <View style={styles.savedRow}><Ionicons name="checkmark-circle" size={20} color={COLORS.white} /><Text style={styles.saveTxt}>Saved!</Text></View>
                    : <><Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} /><Text style={styles.saveTxt}>Save Settings</Text></>}
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ACCOUNT TAB
      ═══════════════════════════════════════════════════════════════ */}
      {displayTab === 'account' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}>

          {/* Profile Info */}
          <SectionHead icon="person-circle-outline" title="Your Profile" color={COLORS.primary} />
          <Card>
            <InfoRow icon="person-outline" label="Name" value={user?.name} />
            <Div />
            <Pressable onPress={openMobileEdit} style={({ pressed }) => [pressed && { backgroundColor: COLORS.surfaceAlt }]}>
              <View style={navStyles.row}>
                <View style={[navStyles.icon, { backgroundColor: COLORS.primaryTint }]}>
                  <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={navStyles.label}>Mobile number</Text>
                  <Text style={navStyles.desc}>{user?.mobile || 'Not set'}</Text>
                </View>
                <View style={styles.editChip}>
                  <Ionicons name="pencil" size={12} color={COLORS.primary} />
                  <Text style={styles.editChipTxt}>Edit</Text>
                </View>
              </View>
            </Pressable>
            {user?.email && <><Div /><InfoRow icon="mail-outline" label="Email" value={user.email} /></>}
          </Card>

          {/* Company Info */}
          <SectionHead icon="business-outline" title="Company" color="#059669" />
          <Card>
            <InfoRow icon="business-outline" label="Company name" value={user?.company?.name} />
            {isAdmin && (
              <>
                <Div />
                <View style={[navStyles.row, { paddingVertical: 14 }]}>
                  <View style={[navStyles.icon, { backgroundColor: COLORS.goldTint }]}>
                    <Ionicons name="key-outline" size={18} color={COLORS.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={navStyles.label}>Team join code</Text>
                    <Text style={[navStyles.desc, { fontFamily: 'monospace', fontSize: 15, color: COLORS.text, letterSpacing: 3, marginTop: 2 }]}>
                      {user?.company?.joinCode}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Card>

          {/* Danger zone */}
          <SectionHead icon="warning-outline" title="Account Actions" color={COLORS.danger} />
          <Card>
            <Pressable onPress={logout} style={({ pressed }) => [navStyles.row, pressed && { backgroundColor: COLORS.dangerTint }]}>
              <View style={[navStyles.icon, { backgroundColor: COLORS.dangerTint }]}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              </View>
              <Text style={[navStyles.label, { color: COLORS.danger }]}>Log out</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.danger} />
            </Pressable>
          </Card>
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MANAGEMENT TAB
      ═══════════════════════════════════════════════════════════════ */}
      {displayTab === 'management' && isAdmin && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}>

          {/* People */}
          <SectionHead icon="people-outline" title="People & Access" color={COLORS.primary} />
          <Card>
            <NavRow icon="shield-checkmark-outline" label="Manage Admins" desc="Add or remove admin privileges" color={COLORS.primary} onPress={() => navigation.navigate('ManageAdmins')} />
            <Div />
            <NavRow icon="cash-outline" label="Salaries" desc="Set pay, leaves & deductions per employee" color="#059669" onPress={() => navigation.navigate('Salaries')} />
            <Div />
            <NavRow icon="time-outline" label="Shift Times (per employee)" desc="Override default shifts for individuals" color="#0E7490" onPress={() => navigation.navigate('Shifts')} />
          </Card>

          {/* Tasks & Actions */}
          <SectionHead icon="flash-outline" title="Tasks & Actions" color="#7C3AED" />
          <Card>
            <NavRow icon="list-outline" label="Manage Tasks" desc="Create tasks with time windows & locations" color="#7C3AED" onPress={() => navigation.navigate('TaskSetup')} />
            <Div />
            <NavRow icon="git-branch-outline" label="Custom Actions" desc="Add custom check-in/out action buttons" color="#DB2777" onPress={() => navigation.navigate('CustomActions')} />
          </Card>

          {/* Locations */}
          <SectionHead icon="location-outline" title="Locations" color={COLORS.warn} />
          <Card>
            <NavRow icon="pin-outline" label="Check-in Spots" desc="Define named locations employees can check into" color={COLORS.warn} onPress={() => navigation.navigate('CheckinSpots')} />
            <Div />
            <NavRow icon="airplane-outline" label="Away Check-ins" desc="Configure remote & field check-in rules" color="#0E7490" onPress={() => navigation.navigate('AwayCheckins')} />
          </Card>
        </ScrollView>
      )}

      {/* ── Mobile Edit Modal ── */}
      <Modal visible={mobileModal} transparent animationType="fade" onRequestClose={() => setMobileModal(false)}>
        <Pressable style={styles.mBackdrop} onPress={() => setMobileModal(false)} />
        <View style={styles.mCenter} pointerEvents="box-none">
          <View style={[styles.mCard, SHADOW.lift]}>
            <View style={styles.mHead}>
              <View style={styles.mIcon}><Ionicons name="call" size={20} color={COLORS.primary} /></View>
              <Text style={styles.mTitle}>Change mobile number</Text>
            </View>
            <Text style={styles.mSub}>This is your login number. Enter the new one below.</Text>
            {!!mobileErr && (
              <View style={styles.mErr}>
                <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
                <Text style={styles.mErrTxt}>{mobileErr}</Text>
              </View>
            )}
            <TextInput
              style={styles.mInput}
              value={mobileInput}
              onChangeText={setMobileInput}
              keyboardType="phone-pad"
              placeholder="Mobile number"
              placeholderTextColor={COLORS.textMute}
              autoFocus
            />
            <View style={styles.mBtns}>
              <Pressable onPress={() => setMobileModal(false)} style={[styles.mBtn, styles.mBtnCancel]}>
                <Text style={styles.mBtnCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveMobile} disabled={mobileBusy} style={[styles.mBtn, styles.mBtnSave]}>
                {mobileBusy ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.mBtnSaveTxt}>Save</Text>}
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

  // ── Header
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.sm, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  userPill: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarTxt: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  headerName: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  headerRole: { ...TYPE.cap, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  // ── Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: R.md, paddingHorizontal: SP.md, height: 42, marginBottom: SP.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchBarFocused: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.35)' },
  searchInput: { flex: 1, ...TYPE.body, color: COLORS.white, fontSize: 14, height: 42 },
  searchHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: SP.sm },
  searchHintTxt: { ...TYPE.cap, color: COLORS.gold },

  // ── Tabs
  tabBar: { flexDirection: 'row', gap: SP.xs, paddingBottom: SP.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: COLORS.white },
  tabTxt: { ...TYPE.label, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  tabTxtActive: { color: COLORS.primary },

  // ── Card inner padding
  cardInner: { padding: SP.lg },
  acNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SP.md, paddingHorizontal: 2 },
  acNoteTxt: { flex: 1, ...TYPE.cap, color: COLORS.textMute, lineHeight: 17 },

  // ── Two-column layout
  twoCol: { flexDirection: 'row', gap: SP.md },

  // ── Day-of-week grid
  dowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.sm },
  dowChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.sm, backgroundColor: COLORS.surfaceAlt, borderWidth: 1.5, borderColor: COLORS.border },
  dowChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dowTxt: { ...TYPE.label, fontSize: 13, color: COLORS.textSoft },
  dowTxtOn: { color: COLORS.white },

  // ── GPS button
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: R.md, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint, marginBottom: SP.md },
  gpsTxt: { ...TYPE.title, fontSize: 14, color: COLORS.primary },

  // ── Holiday chips
  addRow: { flexDirection: 'row', gap: SP.sm, alignItems: 'center' },
  addBtn: { width: 46, height: 46, borderRadius: R.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  holidayChip: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, paddingHorizontal: SP.md, paddingVertical: SP.sm, marginTop: SP.sm },
  holidayTxt: { ...TYPE.label, color: COLORS.danger, flex: 1 },
  emptyHoliday: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingTop: SP.md },
  emptyHolidayTxt: { ...TYPE.cap, color: COLORS.textMute },

  // ── Save button
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, height: 54, borderRadius: R.md, backgroundColor: COLORS.primary, marginTop: SP.sm },
  saveTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // ── Account tab
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 4 },
  editChipTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '700' },

  // ── Modal
  mBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.55)' },
  mCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.lg },
  mCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  mHead: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: 6 },
  mIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  mTitle: { ...TYPE.title, fontSize: 17, color: COLORS.text, fontWeight: '800' },
  mSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 4, lineHeight: 16 },
  mErr: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginTop: SP.md },
  mErrTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  mInput: { height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, marginTop: SP.md },
  mBtns: { flexDirection: 'row', gap: SP.md, marginTop: SP.lg },
  mBtn: { flex: 1, height: 50, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  mBtnCancel: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  mBtnCancelTxt: { ...TYPE.title, color: COLORS.textSoft },
  mBtnSave: { backgroundColor: COLORS.primary },
  mBtnSaveTxt: { ...TYPE.title, color: COLORS.white },
});
