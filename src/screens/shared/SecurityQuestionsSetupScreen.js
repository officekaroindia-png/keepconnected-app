import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';

const NUM_QUESTIONS = 3;

// A single question + answer row
function QARow({ index, questions, usedQuestions, selected, answer, onSelectQ, onChangeA }) {
  const [open, setOpen] = useState(false);
  const available = questions.filter((q) => q === selected || !usedQuestions.includes(q));

  return (
    <View style={styles.qaWrap}>
      {/* Question picker */}
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.qBtn}>
        <Ionicons name="help-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.qBtnTxt} numberOfLines={2}>
          {selected || `Pick question ${index + 1}`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMute} />
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          {available.map((q) => (
            <Pressable
              key={q}
              onPress={() => { onSelectQ(q); setOpen(false); }}
              style={[styles.dropItem, q === selected && styles.dropItemOn]}
            >
              <Text style={[styles.dropTxt, q === selected && styles.dropTxtOn]}>{q}</Text>
              {q === selected && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Answer input */}
      {!!selected && (
        <View style={styles.ansWrap}>
          <Ionicons name="pencil-outline" size={15} color={COLORS.textMute} style={{ marginTop: 2 }} />
          <TextInput
            style={styles.ansInput}
            value={answer}
            onChangeText={onChangeA}
            placeholder="Your answer"
            placeholderTextColor={COLORS.textMute}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}
    </View>
  );
}

export default function SecurityQuestionsSetupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, sqListQuestions, sqSetup } = useAuth();
  const isFirstTime = route?.params?.firstTime === true;  // came from salary unlock prompt

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  // 3 slots: { question: '', answer: '' }
  const [slots, setSlots] = useState(
    Array.from({ length: NUM_QUESTIONS }, () => ({ question: '', answer: '' }))
  );

  useEffect(() => {
    sqListQuestions()
      .then(setQuestions)
      .catch(() => setError('Could not load questions. Check your connection.'))
      .finally(() => setLoading(false));
  }, []);

  const usedQuestions = slots.map((s) => s.question).filter(Boolean);

  const setSlotQ = useCallback((i, q) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, question: q } : s));
  }, []);

  const setSlotA = useCallback((i, a) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, answer: a } : s));
  }, []);

  const allFilled = slots.every((s) => s.question && s.answer.trim().length >= 1);

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const answers = slots.map((s) => ({ question: s.question, answer: s.answer.trim() }));
      await sqSetup(user?.mobile, answers);
      setDone(true);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0B1F3A', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <View style={styles.bar}>
            <View style={styles.iconBtn} />
            <Text style={styles.headerTitle}>Security Questions</Text>
            <View style={styles.iconBtn} />
          </View>
        </LinearGradient>
        <View style={styles.doneBox}>
          <View style={styles.doneIcon}>
            <Ionicons name="shield-checkmark" size={40} color={COLORS.success} />
          </View>
          <Text style={styles.doneTitle}>All set!</Text>
          <Text style={styles.doneSub}>
            Your security questions are saved. Next time you forget your salary PIN, just answer one question to reset it.
          </Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnTxt}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#0B1F3A', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Security Questions</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>
          Answer one of these to reset your salary PIN — no OTP needed.
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

          {/* First-time banner */}
          {isFirstTime && (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.infoTxt}>
                You haven't set up security questions yet. Set up 3 now so you can always recover your salary PIN without needing admin help.
              </Text>
            </View>
          )}

          {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

          {!loading && !!error && !questions.length && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
              <Text style={styles.errTxt}>{error}</Text>
            </View>
          )}

          {!loading && questions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Choose 3 questions and write your answers</Text>
              <Text style={styles.sectionSub}>Keep your answers simple and memorable. They are not case-sensitive.</Text>

              {slots.map((slot, i) => (
                <QARow
                  key={i}
                  index={i}
                  questions={questions}
                  usedQuestions={usedQuestions}
                  selected={slot.question}
                  answer={slot.answer}
                  onSelectQ={(q) => setSlotQ(i, q)}
                  onChangeA={(a) => setSlotA(i, a)}
                />
              ))}

              {!!error && (
                <View style={[styles.errBox, { marginTop: SP.sm }]}>
                  <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                  <Text style={styles.errTxt}>{error}</Text>
                </View>
              )}

              <Pressable
                onPress={save}
                disabled={!allFilled || saving}
                style={[styles.primaryBtn, (!allFilled || saving) && { opacity: 0.5 }]}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.primaryBtnTxt}>Save security questions</Text>}
              </Pressable>

              <Text style={styles.footerNote}>
                You only need to answer 1 of these 3 when resetting your PIN.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header:      { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...TYPE.h2, color: COLORS.white },
  headerSub:   { ...TYPE.cap, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: SP.sm, lineHeight: 17 },

  // Info banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.primaryTint, borderRadius: R.md, padding: SP.md, marginBottom: SP.lg, borderWidth: 1, borderColor: COLORS.primary + '30' },
  infoTxt:    { flex: 1, ...TYPE.cap, color: COLORS.primary, lineHeight: 17 },

  // Section
  sectionTitle: { ...TYPE.h2, color: COLORS.text, fontSize: 16, marginBottom: 4 },
  sectionSub:   { ...TYPE.cap, color: COLORS.textMute, marginBottom: SP.lg, lineHeight: 17 },

  // Q&A row
  qaWrap:     { backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.md, overflow: 'hidden', ...SHADOW.card },
  qBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.md },
  qBtnTxt:    { flex: 1, ...TYPE.body, color: COLORS.text, fontSize: 13, lineHeight: 18 },

  // Dropdown
  dropdown:   { borderTopWidth: 1, borderTopColor: COLORS.border },
  dropItem:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border + '60' },
  dropItemOn: { backgroundColor: COLORS.primaryTint },
  dropTxt:    { flex: 1, ...TYPE.cap, color: COLORS.textSoft, lineHeight: 17 },
  dropTxtOn:  { color: COLORS.primary, fontWeight: '700' },

  // Answer
  ansWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: SP.md, paddingVertical: 10, backgroundColor: COLORS.surfaceAlt },
  ansInput:  { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 4 },

  // Error
  errBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt: { flex: 1, ...TYPE.cap, color: COLORS.danger, lineHeight: 17 },

  // Button
  primaryBtn:    { height: 54, backgroundColor: COLORS.primary, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.md },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  footerNote: { textAlign: 'center', ...TYPE.cap, color: COLORS.textMute, marginTop: SP.md, lineHeight: 17 },

  // Done
  doneBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl, gap: SP.sm },
  doneIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.successTint, alignItems: 'center', justifyContent: 'center', marginBottom: SP.sm },
  doneTitle: { ...TYPE.h2, color: COLORS.text },
  doneSub:   { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', maxWidth: 290, lineHeight: 20, marginBottom: SP.md },
});
