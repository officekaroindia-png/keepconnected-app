import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useKeyboardHeight } from '../hooks/useKeyboard';
import Field from './_Field';

// 'join' or 'company'
export default function RegisterScreen({ onBack, initialMode = 'company', onGoLogin }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { registerCompany, registerJoin } = useAuth();
  const [mode, setMode]   = useState(initialMode);
  const [f, setF]         = useState({ companyName: '', joinCode: '', name: '', email: '', mobile: '', password: '' });
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [errKind, setErrKind] = useState(''); // 'mobile_exists' | ''
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const valid =
    f.name.trim().length >= 2 &&
    f.mobile.trim().replace(/\D/g, '').length >= 7 &&
    f.password.length >= 6 &&
    (mode === 'company'
      ? f.companyName.trim().length >= 2 && f.email.includes('@')
      : f.joinCode.trim().length >= 4);

  const submit = async () => {
    setErr(''); setErrKind(''); setBusy(true);
    try {
      if (mode === 'company') {
        await registerCompany({
          companyName: f.companyName.trim(),
          name: f.name.trim(),
          email: f.email.trim(),
          mobile: f.mobile.trim(),
          password: f.password,
        });
      } else {
        await registerJoin({
          joinCode:  f.joinCode.trim().toUpperCase(),
          name:      f.name.trim(),
          email:     f.email.trim() || undefined,
          mobile:    f.mobile.trim(),
          password:  f.password,
        });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not register. Please try again.';
      // Detect "mobile already exists" — guide the user to login instead
      if (msg.toLowerCase().includes('mobile') && msg.toLowerCase().includes('exists')) {
        setErrKind('mobile_exists');
        setErr(msg);
      } else if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('exists')) {
        setErrKind('email_exists');
        setErr(msg);
      } else {
        setErr(msg);
      }
    } finally { setBusy(false); }
  };

  const switchMode = (m) => { setMode(m); setErr(''); setErrKind(''); };

  return (
    <LinearGradient colors={['#0B1F3A', '#0F2D56', '#1D4ED8']} locations={[0, 0.55, 1]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.inner, { paddingTop: insets.top + 16, paddingBottom: 40 + (Platform.OS === 'android' ? kb : 0) }]}>

          {/* Back */}
          <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            <Text style={styles.backTxt}>Back</Text>
          </Pressable>

          {/* Header */}
          <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
            <Text style={styles.title}>Get started</Text>
            <Text style={styles.sub}>
              {mode === 'company' ? 'Create your company account' : 'Join your team with a code'}
            </Text>
          </Animated.View>

          {/* Mode toggle */}
          <Animated.View entering={FadeInDown.delay(80).duration(450)} style={styles.seg}>
            {[['company', 'business-outline', 'New company'], ['join', 'people-outline', 'Join a team']].map(([m, icon, label]) => (
              <Pressable key={m} onPress={() => switchMode(m)} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
                <Ionicons name={icon} size={15} color={mode === m ? COLORS.ink : 'rgba(255,255,255,0.75)'} />
                <Text style={[styles.segTxt, mode === m && styles.segTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Form card */}
          <Animated.View entering={FadeInDown.delay(160).duration(450)} style={[styles.card, SHADOW.card]}>

            {/* Error banner */}
            {!!err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errTxt}>{err}</Text>
                  {/* Smart helper for duplicate mobile */}
                  {errKind === 'mobile_exists' && (
                    <Pressable onPress={onGoLogin} style={styles.errAction}>
                      <Text style={styles.errActionTxt}>
                        This number is already registered. <Text style={{ fontWeight: '900', textDecorationLine: 'underline' }}>Sign in instead →</Text>
                      </Text>
                    </Pressable>
                  )}
                  {errKind === 'email_exists' && (
                    <Pressable onPress={onGoLogin} style={styles.errAction}>
                      <Text style={styles.errActionTxt}>
                        This email is already registered. <Text style={{ fontWeight: '900', textDecorationLine: 'underline' }}>Sign in instead →</Text>
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Mode-specific top field */}
            {mode === 'company'
              ? <Field icon="business-outline"  placeholder="Company name"             value={f.companyName} onChangeText={set('companyName')} />
              : <Field icon="key-outline"        placeholder="6-character join code"   autoCapitalize="characters" value={f.joinCode} onChangeText={set('joinCode')} />}

            <Field icon="person-outline"    placeholder="Your full name"          value={f.name}     onChangeText={set('name')} />
            <Field icon="call-outline"      placeholder="Mobile number"           keyboardType="phone-pad" value={f.mobile} onChangeText={set('mobile')} />
            <Field icon="mail-outline"      placeholder={mode === 'company' ? 'Email address' : 'Email (optional)'} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
            <Field icon="lock-closed-outline" placeholder="Password (min 6 characters)" secure value={f.password} onChangeText={set('password')} />

            <Pressable onPress={submit} disabled={!valid || busy}
              style={[styles.btn, { backgroundColor: valid && !busy ? COLORS.primary : '#CBD5E1' }]}>
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={[styles.btnTxt, { color: valid ? COLORS.white : '#94A3B8' }]}>
                    {mode === 'company' ? 'Create company' : 'Join team'}
                  </Text>}
            </Pressable>
          </Animated.View>

          {/* Hint */}
          <Animated.Text entering={FadeInDown.delay(280).duration(450)} style={styles.hint}>
            {mode === 'company'
              ? "You'll become the admin and get a join code to share with your team."
              : 'Ask your admin for the 6-character join code.'}
          </Animated.Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  inner:      { flexGrow: 1, paddingHorizontal: SP.xl },
  backRow:    { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: SP.lg },
  backTxt:    { ...TYPE.label, color: COLORS.white },
  header:     { marginBottom: SP.lg },
  title:      { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  sub:        { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 5 },

  // Mode segment
  seg:        { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.md, padding: 4, marginBottom: SP.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  segBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: R.sm - 2 },
  segBtnOn:   { backgroundColor: COLORS.white },
  segTxt:     { ...TYPE.label, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  segTxtOn:   { color: COLORS.ink },

  // Card
  card:       { backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  errBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.md, marginBottom: SP.md },
  errTxt:     { ...TYPE.cap, color: COLORS.danger, lineHeight: 17, marginBottom: 4 },
  errAction:  { marginTop: 4 },
  errActionTxt:{ ...TYPE.cap, color: COLORS.danger, lineHeight: 17 },

  btn:        { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.sm },
  btnTxt:     { fontSize: 16, fontWeight: '800' },
  hint:       { textAlign: 'center', ...TYPE.cap, color: 'rgba(255,255,255,0.5)', marginTop: SP.lg, lineHeight: 18, paddingHorizontal: SP.sm },
});
