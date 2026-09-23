import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { getAnnouncements, deleteAnnouncement, updateAnnouncement } from '../../api/extra';
import { useToast } from '../../context/ToastContext';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

const ago = (iso) => { const s = Math.floor((Date.now() - new Date(iso)) / 1000); if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }); };

export default function AnnouncementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null); // { id, body }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setRows(await getAnnouncements()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (a) => Alert.alert('Delete', 'Remove this announcement?', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAnnouncement(a._id); load(); } }]);

  const saveEdit = async () => {
    if (!edit) return;
    const body = (edit.body || '').trim();
    if (!body) return showToast('Announcement cannot be empty', 'error');
    setBusy(true);
    try {
      await updateAnnouncement(edit.id, body);
      showToast('Announcement updated');
      setEdit(null);
      load();
    } catch (e) { Alert.alert('Could not save', e?.response?.data?.message || 'Please try again'); }
    finally { setBusy(false); }
  };

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
              {isAdmin && (
                <View style={styles.actions}>
                  <Pressable onPress={() => setEdit({ id: a._id, body: a.body })} hitSlop={8} style={styles.actBtn}><Ionicons name="create-outline" size={19} color={COLORS.primary} /></Pressable>
                  <Pressable onPress={() => remove(a)} hitSlop={8} style={styles.actBtn}><Ionicons name="trash-outline" size={18} color={COLORS.danger} /></Pressable>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <View style={[styles.modalRoot, { paddingBottom: kb }]}>
          <Pressable style={styles.backdrop} onPress={() => setEdit(null)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Edit announcement</Text>
            <TextInput
              style={styles.input}
              value={edit?.body ?? ''}
              onChangeText={(t) => setEdit((prev) => (prev ? { ...prev, body: t } : prev))}
              placeholder="Announcement text"
              placeholderTextColor={COLORS.textMute}
              multiline
              autoFocus
              maxLength={2000}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setEdit(null)}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
              <Pressable style={[styles.saveBtn, (!edit?.body?.trim() || busy) && { opacity: 0.5 }]} onPress={saveEdit} disabled={!edit?.body?.trim() || busy}>
                {busy ? <ActivityIndicator size="small" color={COLORS.white} /> : <><Ionicons name="checkmark" size={18} color={COLORS.white} /><Text style={styles.saveTxt}>Save</Text></>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  actions: { flexDirection: 'row', gap: SP.sm },
  actBtn: { padding: 4 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xl },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.md },
  sheetTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.md },
  input: { ...TYPE.body, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: SP.md, minHeight: 120, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: SP.sm, marginTop: SP.lg },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center' },
  cancelTxt: { ...TYPE.title, fontSize: 15, color: COLORS.textSoft, fontWeight: '700' },
  saveBtn: { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: COLORS.primary, borderRadius: R.md, paddingVertical: SP.md, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white, fontWeight: '800' },
});
