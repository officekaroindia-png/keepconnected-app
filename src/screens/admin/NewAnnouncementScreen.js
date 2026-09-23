import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { postAnnouncement } from '../../api/extra';
import { useKeyboardHeight } from '../../hooks/useKeyboard';

export default function NewAnnouncementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (status) => {
    if (!body.trim()) return;
    setBusy(true);
    try { await postAnnouncement(body.trim(), status); navigation.goBack(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.barTitle}>Post a new announcement</Text><View style={{ width: 24 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.lg + kb }}>
        <TextInput style={[styles.input, SHADOW.card]} value={body} onChangeText={setBody} multiline
          placeholder="Enter the announcement here" placeholderTextColor={COLORS.textMute} textAlignVertical="top" />
        <View style={styles.btnRow}>
          <Pressable onPress={() => submit('posted')} disabled={busy || !body.trim()} style={[styles.btn, { backgroundColor: body.trim() ? COLORS.ink : COLORS.border }]}>
            {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnTxt}>Post</Text>}
          </Pressable>
          <Pressable onPress={() => submit('draft')} disabled={busy || !body.trim()} style={[styles.btn, { backgroundColor: body.trim() ? COLORS.inkSoft : COLORS.border }]}>
            <Text style={styles.btnTxt}>Save</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={[styles.btn, { backgroundColor: COLORS.inkSoft }]}>
            <Text style={styles.btnTxt}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barTitle: { ...TYPE.title, fontSize: 17, color: COLORS.text },
  input: { height: 260, backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, padding: SP.lg, ...TYPE.body, fontSize: 16, color: COLORS.text },
  btnRow: { flexDirection: 'row', gap: SP.md, marginTop: SP.lg },
  btn: { flex: 1, height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
});
