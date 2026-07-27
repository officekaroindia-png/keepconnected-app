import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import Field from './_Field';
import { useKeyboardHeight } from '../hooks/useKeyboard';

export default function RegisterScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { registerCompany, registerJoin } = useAuth();
  const [mode, setMode] = useState('company');
  const [f, setF] = useState({ companyName: '', joinCode: '', name: '', email: '', mobile: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const valid = f.name.length >= 2 && f.mobile.trim().length >= 7 && f.password.length >= 6 &&
    (mode === 'company' ? (f.companyName.length >= 2 && f.email.includes('@')) : f.joinCode.length >= 4);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      if (mode === 'company') await registerCompany({ companyName: f.companyName, name: f.name, email: f.email.trim(), mobile: f.mobile.trim(), password: f.password });
      else await registerJoin({ joinCode: f.joinCode.trim().toUpperCase(), name: f.name, email: f.email.trim() || undefined, mobile: f.mobile.trim(), password: f.password });
    } catch (e) { setErr(e?.response?.data?.message || 'Could not register.'); }
    finally { setBusy(false); }
  };

  return (
    <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingBottom: kb }}>
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + SP.lg, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={onBack} hitSlop={10} style={styles.back}><Ionicons name="chevron-back" size={22} color={COLORS.white} /><Text style={styles.backTxt}>Back</Text></Pressable>
          <Text style={styles.title}>Get started</Text>
          <View style={styles.seg}>
            {[['company', 'New company'], ['join', 'Join a team']].map(([m, label]) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
                <Text style={[styles.segTxt, mode === m && styles.segTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.card, SHADOW.card]}>
            {!!err && <View style={styles.errBox}><Ionicons name="alert-circle" size={16} color={COLORS.danger} /><Text style={styles.errTxt}>{err}</Text></View>}
            {mode === 'company'
              ? <Field icon="business-outline" placeholder="Company name" value={f.companyName} onChangeText={set('companyName')} />
              : <Field icon="key-outline" placeholder="Join code" autoCapitalize="characters" value={f.joinCode} onChangeText={set('joinCode')} />}
            <Field icon="person-outline" placeholder="Your name" value={f.name} onChangeText={set('name')} />
            <Field icon="call-outline" placeholder="Mobile number" keyboardType="phone-pad" value={f.mobile} onChangeText={set('mobile')} />
            <Field icon="mail-outline" placeholder={mode === 'company' ? 'Email' : 'Email (optional)'} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
            <Field icon="lock-closed-outline" placeholder="Password (min 6)" secure value={f.password} onChangeText={set('password')} />
            <Pressable onPress={submit} disabled={!valid || busy} style={[styles.btn, { backgroundColor: valid && !busy ? COLORS.primary : COLORS.border }, valid && !busy && SHADOW.lift]}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={[styles.btnTxt, { color: valid ? COLORS.white : COLORS.textMute }]}>{mode === 'company' ? 'Create company' : 'Join team'}</Text>}
            </Pressable>
          </View>
          <Text style={styles.hint}>{mode === 'company' ? 'You’ll be the admin and get a join code for your team.' : 'Ask your admin for the 6-character join code.'}</Text>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  inner: { paddingHorizontal: SP.xl, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: SP.lg },
  backTxt: { ...TYPE.label, color: COLORS.white },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5, marginBottom: SP.lg },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.md, padding: 4, marginBottom: SP.lg },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: 'center' },
  segBtnOn: { backgroundColor: COLORS.white },
  segTxt: { ...TYPE.label, color: 'rgba(255,255,255,0.8)' },
  segTxtOn: { color: COLORS.ink },
  card: { backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger },
  btn: { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.sm },
  btnTxt: { ...TYPE.title, fontSize: 16 },
  hint: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: SP.lg, ...TYPE.cap, lineHeight: 18 },
});
