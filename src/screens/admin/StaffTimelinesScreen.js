import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffStatus } from '../../api/admin';

// IST today
const todayIST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const ROLE_COLOR = {
  admin: { bg: '#EFF4FF', text: COLORS.primary, icon: 'shield-checkmark' },
  staff: { bg: COLORS.surfaceAlt, text: COLORS.textSoft, icon: 'person' },
};

// Avatar initials — up to 2 chars
const initials = (name = '') => {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

// Soft palette cycling for avatar backgrounds
const AVATAR_PALETTES = [
  { bg: '#EFF4FF', text: '#2563EB' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#FFF7ED', text: '#D97706' },
  { bg: '#FDF2F8', text: '#9333EA' },
  { bg: '#F0F9FF', text: '#0284C7' },
  { bg: '#FEF2F2', text: '#EF4444' },
  { bg: '#F0FDFA', text: '#0D9488' },
];
const palette = (name = '') => AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];

function StaffRow({ item, index, onPress }) {
  const pal = palette(item.name);
  const role = ROLE_COLOR[item.role] || ROLE_COLOR.staff;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, SHADOW.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
    >
      {/* Index number */}
      <Text style={styles.indexNum}>{String(index + 1).padStart(2, '0')}</Text>

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: pal.bg }]}>
        <Text style={[styles.avatarTxt, { color: pal.text }]}>{initials(item.name)}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.role === 'admin' && (
            <View style={[styles.roleBadge, { backgroundColor: role.bg }]}>
              <Ionicons name={role.icon} size={10} color={role.text} />
              <Text style={[styles.roleTxt, { color: role.text }]}>Admin</Text>
            </View>
          )}
          {item.offsiteAuthToday && (
            <View style={styles.offsiteBadge}>
              <Ionicons name="map" size={9} color="#0891B2" />
              <Text style={styles.offsiteBadgeTxt}>Offsite</Text>
            </View>
          )}
        </View>
        {item.designation ? (
          <Text style={styles.desig} numberOfLines={1}>{item.designation}</Text>
        ) : null}
      </View>

      {/* Arrow */}
      <View style={styles.arrowWrap}>
        <Ionicons name="time-outline" size={14} color={COLORS.primary} />
        <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
      </View>
    </Pressable>
  );
}

export default function StaffTimelinesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await staffStatus(todayIST());
      setStaff(data.staff || []);
    } catch { setStaff([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.designation || '').toLowerCase().includes(q)
    );
  }, [staff, query]);

  // Open the person's full monthly timeline. We navigate within the CURRENT
  // stack (both AdminStack and ActionsStack register "StaffMonthly"), so this
  // works whether the list was opened from the Admin tab or from the
  // dashboard's "Old Timelines" button — no jarring cross-tab jump.
  const openTimeline = (s) =>
    navigation.navigate('StaffMonthly', { id: s.id, name: s.name });

  const renderItem = ({ item, index }) => (
    <StaffRow item={item} index={index} onPress={() => openTimeline(item)} />
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.ink, COLORS.primaryDeep]}
        style={[styles.header, { paddingTop: insets.top + SP.md }]}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Staff Timelines</Text>
            <Text style={styles.headerSub}>Select a person to view their full history</Text>
          </View>
        </View>

        {/* Stats pill */}
        <View style={styles.statPill}>
          <Ionicons name="people" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.statPillTxt}>
            {loading ? '...' : `${staff.length} team member${staff.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textSoft} style={{ marginLeft: SP.md }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or designation…"
            placeholderTextColor={COLORS.textMute}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ marginRight: SP.md }}>
              <Ionicons name="close-circle" size={17} color={COLORS.textMute} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* Result count when searching */}
      {query.length > 0 && !loading && (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt}>
            {filtered.length === 0
              ? 'No matches'
              : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`}
          </Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingTxt}>Loading team…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={52} color={COLORS.border} />
          <Text style={styles.emptyTitle}>{query ? 'No matches found' : 'No team members yet'}</Text>
          <Text style={styles.emptyBody}>{query ? 'Try a different name or designation.' : 'Staff will appear here once they join.'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: SP.sm }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom: SP.lg,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...TYPE.h2, color: COLORS.white, fontSize: 20 },
  headerSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: SP.md,
  },
  statPillTxt: { ...TYPE.cap, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: COLORS.surface,
    borderRadius: R.md,
    height: 44,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, ...TYPE.body, color: COLORS.text, paddingVertical: 0 },

  // ── Result bar ──────────────────────────────────────────────────────────────
  resultBar: { paddingHorizontal: SP.lg, paddingVertical: SP.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultTxt: { ...TYPE.cap, color: COLORS.textSoft },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { padding: SP.lg, paddingTop: SP.md },

  // ── Row card ────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: COLORS.surface,
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  indexNum: { ...TYPE.cap, color: COLORS.textMute, fontWeight: '800', width: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: 3 },
  name: { ...TYPE.title, color: COLORS.text, flex: 1 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 2,
  },
  roleTxt: { fontSize: 10, fontWeight: '800' },
  desig: { ...TYPE.cap, color: COLORS.textSoft },
  offsiteBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E0F2FE', borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 2 },
  offsiteBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#0891B2' },
  arrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // ── States ──────────────────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SP.sm, paddingHorizontal: SP.xl },
  loadingTxt: { ...TYPE.body, color: COLORS.textSoft, marginTop: SP.sm },
  emptyTitle: { ...TYPE.title, color: COLORS.text, textAlign: 'center' },
  emptyBody: { ...TYPE.cap, color: COLORS.textMute, textAlign: 'center', lineHeight: 18 },
});
