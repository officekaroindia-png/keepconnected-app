import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

// Shown when the user IS logged in (a session token exists) but we can't reach the
// server — usually no network. This replaces the old behaviour of dumping the user on
// the login screen (where they'd fail to sign in and think the app was broken). We keep
// them signed in, auto-retry in the background, and offer a manual retry.
export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const { refreshMe, reconnect, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);

  // Auto-retry every 6s. refreshMe() silently fetches the profile; on success the
  // provider sets `user`, which flips the Gate over to the app automatically.
  useEffect(() => {
    const id = setInterval(() => { refreshMe?.(); }, 6000);
    return () => clearInterval(id);
  }, [refreshMe]);

  const retryNow = async () => {
    setRetrying(true);
    try { await reconnect?.(); } finally { setRetrying(false); }
  };

  return (
    <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={styles.iconWrap}><Ionicons name="cloud-offline-outline" size={44} color={COLORS.white} /></View>
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.msg}>
          You're still signed in — we just can't reach the server right now. This usually
          means no internet. We'll reconnect automatically the moment you're back online.
        </Text>

        <Pressable onPress={retryNow} disabled={retrying} style={styles.retryBtn}>
          {retrying
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <><Ionicons name="refresh" size={18} color={COLORS.white} /><Text style={styles.retryTxt}>Try again</Text></>}
        </Pressable>
      </View>

      <Pressable onPress={logout} hitSlop={10} style={[styles.logout, { marginBottom: insets.bottom + SP.lg }]}>
        <Text style={styles.logoutTxt}>Sign out</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SP.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: SP.lg },
  title: { ...TYPE.h1, color: COLORS.white, textAlign: 'center' },
  msg: { ...TYPE.body, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: SP.md, lineHeight: 22, paddingHorizontal: SP.sm },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: R.md, paddingHorizontal: 26, paddingVertical: 14, marginTop: SP.xl, minWidth: 150, justifyContent: 'center' },
  retryTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  logout: { alignSelf: 'center', padding: SP.sm },
  logoutTxt: { ...TYPE.title, fontSize: 15, color: 'rgba(255,255,255,0.6)' },
});
