import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';

// Clipboard is optional — if expo-clipboard isn't installed we fall back to the share
// sheet (which itself offers "Copy"). Dynamic require so a missing dep never crashes.
let Clipboard = null;
try { Clipboard = require('expo-clipboard'); } catch {}

const Tile = ({ icon, label, desc, color, onPress, soon }) => (
  <Pressable onPress={soon ? null : onPress} style={({ pressed }) => [styles.tile, SHADOW.card, pressed && !soon && { opacity: 0.9 }, soon && { opacity: 0.5 }]}>
    <View style={[styles.tileIcon, { backgroundColor: color + '18' }]}><Ionicons name={icon} size={22} color={color} /></View>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={styles.tileDesc}>{soon ? 'Coming next' : desc}</Text>
  </Pressable>
);

export default function AdminHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const today = new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

  const joinCode = user?.company?.joinCode || '';
  const companyName = user?.company?.name || 'our team';
  const shareMessage =
    `Join ${companyName} on Keep Konnected 🔗\n\n` +
    `Team join code: ${joinCode}\n\n` +
    `In the app, tap "Join a team" and enter this code.`;

  const shareCode = async () => {
    if (!joinCode) return;
    try { await Share.share({ message: shareMessage }); } catch {}
  };
  const copyCode = async () => {
    if (!joinCode) return;
    try {
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        // No clipboard module — fall back to the share sheet (offers Copy on most OSes).
        await Share.share({ message: joinCode });
      }
    } catch { Alert.alert('Copy', 'Could not copy. Long-press the code to copy it manually.'); }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + SP.md }]}>
          <Text style={styles.hello}>Admin Panel</Text>
          <Text style={styles.company}>{user?.company?.name}</Text>
          <Text style={styles.date}>{today}</Text>
          <View style={styles.codeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLbl}>Team join code</Text>
              <Text selectable style={styles.codeVal}>{joinCode}</Text>
            </View>
            <View style={styles.codeActions}>
              <Pressable onPress={copyCode} hitSlop={6} style={styles.codeBtn}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={COLORS.white} />
              </Pressable>
              <Pressable onPress={shareCode} hitSlop={6} style={[styles.codeBtn, styles.codeBtnPrimary]}>
                <Ionicons name="share-social" size={18} color={COLORS.white} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.codeHint}>Tap share to send the code any way — WhatsApp, SMS, email — or copy it.</Text>
        </LinearGradient>
        <View style={styles.grid}>
          <Tile icon="people" label="Staff Status" desc="Task progress & attendance" color={COLORS.primary} onPress={() => navigation.navigate('StaffStatus')} />
          <Tile icon="time" label="Old Timelines" desc="Browse any staff history" color="#0E7490" onPress={() => navigation.navigate('StaffTimelines')} />
          <Tile icon="mail" label="New Announcement" desc="Post updates" color="#0E7490" onPress={() => navigation.navigate('NewAnnouncement')} />
          <Tile icon="star" label="Leaderboard" desc="Points & hours" color={COLORS.gold} onPress={() => navigation.navigate('Leaderboard')} />
          <Tile icon="flash" label="Tasks" desc="Add & set time windows" color="#7C3AED" onPress={() => navigation.navigate('TaskSetup')} />
          <Tile icon="share-social" label="Share app" desc="Send the app to your team" color="#059669" onPress={() => navigation.navigate('ShareApp')} />
          <Tile icon="settings" label="Settings" desc="Shift, off-days, office" color={COLORS.textSoft} onPress={() => navigation.navigate('Profile')} />
          <Tile icon="wallet" label="Salaries" desc="View & manage payroll" color="#7C3AED" onPress={() => navigation.navigate('Salaries')} />
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  hello: { ...TYPE.label, color: 'rgba(255,255,255,0.7)' },
  company: { ...TYPE.h1, color: COLORS.white, marginTop: 2 },
  date: { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  codeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.lg, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  codeLbl: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)' },
  codeVal: { fontSize: 20, fontWeight: '900', color: COLORS.white, letterSpacing: 3, marginTop: 2 },
  codeActions: { flexDirection: 'row', gap: SP.sm },
  codeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  codeBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  codeHint: { ...TYPE.cap, color: 'rgba(255,255,255,0.6)', marginTop: SP.sm, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, padding: SP.lg },
  tile: { width: '47%', backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border },
  tileIcon: { width: 44, height: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginBottom: SP.md },
  tileLabel: { ...TYPE.title, fontSize: 16, color: COLORS.text },
  tileDesc: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
});
