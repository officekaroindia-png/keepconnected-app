import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  Animated, ActivityIndicator, Linking, Alert,
  Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { staffAwayHistory } from '../api/admin';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.80;

// ─── Location popup ──────────────────────────────────────────────────────────
function LocationPopup({ entry, onClose }) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 160, friction: 8 }),
      Animated.timing(opacity, { toValue: 1,   useNativeDriver: true, duration: 180 }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.85, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 150 }),
    ]).start(onClose);
  };

  const openMaps = () => {
    const { lat, lng, address } = entry;
    if (lat == null || lng == null) {
      Alert.alert('No coordinates', 'Exact GPS coordinates were not recorded for this check-in.');
      return;
    }
    const label = encodeURIComponent(address || 'Away Check-in');
    const url = Platform.OS === 'ios'
      ? `maps://?ll=${lat},${lng}&q=${label}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
    );
  };

  const fmtCoord = (n) => (n != null ? n.toFixed(6) : '—');
  const prettyDate = (d) => {
    if (!d) return '';
    const [y, m, day] = String(d).split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtTime = (at) => {
    if (!at) return '';
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(at));
  };

  return (
    <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss}>
      <Animated.View style={[styles.popupOverlay, { opacity }]}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View style={[styles.popup, SHADOW.lift, { transform: [{ scale }] }]}>
            {/* Header */}
            <View style={styles.popupHeader}>
              <View style={styles.popupIconWrap}>
                <Ionicons name="location" size={20} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupTitle}>Away Check-in</Text>
                <Text style={styles.popupSub}>{prettyDate(entry.date)} · {fmtTime(entry.at)}</Text>
              </View>
              <Pressable onPress={dismiss} hitSlop={10} style={styles.popupClose}>
                <Ionicons name="close" size={18} color={COLORS.textSoft} />
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.popupDivider} />

            {/* Address */}
            <View style={styles.popupRow}>
              <View style={[styles.popupRowIcon, { backgroundColor: '#EFF4FF' }]}>
                <Ionicons name="map-outline" size={15} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupRowLabel}>Address</Text>
                <Text style={styles.popupRowValue}>{entry.address || 'Not recorded'}</Text>
              </View>
            </View>

            {/* Coordinates */}
            <View style={styles.popupRow}>
              <View style={[styles.popupRowIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="navigate-outline" size={15} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupRowLabel}>Coordinates</Text>
                <Text style={styles.popupRowValue}>
                  {entry.lat != null ? `${fmtCoord(entry.lat)}, ${fmtCoord(entry.lng)}` : 'Not recorded'}
                </Text>
              </View>
            </View>

            {entry.distance != null && (
              <View style={styles.popupRow}>
                <View style={[styles.popupRowIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="git-branch-outline" size={15} color={COLORS.warn} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.popupRowLabel}>Distance from office</Text>
                  <Text style={styles.popupRowValue}>
                    {entry.distance >= 1000
                      ? `${(entry.distance / 1000).toFixed(1)} km`
                      : `${Math.round(entry.distance)} m`}
                  </Text>
                </View>
              </View>
            )}

            {/* Open Maps Button */}
            <Pressable
              onPress={openMaps}
              style={({ pressed }) => [styles.mapsBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="map" size={17} color={COLORS.white} />
              <Text style={styles.mapsBtnTxt}>Open in Google Maps</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main sheet ──────────────────────────────────────────────────────────────
export default function AwayHistorySheet({ visible, staffId, staffName, awayUsed, awayAllowed, awayUnlimited, onClose }) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setEntries([]);
      Animated.parallel([
        Animated.spring(slideY,        { toValue: 0,   useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, useNativeDriver: true, duration: 250 }),
      ]).start();
      load();
    } else {
      Animated.parallel([
        Animated.timing(slideY,          { toValue: SHEET_H, useNativeDriver: true, duration: 280 }),
        Animated.timing(backdropOpacity, { toValue: 0,       useNativeDriver: true, duration: 220 }),
      ]).start();
    }
  }, [visible]);

  const load = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    try {
      const data = await staffAwayHistory(staffId);
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  const prettyDate = (d) => {
    if (!d) return '';
    const [y, m, day] = String(d).split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    return dt.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtTime = (at) => {
    if (!at) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(at));
  };

  const renderItem = ({ item, index }) => (
    <View style={[styles.entryCard, SHADOW.card]}>
      {/* Left accent line */}
      <View style={styles.entryAccent} />

      <View style={styles.entryBody}>
        {/* Index + date row */}
        <View style={styles.entryTop}>
          <View style={styles.entryIndexBadge}>
            <Text style={styles.entryIndexTxt}>{entries.length - index}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entryDate}>{prettyDate(item.date)}</Text>
            <Text style={styles.entryTime}>{fmtTime(item.at)}</Text>
          </View>
          {/* Location icon tap */}
          <Pressable
            onPress={() => setSelectedEntry(item)}
            style={({ pressed }) => [styles.entryLocBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="location" size={18} color={COLORS.primary} />
          </Pressable>
        </View>

        {/* Address preview */}
        {item.address ? (
          <Text style={styles.entryAddr} numberOfLines={2}>{item.address}</Text>
        ) : (
          <Text style={styles.entryAddrMuted}>Address not recorded</Text>
        )}

        {/* Coords pill */}
        {item.lat != null && (
          <View style={styles.entryCoordPill}>
            <Ionicons name="navigate-outline" size={11} color={COLORS.primary} />
            <Text style={styles.entryCoordTxt}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const totalAllowed = awayUnlimited ? '∞' : (awayAllowed || 0);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Blur + dark backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]} pointerEvents={visible ? 'auto' : 'none'}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + SP.lg }]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetIconWrap}>
            <Ionicons name="airplane" size={20} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Away Check-ins</Text>
            <Text style={styles.sheetSub}>{staffName}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <Ionicons name="close" size={20} color={COLORS.textSoft} />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderColor: '#DDD6FE' }]}>
            <Text style={[styles.statNum, { color: '#7C3AED' }]}>{awayUsed || 0}</Text>
            <Text style={styles.statLbl}>Used this{'\n'}month</Text>
          </View>
          <View style={[styles.statBox, { borderColor: COLORS.border }]}>
            <Text style={[styles.statNum, { color: COLORS.primary }]}>{totalAllowed}</Text>
            <Text style={styles.statLbl}>Allowed{'\n'}per month</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#D1FAE5' }]}>
            <Text style={[styles.statNum, { color: COLORS.success }]}>{entries.length}</Text>
            <Text style={styles.statLbl}>Total{'\n'}all time</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.sheetDivider} />

        {/* Section label */}
        <View style={styles.sectionLabel}>
          <Ionicons name="time-outline" size={14} color={COLORS.textSoft} />
          <Text style={styles.sectionLabelTxt}>Full History · tap{' '}
            <Ionicons name="location" size={12} color={COLORS.primary} />
            {' '}for location details
          </Text>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="airplane-outline" size={44} color={COLORS.border} />
            <Text style={styles.emptyTxt}>No away check-ins recorded yet</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: SP.lg, paddingTop: SP.sm }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {/* Location popup — rendered inside modal so it layers correctly */}
      {selectedEntry && (
        <LocationPopup entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── Sheet ──────────────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 }, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SP.sm, marginBottom: SP.xs },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.md },
  sheetIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { ...TYPE.h2, color: COLORS.text, fontSize: 18 },
  sheetSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: SP.sm, paddingHorizontal: SP.lg, marginBottom: SP.md },
  statBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, alignItems: 'center', borderWidth: 1.5 },
  statNum: { ...TYPE.h1, fontSize: 24 },
  statLbl: { ...TYPE.cap, color: COLORS.textSoft, textAlign: 'center', marginTop: 4, lineHeight: 16 },

  sheetDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SP.lg },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.xs },
  sectionLabelTxt: { ...TYPE.cap, color: COLORS.textSoft },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SP.sm, marginTop: 40 },
  emptyTxt: { ...TYPE.body, color: COLORS.textMute },

  // ── Entry card ─────────────────────────────────────────────────────────────
  entryCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: R.md, marginBottom: SP.sm,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  entryAccent: { width: 4, backgroundColor: '#7C3AED' },
  entryBody: { flex: 1, padding: SP.md },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.xs },
  entryIndexBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  entryIndexTxt: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  entryDate: { ...TYPE.label, color: COLORS.text },
  entryTime: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 1 },
  entryLocBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  entryAddr: { ...TYPE.cap, color: COLORS.textSoft, lineHeight: 17, marginTop: 2 },
  entryAddrMuted: { ...TYPE.cap, color: COLORS.textMute, fontStyle: 'italic', marginTop: 2 },
  entryCoordPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.xs, alignSelf: 'flex-start', backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  entryCoordTxt: { fontSize: 10, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },

  // ── Location Popup ─────────────────────────────────────────────────────────
  popupOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: SP.xl },
  popup: { width: '100%', backgroundColor: COLORS.surface, borderRadius: R.xl, overflow: 'hidden' },
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg },
  popupIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  popupTitle: { ...TYPE.title, color: COLORS.text },
  popupSub: { ...TYPE.cap, color: COLORS.textSoft, marginTop: 2 },
  popupClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  popupDivider: { height: 1, backgroundColor: COLORS.border },
  popupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SP.md, padding: SP.lg, paddingVertical: SP.md },
  popupRowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  popupRowLabel: { ...TYPE.cap, color: COLORS.textSoft, marginBottom: 3 },
  popupRowValue: { ...TYPE.label, color: COLORS.text, lineHeight: 20 },
  mapsBtn: { margin: SP.lg, marginTop: SP.sm, backgroundColor: '#7C3AED', borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, paddingVertical: SP.md + 2 },
  mapsBtnTxt: { ...TYPE.title, color: COLORS.white, fontSize: 15 },
});
