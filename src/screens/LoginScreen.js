import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import Field from './_Field';

export default function LoginScreen({ onBack, onForgotPassword }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [identifier, setId] = useState('');
  const [password, setPw]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const valid = identifier.trim().length >= 3 && password.length >= 6;

  const submit = async () => {
    setErr(''); setBusy(true);
    try { await login(identifier.trim(), password); }
    catch (e) { setErr(e?.response?.data?.message || 'Could not sign in. Check your connection.'); }
    finally { setBusy(false); }
  };

  return (
    <LinearGradient colors={['#0B1F3A', '#0F2D56', '#1D4ED8']} locations={[0, 0.55, 1]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.inner, { paddingTop: insets.top + 16, paddingBottom: 40 }]}>

          {/* Back */}
          <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            <Text style={styles.backTxt}>Back</Text>
          </Pressable>

          {/* Header */}
          <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="log-in-outline" size={26} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to your account</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={[styles.card, SHADOW.card]}>
            {!!err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errTxt}>{err}</Text>
              </View>
            )}

            <Field icon="person-outline"    placeholder="Mobile number or email" autoCapitalize="none" value={identifier} onChangeText={setId} />
            <Field icon="lock-closed-outline" placeholder="Password"              secure value={password} onChangeText={setPw} />

            <Pressable onPress={submit} disabled={!valid || busy}
              style={[styles.btn, { backgroundColor: valid && !busy ? COLORS.primary : '#CBD5E1' }]}>
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={[styles.btnTxt, { color: valid ? COLORS.white : '#94A3B8' }]}>Sign in</Text>}
            </Pressable>

            <Pressable onPress={onForgotPassword} hitSlop={10} style={styles.forgotRow}>
              <Text style={styles.forgotTxt}>Forgot password?</Text>
            </Pressable>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  inner:     { flexGrow: 1, paddingHorizontal: SP.xl },
  backRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: SP.xl },
  backTxt:   { ...TYPE.label, color: COLORS.white },
  header:    { alignItems: 'center', marginBottom: SP.xl },
  iconCircle:{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: SP.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  title:     { fontSize: 26, fontWeight: '900', color: COLORS.white, letterSpacing: -0.3 },
  sub:       { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  card:      { backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  errBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt:    { flex: 1, ...TYPE.cap, color: COLORS.danger, lineHeight: 17 },
  btn:       { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.sm },
  btnTxt:    { fontSize: 16, fontWeight: '800' },
  forgotRow: { alignItems: 'center', marginTop: SP.lg, padding: 4 },
  forgotTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '700' },
});
