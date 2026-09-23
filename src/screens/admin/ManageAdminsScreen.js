import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { staffStatus, setStaffRole, resetStaffPassword, setStaffMobile } from '../../api/admin';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

function ResetPasswordModal({ person, onClose, onDone }) {
  const kb = useKeyboardHeight();
  const [pw, setPw]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  const submit = async () => {
    setErr('');
    if (pw.length < 6)    { setErr('Password must be at least 6 characters'); return; }
    if (pw !== confirm)   { setErr('Passwords do not match'); return; }
    setBusy(true);
    try {
      await resetStaffPassword(person.id, pw);
      Alert.alert('Done', `Password reset for ${person.name}. All their active sessions have been logged out.`);
      onDone();
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to reset password'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, { paddingBottom: kb }]} onPress={onClose}>
        <Pressable style={[styles.modalCard, SHADOW.lift]} onPress={() => {}}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <Ionicons name="key-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSub}>{person?.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMute} />
            </Pressable>
          </View>

          <View style={styles.modalDivider} />

          {!!err && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
              <Text style={styles.errTxt}>{err}</Text>
            </View>
          )}

          {/* New password field */}
          <Text style={styles.fieldLabel}>New Password</Text>
          <View style={styles.fieldWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMute} style={{ marginLeft: SP.md }} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Min 6 characters"
              placeholderTextColor={COLORS.textMute}
              secureTextEntry={!show}
              value={pw}
              onChangeText={setPw}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShow(v => !v)} hitSlop={8} style={{ marginRight: SP.md }}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMute} />
            </Pressable>
          </View>

          {/* Confirm password field */}
          <Text style={[styles.fieldLabel, { marginTop: SP.md }]}>Confirm Password</Text>
          <View style={styles.fieldWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMute} style={{ marginLeft: SP.md }} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Repeat password"
              placeholderTextColor={COLORS.textMute}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={8} style={{ marginRight: SP.md }}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMute} />
            </Pressable>
          </View>

          <Text style={styles.warningTxt}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.textMute} />
            {' '}This will log the user out of all their devices.
          </Text>

          {/* Buttons */}
          <View style={styles.modalBtns}>
            <Pressable onPress={onClose} style={[styles.modalBtn, styles.modalBtnCancel]}>
              <Text style={styles.modalBtnCancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={pw.length < 6 || !confirm || busy}
              style={[styles.modalBtn, styles.modalBtnConfirm, (pw.length < 6 || !confirm) && { backgroundColor: COLORS.border }]}
            >
              {busy
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={[styles.modalBtnConfirmTxt, (pw.length < 6 || !confirm) && { color: COLORS.textMute }]}>Reset Password</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MobileEditModal({ person, onClose, onDone }) {
  const kb = useKeyboardHeight();
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (person) { setMobile(person.mobile || ''); setErr(''); } }, [person]);

  const submit = async () => {
    setErr('');
    const digits = String(mobile).replace(/\D/g, '');
    if (digits.length < 7) { setErr('Enter a valid mobile number'); return; }
    setBusy(true);
    try {
      await setStaffMobile(person.id, mobile);
      Alert.alert('Done', `Mobile number updated for ${person.name}.`);
      onDone();
    } catch (e) { setErr(e?.response?.data?.message || 'Could not update'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, { paddingBottom: kb }]} onPress={onClose}>
        <Pressable style={[styles.modalCard, SHADOW.lift]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}><Ionicons name="call-outline" size={22} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Change mobile</Text>
              <Text style={styles.modalSub}>{person?.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close-circle" size={24} color={COLORS.textMute} /></Pressable>
          </View>
          <View style={styles.modalDivider} />
          {!!err && <View style={styles.errBox}><Ionicons name="alert-circle" size={15} color={COLORS.danger} /><Text style={styles.errTxt}>{err}</Text></View>}
          <Text style={styles.fieldLabel}>Mobile number (also their login)</Text>
          <View style={styles.fieldWrap}>
            <Ionicons name="call-outline" size={18} color={COLORS.textMute} style={{ marginLeft: SP.md }} />
            <TextInput style={styles.fieldInput} placeholder="Mobile number" placeholderTextColor={COLORS.textMute}
              keyboardType="phone-pad" value={mobile} onChangeText={setMobile} autoFocus />
          </View>
          <Text style={styles.warningTxt}><Ionicons name="information-circle-outline" size={13} color={COLORS.textMute} /> Spaces and dashes are removed automatically.</Text>
          <View style={styles.modalBtns}>
            <Pressable onPress={onClose} style={[styles.modalBtn, styles.modalBtnCancel]}><Text style={styles.modalBtnCancelTxt}>Cancel</Text></Pressable>
            <Pressable onPress={submit} disabled={busy} style={[styles.modalBtn, styles.modalBtnConfirm]}>
              {busy ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.modalBtnConfirmTxt}>Save</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ManageAdminsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [mobileTarget, setMobileTarget] = useState(null);

  const load = useCallback(async () => {
    try { const d = await staffStatus(); setStaff(d.staff || []); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const admins  = staff.filter((s) => s.role === 'admin');
  const members = staff.filter((s) => s.role !== 'admin');

  const change = (person, next) => {
    const verb = next === 'admin' ? 'Make admin' : 'Remove admin';
    Alert.alert(verb, next === 'admin'
      ? `${person.name} will get the Admin tab — staff, tasks, approvals and settings.`
      : `${person.name} will lose admin access and go back to being a team member.`,
      [{ text: 'Cancel', style: 'cancel' },
       { text: verb, style: next === 'admin' ? 'default' : 'destructive', onPress: async () => {
          setBusyId(person.id);
          try { await setStaffRole(person.id, next); await load(); }
          catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Could not change role'); }
          finally { setBusyId(null); }
       } }]);
  };

  const Person = ({ p, i, isAdmin }) => {
    const self = String(p.id) === String(me?.id);
    return (
      <Animated.View entering={FadeInDown.delay(30 * i)} style={[styles.card, SHADOW.card]}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, isAdmin && { backgroundColor: COLORS.successTint }]}>
            <Text style={[styles.avatarTxt, isAdmin && { color: COLORS.success }]}>{p.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              {self && <View style={styles.youChip}><Text style={styles.youTxt}>You</Text></View>}
            </View>
            <Text style={styles.sub} numberOfLines={1}>{isAdmin ? 'Admin · full access' : p.designation || 'Team member'}</Text>
          </View>
          {self && <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMute} />}
          {!self && busyId === p.id && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {!self && busyId !== p.id && (
          <View style={styles.actionsRow}>
            <Pressable onPress={() => setMobileTarget(p)} style={[styles.action, styles.actionMobile]}>
              <Ionicons name="call-outline" size={15} color={COLORS.primary} />
              <Text style={[styles.actionTxt, { color: COLORS.primary }]}>Mobile</Text>
            </Pressable>
            <Pressable onPress={() => setResetTarget(p)} style={[styles.action, styles.actionReset]}>
              <Ionicons name="key-outline" size={15} color={COLORS.warn} />
              <Text style={[styles.actionTxt, { color: COLORS.warn }]}>Password</Text>
            </Pressable>
            <Pressable onPress={() => change(p, isAdmin ? 'employee' : 'admin')}
              style={[styles.action, isAdmin ? styles.actionRemove : styles.actionMake]}>
              <Ionicons name={isAdmin ? 'remove-circle-outline' : 'shield-checkmark-outline'} size={15}
                color={isAdmin ? COLORS.danger : COLORS.primary} />
              <Text style={[styles.actionTxt, { color: isAdmin ? COLORS.danger : COLORS.primary }]}>
                {isAdmin ? 'Remove' : 'Make admin'}
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <ResetPasswordModal
        person={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={() => { setResetTarget(null); load(); }}
      />
      <MobileEditModal
        person={mobileTarget}
        onClose={() => setMobileTarget(null)}
        onDone={() => { setMobileTarget(null); load(); }}
      />

      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Admins</Text><View style={{ width: 24 }} />
        </View>
        <Text style={styles.sub2}>Admins can manage staff, tasks, approvals and settings.</Text>
        <View style={styles.countRow}>
          <View style={styles.countPill}><Ionicons name="shield-checkmark" size={13} color={COLORS.ink} /><Text style={styles.countTxt}>{admins.length} admin{admins.length !== 1 ? 's' : ''}</Text></View>
          <View style={styles.countPill}><Ionicons name="people" size={13} color={COLORS.ink} /><Text style={styles.countTxt}>{members.length} member{members.length !== 1 ? 's' : ''}</Text></View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && admins.length > 0 && <>
          <Text style={styles.section}>ADMINS</Text>
          {admins.map((p, i) => <Person key={p.id} p={p} i={i} isAdmin />)}
        </>}

        {!loading && members.length > 0 && <>
          <Text style={styles.section}>TEAM MEMBERS</Text>
          {members.map((p, i) => <Person key={p.id} p={p} i={i} isAdmin={false} />)}
        </>}

        {!loading && staff.length <= 1 && <Text style={styles.dim}>No one else has joined yet. Share your join code to add your team.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub2: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: SP.sm, lineHeight: 17 },
  countRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, paddingHorizontal: 11, paddingVertical: 6, borderRadius: R.pill },
  countTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '800' },
  section: { ...TYPE.cap, color: COLORS.textMute, letterSpacing: 1, marginTop: SP.md, marginBottom: SP.sm, marginLeft: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.textSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...TYPE.title, color: COLORS.text, flexShrink: 1 },
  youChip: { backgroundColor: COLORS.primaryTint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill },
  youTxt: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  sub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: SP.sm, alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.sm, borderWidth: 1 },
  actionReset: { backgroundColor: COLORS.goldTint || '#FEF3C7', borderColor: 'rgba(217,119,6,0.25)', paddingHorizontal: 9 },
  actionMobile: { backgroundColor: COLORS.primaryTint, borderColor: 'rgba(37,99,235,0.25)', paddingHorizontal: 9 },
  actionMake: { backgroundColor: COLORS.primaryTint, borderColor: 'rgba(37,99,235,0.25)' },
  actionRemove: { backgroundColor: COLORS.dangerTint, borderColor: 'rgba(239,68,68,0.25)' },
  actionTxt: { ...TYPE.cap, fontWeight: '800' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30, lineHeight: 20 },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: SP.xl, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md },
  modalIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { ...TYPE.title, color: COLORS.text, fontWeight: '800' },
  modalSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2 },
  modalDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: SP.lg },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger },
  fieldLabel: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', marginBottom: 6 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, backgroundColor: COLORS.surfaceAlt, height: 50 },
  fieldInput: { flex: 1, paddingHorizontal: SP.md, ...TYPE.body, color: COLORS.text, fontSize: 15 },
  warningTxt: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.md, lineHeight: 18 },
  modalBtns: { flexDirection: 'row', gap: SP.md, marginTop: SP.lg },
  modalBtn: { flex: 1, height: 50, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  modalBtnCancelTxt: { ...TYPE.title, color: COLORS.textSoft },
  modalBtnConfirm: { backgroundColor: COLORS.primary },
  modalBtnConfirmTxt: { ...TYPE.title, color: COLORS.white },
});
