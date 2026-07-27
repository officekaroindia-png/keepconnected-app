import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { getAnnouncements, deleteAnnouncement } from '../../api/extra';

const ago = (iso) => { const s = Math.floor((Date.now() - new Date(iso)) / 1000); if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }); };

export default function AnnouncementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setRows(await getAnnouncements()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (a) => Alert.alert('Delete', 'Remove this announcement?', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAnnouncement(a._id); load(); } }]);

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.barTitle}>Announcements</Text>
        {isAdmin ? <Pressable onPress={() => navigation.navigate('NewAnnouncement')} hitSlop={10}><Ionicons name="create" size={24} color={COLORS.primary} /></Pressable> : <View style={{ width: 24 }} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {!loading && !rows.length && <Text style={styles.dim}>No announcements yet.</Text>}
        {rows.map((a) => (
          <View key={a._id} style={[styles.card, SHADOW.card]}>
            <Text style={styles.body}>{a.body}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{a.authorName || 'Admin'} · {ago(a.createdAt)}</Text>
              {isAdmin && <Pressable onPress={() => remove(a)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={COLORS.danger} /></Pressable>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barTitle: { ...TYPE.h2, color: COLORS.text },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  body: { ...TYPE.body, fontSize: 15, color: COLORS.text, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.md },
  meta: { ...TYPE.cap, color: COLORS.textMute },
});
