import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import Field from './_Field';
import { useKeyboardHeight } from '../hooks/useKeyboard';

export default function LoginScreen({ onGoRegister }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { login } = useAuth();
  const [identifier, setId] = useState('');
  const [password, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const valid = identifier.trim().length >= 3 && password.length >= 6;

  const submit = async () => {
    setErr(''); setBusy(true);
    try { await login(identifier.trim(), password); }
    catch (e) { setErr(e?.response?.data?.message || 'Could not sign in. Check your connection.'); }
    finally { setBusy(false); }
  };

  return (
    <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingBottom: kb }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 56, paddingBottom: 40 }]}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.brand}>
            <View style={styles.logoMark}>
              <View style={[styles.link, { borderColor: COLORS.white, transform: [{ rotate: '-12deg' }], marginRight: -8 }]} />
              <View style={[styles.link, { borderColor: COLORS.gold, transform: [{ rotate: '12deg' }], marginLeft: -8 }]} />
            </View>
            <Text style={styles.brandName}>Keep Konnected</Text>
            <Text style={styles.brandSub}>Your team, in sync</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.card, SHADOW.card]}>
            <Text style={styles.cardTitle}>Sign in</Text>
            {!!err && <View style={styles.errBox}><Ionicons name="alert-circle" size={16} color={COLORS.danger} /><Text style={styles.errTxt}>{err}</Text></View>}
            <Field icon="person-outline" placeholder="Email or mobile" autoCapitalize="none" value={identifier} onChangeText={setId} />
            <Field icon="lock-closed-outline" placeholder="Password" secure value={password} onChangeText={setPw} />
            <Pressable onPress={submit} disabled={!valid || busy} style={[styles.btn, { backgroundColor: valid && !busy ? COLORS.primary : COLORS.border }, valid && !busy && SHADOW.lift]}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={[styles.btnTxt, { color: valid ? COLORS.white : COLORS.textMute }]}>Sign in</Text>}
            </Pressable>
          </Animated.View>
          <Pressable onPress={onGoRegister} hitSlop={10}>
            <Text style={styles.footer}>New here?  <Text style={styles.footerLink}>Create or join a company</Text></Text>
          </Pressable>
      </ScrollView>
      </View>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  inner: { flexGrow: 1, paddingHorizontal: SP.xl },
  brand: { alignItems: 'center', marginBottom: 36 },
  logoMark: { flexDirection: 'row', alignItems: 'center', marginBottom: SP.lg },
  link: { width: 30, height: 46, borderWidth: 5, borderRadius: 16 },
  brandName: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  brandSub: { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  cardTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.lg },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger },
  btn: { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.sm },
  btnTxt: { ...TYPE.title, fontSize: 16 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: SP.xl, ...TYPE.label },
  footerLink: { color: COLORS.gold, fontWeight: '800' },
});
