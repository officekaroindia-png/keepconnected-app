import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Share, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getAppInfo } from '../../api/extra';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const cleanNum = (m) => String(m || '').replace(/[^\d]/g, '');
// India default: prepend 91 to a bare 10-digit number so WhatsApp can find it.
const intl = (m) => { const n = cleanNum(m); return n.length === 10 ? `91${n}` : n; };

export default function ShareAppScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => { try { setInfo(await getAppInfo()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const ready = info?.configured;
  const msg = info?.message || '';
  const url = info?.url || '';

  const needsSetup = () => Alert.alert('Not set up yet', 'The download link has not been configured. Ask your developer to set the APK link on the server.');

  const shareSheet = async () => {
    if (!ready) return needsSetup();
    try {
      // On Android the url param is ignored; the link must be in the message body (it is).
      // On iOS we pass url separately so the system can offer to open/preview it.
      await Share.share(Platform.OS === 'ios' ? { message: msg, url } : { message: msg });
    } catch {}
  };
  const whatsapp = () => {
    if (!ready) return needsSetup();
    const n = intl(phone);
    const base = n ? `https://wa.me/${n}?text=` : `https://wa.me/?text=`;
    Linking.openURL(base + encodeURIComponent(msg)).catch(() =>
      Alert.alert('WhatsApp', 'Could not open WhatsApp. Is it installed?'));
  };
  const sms = () => {
    if (!ready) return needsSetup();
    const n = cleanNum(phone);
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${n}${sep}body=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('SMS', 'Could not open Messages.'));
  };
  const email = () => {
    if (!ready) return needsSetup();
    Linking.openURL(`mailto:?subject=${encodeURIComponent('Install Keep Konnected')}&body=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('Email', 'Could not open your email app.'));
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Share the app</Text><View style={{ width: 24 }} />
        </View>
        <Text style={styles.sub}>Send Keep Konnected to a new team member. They install it, then join with your code.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 + kb }} keyboardShouldPersistTaps="handled">
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && (
          <>
            <View style={[styles.linkCard, SHADOW.card]}>
              <View style={styles.appRow}>
                <View style={styles.appBadge}><Ionicons name="download" size={22} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>Keep Konnected{info?.version ? `  ·  v${info.version}` : ''}</Text>
                  <Text style={styles.appDesc}>{ready ? 'Ready to share' : 'Download link not set up yet'}</Text>
                </View>
              </View>
              {ready && (
                <View style={styles.linkBox}>
                  <Text selectable style={styles.linkTxt} numberOfLines={2}>{url}</Text>
                  <Text style={styles.linkHint}>Long-press the link to copy</Text>
                </View>
              )}
            </View>

            <Text style={styles.section}>SEND TO A NUMBER</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}><Text style={styles.ccTxt}>+91</Text></View>
              <TextInput style={styles.phoneInput} value={phone} onChangeText={setPhone}
                placeholder="Enter mobile number" placeholderTextColor={COLORS.textMute} keyboardType="phone-pad" maxLength={13} />
            </View>
            <View style={styles.dualRow}>
              <Pressable onPress={whatsapp} style={[styles.chanBtn, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={20} color={COLORS.white} /><Text style={styles.chanTxt}>WhatsApp</Text>
              </Pressable>
              <Pressable onPress={sms} style={[styles.chanBtn, { backgroundColor: COLORS.primary }]}>
                <Ionicons name="chatbubble-ellipses" size={19} color={COLORS.white} /><Text style={styles.chanTxt}>SMS</Text>
              </Pressable>
            </View>

            <Text style={styles.section}>OR SHARE ANY WAY</Text>
            <Pressable onPress={shareSheet} style={[styles.bigShare, SHADOW.lift]}>
              <Ionicons name="share-social" size={20} color={COLORS.white} />
              <Text style={styles.bigShareTxt}>Share via any app</Text>
            </Pressable>
            <Text style={styles.helper}>Opens your phone's share menu — pick WhatsApp, Telegram, Gmail, copy to clipboard, or any other app installed on this phone.</Text>

            <Pressable onPress={email} style={styles.emailBtn}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSoft} /><Text style={styles.emailTxt}>Share by email</Text>
            </Pressable>

            {!ready && (
              <Text style={styles.setupNote}>Developer note: set APK_URL (and optionally APK_VERSION) in the backend environment to enable sharing.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  sub: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', marginTop: SP.sm, lineHeight: 18 },
  linkCard: { backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  appBadge: { width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  appName: { ...TYPE.title, color: COLORS.text },
  appDesc: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  linkBox: { marginTop: SP.md, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border },
  linkTxt: { ...TYPE.cap, color: COLORS.primary, fontWeight: '700' },
  linkHint: { ...TYPE.cap, color: COLORS.textMute, marginTop: 4, fontSize: 11 },
  section: { ...TYPE.cap, color: COLORS.textMute, letterSpacing: 1, marginTop: SP.xl, marginBottom: SP.sm, marginLeft: 4 },
  phoneRow: { flexDirection: 'row', gap: SP.sm },
  cc: { justifyContent: 'center', paddingHorizontal: 14, backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1.5, borderColor: COLORS.border },
  ccTxt: { ...TYPE.title, color: COLORS.text },
  phoneInput: { flex: 1, height: 52, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface },
  dualRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.sm },
  chanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: R.md },
  chanTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white },
  bigShare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: R.md, backgroundColor: COLORS.ink },
  bigShareTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  helper: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm, lineHeight: 17, paddingHorizontal: 4 },
  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginTop: SP.md },
  emailTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft },
  setupNote: { ...TYPE.cap, color: COLORS.warn, marginTop: SP.lg, textAlign: 'center', lineHeight: 17 },
});
