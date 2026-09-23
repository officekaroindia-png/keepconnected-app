import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getSalary, setSalary, setSalaryOverride, grantSalaryAccess, revokeSalaryAccess, listSalaryAdmins } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function SalaryDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { id, name, year, month, allEmployees, employeeIndex } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(null); // { ownerName }
  const [editModal, setEditModal] = useState(false);
  const [overrideModal, setOverrideModal] = useState(false);
  const [accessModal, setAccessModal] = useState(false);

  // edit form
  const [salaryInput, setSalaryInput] = useState('');
  const [leavesInput, setLeavesInput] = useState('');
  // override form
  const [amountInput, setAmountInput] = useState('');
  const [excuseInput, setExcuseInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  // access
  const [admins, setAdmins] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLocked(null);
    try {
      const res = await getSalary(id, year, month);
      setData(res.data);
    } catch (e) {
      if (e?.response?.status === 403) { setLocked({ ownerName: e.response.data?.ownerName }); }
      else showToast('Failed to load', 'error');
    } finally { setLoading(false); }
  }, [id, year, month, showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = () => {
    setSalaryInput(data?.salary != null ? String(data.salary) : '');
    setLeavesInput(data?.allowedPaidLeaves != null ? String(data.allowedPaidLeaves) : '');
    setEditModal(true);
  };
  const saveEdit = async () => {
    const sal = Number(salaryInput);
    if (!salaryInput || isNaN(sal) || sal < 0) return showToast('Enter a valid salary', 'error');
    const lv = leavesInput === '' ? undefined : Number(leavesInput);
    if (lv !== undefined && (isNaN(lv) || lv < 0 || lv > 31)) return showToast('Allowed leaves 0–31', 'error');
    setSaving(true);
    try { await setSalary(id, sal, lv); setEditModal(false); showToast('Salary saved'); load(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openOverride = () => {
    setAmountInput(data?.isOverridden ? String(data.payable) : '');
    setExcuseInput(data?.excusedLeaves ? String(data.excusedLeaves) : '');
    setNoteInput(data?.overrideNote || '');
    setOverrideModal(true);
  };
  const saveOverride = async (clear) => {
    setSaving(true);
    try {
      if (clear) {
        await setSalaryOverride(id, year, month, null, null, '');
        showToast('Adjustment cleared');
      } else {
        const amt = amountInput === '' ? null : Number(amountInput);
        const exc = excuseInput === '' ? null : Number(excuseInput);
        if (amt !== null && (isNaN(amt) || amt < 0)) return showToast('Enter a valid amount', 'error');
        if (exc !== null && (isNaN(exc) || exc < 0 || exc > 31)) return showToast('Excused leaves 0–31', 'error');
        await setSalaryOverride(id, year, month, amt, exc, noteInput);
        showToast('Adjustment saved');
      }
      setOverrideModal(false); load();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openAccess = async () => {
    try { setAdmins(await listSalaryAdmins()); setAccessModal(true); }
    catch { showToast('Could not load admins', 'error'); }
  };
  const toggleGrant = async (adminId, granted) => {
    try {
      if (granted) await revokeSalaryAccess(id, adminId);
      else await grantSalaryAccess(id, adminId);
      load();
      setAdmins((prev) => prev); // keep modal open
      showToast(granted ? 'Access revoked' : 'Access granted');
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
  };

  // ---- Locked view ----
  if (locked) {
    return (
      <View style={styles.root}>
        <Header insets={insets} name={name} navigation={navigation} sub={`${MONTHS[month]} ${year}`} />
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed" size={48} color={COLORS.textMute} />
          <Text style={styles.lockedTitle}>Salary is private</Text>
          <Text style={styles.lockedMsg}>Only {locked.ownerName || 'the owner'} can view or edit {name}'s salary. Ask them to grant you access.</Text>
        </View>
      </View>
    );
  }

  const noSalary = data && data.hasSalary === false;

  return (
    <View style={styles.root}>
      <Header insets={insets} name={name} navigation={navigation} sub={`${MONTHS[month]} ${year}`} />
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {noSalary && (
          <View style={[styles.emptyCard, SHADOW.card]}>
            <Ionicons name="wallet-outline" size={40} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No salary set for {name}</Text>
            <Pressable style={styles.primaryBtn} onPress={openEdit}>
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.primaryBtnTxt}>Set salary</Text>
            </Pressable>
          </View>
        )}

        {data && data.hasSalary && (
          <>
            {/* Payable hero */}
            <View style={[styles.hero, SHADOW.card]}>
              <Text style={styles.heroLbl}>Payable · {MONTHS[month]} {year}</Text>
              <Text style={styles.heroAmt}>{rupee(data.payable)}</Text>
              {data.isOverridden && <View style={styles.badge}><Ionicons name="create" size={12} color={COLORS.primary} /><Text style={styles.badgeTxt}>Manually adjusted{data.overrideNote ? ` · ${data.overrideNote}` : ''}</Text></View>}
              {!data.isOverridden && data.deduction > 0 && <Text style={styles.heroSub}>Base {rupee(data.salary)} − {rupee(data.deduction)} deducted</Text>}
              {!data.isOverridden && data.deduction === 0 && <Text style={[styles.heroSub, { color: COLORS.success }]}>Full salary — no deductions</Text>}
            </View>

            {/* Breakdown */}
            <View style={[styles.breakdown, SHADOW.card]}>
              <Row label="Base salary" value={rupee(data.salary)} />
              <Row label={`Daily rate (÷ ${data.daysInMonth} days)`} value={rupee(data.dailyRate)} />
              <Divider />
              <Row label="Leaves taken" value={`${data.leavesConsumed}`} />
              <Row label="Allowed (paid) leaves" value={`${data.allowedLeaves}${data.excusedLeaves ? ` + ${data.excusedLeaves} excused` : ''}`} />
              <Row label="Excess leaves" value={`${data.excessLeaves}`} danger={data.excessLeaves > 0} />
              <Divider />
              <Row label="Deduction" value={data.deduction > 0 ? `− ${rupee(data.deduction)}` : rupee(0)} danger={data.deduction > 0} />
              <Row label="Calculated salary" value={rupee(data.calculatedSalary)} />
              {data.isOverridden && <Row label="Adjusted payable" value={rupee(data.payable)} highlight />}
            </View>

            {/* Leave detail */}
            <Text style={styles.sectionLbl}>Leave breakdown</Text>
            <View style={[styles.miniGrid, SHADOW.card]}>
              <Mini label="Absent" value={data.effectiveAbsent ?? data.absent} />
              <Mini label="Very late" value={data.veryLate} />
              <Mini label="Little late" value={data.littleLate} />
              <Mini label="Late→leave" value={data.lateDeductions} />
            </View>

            {/* Actions */}
            <View style={styles.actionsCol}>
              {/* View Salary Sheet — opens the printable/swipeable sheet */}
              <Pressable
                style={[styles.actionBtn, styles.actionBtnSheet]}
                onPress={() => navigation.navigate('AdminSalarySheet', {
                  // If we have the full list, use it so admin can swipe between all employees.
                  // Otherwise fall back to just this one person.
                  employees: allEmployees && allEmployees.length > 0 ? allEmployees : [{ id, name }],
                  initialIndex: employeeIndex ?? 0,
                  year,
                  month,
                })}
              >
                <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                <Text style={[styles.actionTxt, { color: '#7C3AED', fontWeight: '800' }]}>View Salary Sheet</Text>
                <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={openEdit}>
                <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                <Text style={styles.actionTxt}>Edit base salary & allowed leaves</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMute} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={openOverride}>
                <Ionicons name="cash-outline" size={18} color={COLORS.primary} />
                <Text style={styles.actionTxt}>Adjust this month's pay</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMute} />
              </Pressable>
              {data.isOwner && (
                <Pressable style={styles.actionBtn} onPress={openAccess}>
                  <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionTxt}>Manage admin access{data.grantedAdmins?.length ? ` · ${data.grantedAdmins.length}` : ''}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMute} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Edit base salary modal */}
      <FormModal visible={editModal} onClose={() => setEditModal(false)} title={`${name}'s salary`}>
        <Field label="Monthly salary (₹)" value={salaryInput} onChangeText={setSalaryInput} placeholder="15000" keyboardType="number-pad" autoFocus />
        <Field label="Allowed paid leaves / month" value={leavesInput} onChangeText={setLeavesInput} placeholder="Leave blank for company default" keyboardType="number-pad" />
        <Text style={styles.hint}>Leaves beyond this each cost one day's pay. Blank = use the company's monthly leave quota.</Text>
        <ModalButtons onCancel={() => setEditModal(false)} onSave={saveEdit} saving={saving} />
      </FormModal>

      {/* Month override modal */}
      <FormModal visible={overrideModal} onClose={() => setOverrideModal(false)} title={`Adjust ${MONTHS[month]} ${year}`}>
        <Text style={styles.hint}>Two ways to adjust just this month. Use one.</Text>
        <Field label="Pay this exact amount (₹)" value={amountInput} onChangeText={setAmountInput} placeholder="e.g. 15000 for full pay" keyboardType="number-pad" />
        <Text style={styles.orDivider}>— or —</Text>
        <Field label="Excuse this many leaves" value={excuseInput} onChangeText={setExcuseInput} placeholder="e.g. 5" keyboardType="number-pad" />
        <Field label="Note (optional)" value={noteInput} onChangeText={setNoteInput} placeholder="e.g. medical emergency" />
        <View style={styles.overrideBtns}>
          {(data?.isOverridden || data?.excusedLeaves > 0) && (
            <Pressable style={styles.clearBtn} onPress={() => saveOverride(true)} disabled={saving}>
              <Text style={styles.clearTxt}>Clear adjustment</Text>
            </Pressable>
          )}
          <ModalButtons onCancel={() => setOverrideModal(false)} onSave={() => saveOverride(false)} saving={saving} />
        </View>
      </FormModal>

      {/* Access management modal */}
      <Modal visible={accessModal} transparent animationType="slide" onRequestClose={() => setAccessModal(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setAccessModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Admin access to {name}'s salary</Text>
            <Text style={styles.hint}>Granted admins can view and edit this salary.</Text>
            <ScrollView style={{ maxHeight: 320, marginTop: SP.md }}>
              {admins.length === 0 && <Text style={styles.empty}>No other admins.</Text>}
              {admins.map((a) => {
                const granted = (data?.grantedAdmins || []).some((g) => String(g.id) === String(a.id));
                return (
                  <View key={a.id} style={styles.adminRow}>
                    <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{a.name?.[0]?.toUpperCase()}</Text></View>
                    <Text style={styles.adminName}>{a.name}</Text>
                    <Pressable onPress={() => toggleGrant(a.id, granted)} style={[styles.grantBtn, granted && styles.grantedBtn]}>
                      <Text style={[styles.grantTxt, granted && styles.grantedTxt]}>{granted ? 'Granted' : 'Grant'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setAccessModal(false)} style={styles.doneBtn}><Text style={styles.doneTxt}>Done</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Header({ insets, name, navigation, sub }) {
  return (
    <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[hs.header, { paddingTop: insets.top + 6 }]}>
      <View style={hs.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={hs.title}>{name}</Text>
          <Text style={hs.sub}>{sub}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>
    </LinearGradient>
  );
}
const Row = ({ label, value, danger, highlight }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLbl, highlight && { fontWeight: '800', color: COLORS.text }]}>{label}</Text>
    <Text style={[styles.rowVal, danger && { color: COLORS.danger }, highlight && { color: COLORS.primary, fontWeight: '800' }]}>{value}</Text>
  </View>
);
const Divider = () => <View style={styles.rowDivider} />;
const Mini = ({ label, value }) => (
  <View style={styles.mini}><Text style={styles.miniNum}>{value}</Text><Text style={styles.miniLbl}>{label}</Text></View>
);
function FormModal({ visible, onClose, title, children }) {
  const kb = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingBottom: kb }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const Field = ({ label, ...props }) => (
  <View style={{ marginTop: SP.md }}>
    <Text style={styles.fieldLbl}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor={COLORS.textMute} {...props} />
  </View>
);
const ModalButtons = ({ onCancel, onSave, saving }) => (
  <View style={styles.modalBtns}>
    <Pressable style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
    <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={onSave} disabled={saving}>
      {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveTxt}>Save</Text>}
    </Pressable>
  </View>
);

const hs = StyleSheet.create({
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '700' },
});
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  hero: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  heroLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmt: { fontSize: 40, fontWeight: '900', color: COLORS.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  heroSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: SP.sm },
  badgeTxt: { ...TYPE.cap, fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  breakdown: { backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, marginTop: SP.md, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  rowLbl: { ...TYPE.body, color: COLORS.textSoft, fontSize: 14 },
  rowVal: { ...TYPE.label, color: COLORS.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  sectionLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SP.lg, marginBottom: SP.sm },
  miniGrid: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, padding: SP.sm },
  mini: { flex: 1, alignItems: 'center', paddingVertical: SP.sm },
  miniNum: { ...TYPE.h2, color: COLORS.text, fontVariant: ['tabular-nums'] },
  miniLbl: { ...TYPE.cap, fontSize: 10, color: COLORS.textMute, marginTop: 2, textAlign: 'center' },
  actionsCol: { marginTop: SP.lg, gap: SP.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border },
  actionBtnSheet: { backgroundColor: '#F3E8FF', borderColor: '#C4B5FD' },
  actionTxt: { flex: 1, ...TYPE.body, color: COLORS.text, fontWeight: '600' },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.xl, alignItems: 'center', gap: SP.md, borderWidth: 1, borderColor: COLORS.border, marginTop: SP.xl },
  emptyTitle: { ...TYPE.title, color: COLORS.text },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingHorizontal: SP.lg, paddingVertical: SP.md, marginTop: SP.sm },
  primaryBtnTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
  lockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl, gap: SP.md },
  lockedTitle: { ...TYPE.h2, color: COLORS.text },
  lockedMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', lineHeight: 21 },
  empty: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', paddingVertical: SP.lg },
  // modals
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xl + SP.md, maxHeight: '85%' },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.sm },
  fieldLbl: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', marginBottom: 6 },
  input: { ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md },
  hint: { ...TYPE.cap, color: COLORS.textMute, marginTop: 6, fontStyle: 'italic', lineHeight: 16 },
  orDivider: { ...TYPE.cap, color: COLORS.textMute, textAlign: 'center', marginTop: SP.md, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: SP.sm, marginTop: SP.xl },
  overrideBtns: { marginTop: SP.md },
  clearBtn: { alignItems: 'center', paddingVertical: SP.sm, marginBottom: SP.sm },
  clearTxt: { ...TYPE.cap, color: COLORS.danger, fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.sm },
  avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarSmTxt: { ...TYPE.label, color: COLORS.primary, fontWeight: '800' },
  adminName: { flex: 1, ...TYPE.title, color: COLORS.text },
  grantBtn: { backgroundColor: COLORS.primary, borderRadius: R.sm, paddingHorizontal: SP.md, paddingVertical: 8 },
  grantedBtn: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  grantTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  grantedTxt: { color: COLORS.textSoft },
  doneBtn: { backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', marginTop: SP.md },
  doneTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
});
