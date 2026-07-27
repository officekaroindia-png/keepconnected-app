import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { staffStatus, setStaffRole } from '../../api/admin';

export default function ManageAdminsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { const d = await staffStatus(); setStaff(d.staff || []); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const admins = staff.filter((s) => s.role === 'admin');
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
        <View style={[styles.avatar, isAdmin && { backgroundColor: COLORS.successTint }]}>
          <Text style={[styles.avatarTxt, isAdmin && { color: COLORS.success }]}>{p.name[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{p.name}</Text>
            {self && <View style={styles.youChip}><Text style={styles.youTxt}>You</Text></View>}
          </View>
          <Text style={styles.sub}>{isAdmin ? 'Admin · full access' : p.designation || 'Team member'}</Text>
        </View>

        {self ? (
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMute} />
        ) : busyId === p.id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Pressable onPress={() => change(p, isAdmin ? 'employee' : 'admin')}
            style={[styles.action, isAdmin ? styles.actionRemove : styles.actionMake]}>
            <Ionicons name={isAdmin ? 'remove-circle-outline' : 'shield-checkmark-outline'} size={15}
              color={isAdmin ? COLORS.danger : COLORS.primary} />
            <Text style={[styles.actionTxt, { color: isAdmin ? COLORS.danger : COLORS.primary }]}>
              {isAdmin ? 'Remove' : 'Make admin'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.textSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...TYPE.title, color: COLORS.text },
  youChip: { backgroundColor: COLORS.primaryTint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill },
  youTxt: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  sub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.sm, borderWidth: 1 },
  actionMake: { backgroundColor: COLORS.primaryTint, borderColor: 'rgba(37,99,235,0.25)' },
  actionRemove: { backgroundColor: COLORS.dangerTint, borderColor: 'rgba(239,68,68,0.25)' },
  actionTxt: { ...TYPE.cap, fontWeight: '800' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30, lineHeight: 20 },
});
