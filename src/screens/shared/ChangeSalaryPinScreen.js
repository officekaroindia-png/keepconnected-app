import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import {
  salaryPinStatus, changeSalaryPin, forgotSalaryPin,
  getSalaryPinQuestion, forgotSalaryPinBySQ,
} from '../../api/day';

// The status endpoint has been through a few shapes; accept any of them.
const hasPinFrom = (d) => !!(d?.hasPin ?? d?.isSet ?? d?.set ?? d?.exists ?? d?.pinSet);

const PinField = ({ label, hint, value, onChange, autoFocus }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLbl}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      autoFocus={autoFocus}
      placeholder="••••"
      placeholderTextColor={COLORS.textMute}
      returnKeyType="done"
    />
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>
);

export default function ChangeSalaryPinScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(true);
  const [hasPin, setHasPin] = useState(true);

  // 'pin'      → prove it with the current PIN
  // 'password' → prove it with login password
  // 'security' → prove it with security question answer (NEW)
  const [mode, setMode] = useState('pin');

  const [currentPin, setCurrentPin]     = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPin, setNewPin]             = useState('');
  const [confirmPin, setConfirmPin]     = useState('');

  // Security-question state
  const [sqLoading, setSqLoading]   = useState(false);
  const [sqFetched, setSqFetched]   = useState(false); // true once a successful fetch completed
  const [sqQuestion, setSqQuestion] = useState('');
  const [sqAnswer, setSqAnswer]     = useState('');
  const [sqError, setSqError]       = useState('');   // inline SQ load error

  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone]   = useState(false);

  // ── Check if a PIN is already set ────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    salaryPinStatus()
      .then((d) => {
        if (!alive) return;
        const set = hasPinFrom(d);
        setHasPin(set);
        if (!set) setMode('first');   // nothing to prove — just pick a PIN
      })
      .catch(() => {})
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  // ── Load security question when tab is selected ───────────────────────────
  useEffect(() => {
    if (mode !== 'security') return;
    if (sqFetched) return;         // already fetched successfully — don't re-fetch
    setSqLoading(true);
    setSqError('');
    getSalaryPinQuestion()
      .then((d) => { setSqQuestion(d?.question || ''); setSqFetched(true); })
      .catch((e) => setSqError(e?.response?.data?.message || 'Could not load your security question. Check your connection.'))
      .finally(() => setSqLoading(false));
  }, [mode, sqFetched]);

  const reset = () => {
    setCurrentPin(''); setPassword(''); setSqAnswer('');
    setError(null);
    // If SQ load had an error, clear it so the tab can retry on re-select.
    // If it succeeded, keep sqFetched/sqQuestion so we don't re-fetch unnecessarily.
    if (sqError) { setSqError(''); setSqFetched(false); }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setError(null);
    if (!/^\d{4,6}$/.test(newPin))         return setError('Your new PIN must be 4 to 6 digits.');
    if (newPin !== confirmPin)              return setError('The two new PINs do not match.');
    if (mode === 'pin' && !/^\d{4,6}$/.test(currentPin))
                                            return setError('Enter the PIN you use today.');
    if (mode === 'password' && !password)   return setError('Enter your login password.');
    if (mode === 'security' && !sqAnswer.trim())
                                            return setError('Please enter your answer.');

    setBusy(true);
    try {
      let res;
      if (mode === 'security') {
        res = await forgotSalaryPinBySQ(sqQuestion, sqAnswer.trim(), newPin);
      } else if (mode === 'password') {
        res = await forgotSalaryPin(password, newPin);
      } else {
        res = await changeSalaryPin(newPin, mode === 'first' ? undefined : currentPin);
      }

      if (res?.success === false) {
        setError(res.message || 'That did not work. Check what you entered and try again.');
      } else {
        setDone(true);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [mode, currentPin, password, sqQuestion, sqAnswer, newPin, confirmPin]);

  const title = mode === 'first' ? 'Set your salary PIN' : 'Change your salary PIN';

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0B1F3A', '#1D4ED8', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <View style={styles.bar}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Salary PIN</Text>
            <View style={styles.backBtn} />
          </View>
        </LinearGradient>
        <View style={styles.doneBox}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={44} color={COLORS.success} />
          </View>
          <Text style={styles.doneTitle}>PIN updated</Text>
          <Text style={styles.doneMsg}>Use your new PIN the next time you open your salary sheet.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.primaryBtn}>
            <Text style={styles.primaryTxt}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0B1F3A', '#1D4ED8', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Salary PIN</Text>
          <View style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="keypad" size={17} color={COLORS.gold} />
          </View>
        </View>
        <Text style={styles.headerSub}>Only you can change this. No admin needed.</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {checking && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

          {!checking && (
            <>
              <Text style={styles.screenTitle}>{title}</Text>

              {/* ── Segment tabs (only shown when a PIN already exists) ── */}
              {hasPin && (
                <View style={styles.segment}>
                  {[
                    ['pin',      'I know my PIN'],
                    ['password', 'Forgot PIN'],
                    ['security', 'Security Q'],
                  ].map(([key, label]) => {
                    const on = mode === key;
                    return (
                      <Pressable key={key} onPress={() => { setMode(key); reset(); }}
                        style={[styles.segBtn, on && styles.segBtnOn]}>
                        <Text style={[styles.segTxt, on && styles.segTxtOn]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={[styles.card, SHADOW.card]}>

                {/* ── Mode: current PIN ── */}
                {mode === 'pin' && (
                  <PinField label="Current PIN" value={currentPin} onChange={setCurrentPin} autoFocus />
                )}

                {/* ── Mode: login password ── */}
                {mode === 'password' && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLbl}>Your login password</Text>
                    <View style={styles.pwWrap}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="The password you sign in with"
                        placeholderTextColor={COLORS.textMute}
                        autoFocus
                      />
                      <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.textMute} />
                      </Pressable>
                    </View>
                    <Text style={styles.fieldHint}>
                      This is the password you use to log in to the app, not your salary PIN.
                    </Text>
                  </View>
                )}

                {/* ── Mode: security question ── */}
                {mode === 'security' && (
                  <>
                    {sqLoading && (
                      <ActivityIndicator color={COLORS.primary} style={{ marginBottom: SP.md }} />
                    )}
                    {!!sqError && !sqLoading && (
                      <View style={styles.errBox}>
                        <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                        <Text style={styles.errTxt}>{sqError}</Text>
                      </View>
                    )}
                    {!sqLoading && !!sqQuestion && (
                      <>
                        {/* Show the question */}
                        <View style={styles.sqBox}>
                          <Ionicons name="help-circle-outline" size={20} color={COLORS.primary} />
                          <Text style={styles.sqQuestion}>{sqQuestion}</Text>
                        </View>
                        {/* Answer field */}
                        <View style={styles.field}>
                          <Text style={styles.fieldLbl}>Your answer</Text>
                          <TextInput
                            style={[styles.input, { letterSpacing: 0 }]}
                            value={sqAnswer}
                            onChangeText={setSqAnswer}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder="Type your answer"
                            placeholderTextColor={COLORS.textMute}
                            autoFocus
                          />
                        </View>
                      </>
                    )}
                    {!sqLoading && !sqQuestion && !sqError && (
                      <Text style={styles.fieldHint}>
                        No security question found. You may not have set one up yet — try using your login password instead.
                      </Text>
                    )}
                  </>
                )}

                {/* ── First time ── */}
                {mode === 'first' && (
                  <Text style={styles.firstNote}>
                    You have not set a salary PIN yet. Choose one now and you will need it every time you open your salary.
                  </Text>
                )}

                <PinField label="New PIN" hint="4 to 6 digits" value={newPin} onChange={setNewPin}
                  autoFocus={mode === 'first'} />
                <PinField label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} />

                {error ? (
                  <View style={styles.errBox}>
                    <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                    <Text style={styles.errTxt}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={submit}
                  disabled={busy || (mode === 'security' && (!sqQuestion || sqLoading))}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (busy || (mode === 'security' && (!sqQuestion || sqLoading))) && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {busy
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.primaryTxt}>{mode === 'first' ? 'Set PIN' : 'Save new PIN'}</Text>}
                </Pressable>
              </View>

              {/* Info box for password mode */}
              {mode === 'password' && (
                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.infoTxt}>
                    After five wrong passwords this is locked for 15 minutes. If you have also forgotten your
                    login password, an admin can reset that for you from Staff Status.
                  </Text>
                </View>
              )}

              {/* Info box for security-question mode */}
              {mode === 'security' && (
                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.infoTxt}>
                    You only need to answer one question correctly. These are the answers you set when you first
                    configured your security questions.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SP.lg, paddingBottom: SP.lg,
    borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...TYPE.h2, color: COLORS.white },
  headerSub: { ...TYPE.cap, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: SP.sm },

  screenTitle: { ...TYPE.h2, color: COLORS.text, marginBottom: SP.md },

  // 3-tab segment
  segment: {
    flexDirection: 'row', gap: 4, backgroundColor: COLORS.surfaceAlt,
    borderRadius: R.pill, padding: 3, marginBottom: SP.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: R.pill },
  segBtnOn: { backgroundColor: COLORS.primary },
  segTxt: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', fontSize: 11 },
  segTxtOn: { color: COLORS.white, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: R.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SP.lg,
  },
  field: { marginBottom: SP.md },
  fieldLbl: { ...TYPE.label, color: COLORS.textSoft, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: R.sm,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SP.md, paddingVertical: 12,
    fontSize: 17, color: COLORS.text, letterSpacing: 2,
  },
  fieldHint: { ...TYPE.cap, color: COLORS.textMute, marginTop: 5, lineHeight: 16 },
  pwWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyeBtn: { padding: 8 },
  firstNote: { ...TYPE.body, color: COLORS.textSoft, lineHeight: 20, marginBottom: SP.md },

  // Security question display
  sqBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.primaryTint, borderRadius: R.sm,
    padding: SP.md, marginBottom: SP.md,
  },
  sqQuestion: { flex: 1, ...TYPE.body, color: COLORS.primary, fontWeight: '700', lineHeight: 20 },

  errBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#FEE2E2', borderRadius: R.sm,
    padding: SP.sm, marginBottom: SP.md,
  },
  errTxt: { ...TYPE.cap, color: COLORS.danger, flex: 1, lineHeight: 17 },

  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: R.md,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  primaryTxt: { ...TYPE.title, fontSize: 15, color: COLORS.white },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.primaryTint, borderRadius: R.md,
    padding: SP.md, marginTop: SP.md,
  },
  infoTxt: { ...TYPE.cap, color: COLORS.textSoft, flex: 1, lineHeight: 17 },

  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl, gap: SP.sm },
  doneIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.successTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: SP.sm,
  },
  doneTitle: { ...TYPE.h2, color: COLORS.text },
  doneMsg: { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', maxWidth: 280, marginBottom: SP.md },
});
