import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import Field from './_Field';

// ── Steps ──────────────────────────────────────────────────────────────────────
// MOBILE        → enter mobile number
// CHECKING      → spinner while we ask server if SQ is set up
// SQ_ANSWER     → user answers one random security question  (returning user)
// SQ_SETUP      → first time: pick 2 questions & answer them
//                 (after OTP reset when SQ weren't set yet)
// OTP           → fallback: enter OTP
// NEW_PW        → enter new password  (reached from SQ_ANSWER or OTP)
// DONE          → success
const STEP = {
  MOBILE:    'mobile',
  CHECKING:  'checking',
  SQ_ANSWER: 'sq_answer',
  SQ_SETUP:  'sq_setup',
  OTP:       'otp',
  NEW_PW:    'new_pw',
  DONE:      'done',
};

// Dot progress steps shown at bottom (only for non-done flows)
const FLOW_SQ  = [STEP.MOBILE, STEP.SQ_ANSWER, STEP.NEW_PW];
const FLOW_OTP = [STEP.MOBILE, STEP.OTP, STEP.NEW_PW];
const FLOW_SETUP = [STEP.MOBILE, STEP.SQ_SETUP, STEP.DONE];

export default function ForgotPasswordScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const { forgotPassword, resetPassword, sqListQuestions, sqSetup, sqCheck, sqVerifyReset } = useAuth();

  const [step, setStep]   = useState(STEP.MOBILE);
  const [mobile, setMobile] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');

  // OTP flow
  const [otp, setOtp]         = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Security question flow
  const [sqQuestion, setSqQuestion]   = useState('');   // single question shown for answer
  const [sqAnswer, setSqAnswer]       = useState('');

  // SQ setup (first time)
  const [questionBank, setQuestionBank] = useState([]);
  const [setupAnswers, setSetupAnswers] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);

  // After SQ reset we prompt them to set up questions
  const [postOtpSetup, setPostOtpSetup] = useState(false);

  // ── Sub-titles per step ────────────────────────────────────────────────────
  const subtitle = {
    [STEP.MOBILE]:    'Enter your registered mobile number',
    [STEP.CHECKING]:  'Checking your account…',
    [STEP.SQ_ANSWER]: 'Answer your security question',
    [STEP.SQ_SETUP]:  'Set up security questions for next time',
    [STEP.OTP]:       `Enter the 6-digit OTP sent to ${mobile}`,
    [STEP.NEW_PW]:    'Set your new password',
    [STEP.DONE]:      postOtpSetup ? 'Security questions saved!' : 'Password reset successfully!',
  }[step] || '';

  // ── Load question bank when entering SQ_SETUP ────────────────────────────
  useEffect(() => {
    if (step === STEP.SQ_SETUP && questionBank.length === 0) {
      sqListQuestions().then(setQuestionBank).catch(() => {});
    }
  }, [step]);

  // ── Step 1: check mobile → route to SQ or OTP ────────────────────────────
  const handleMobileNext = async () => {
    setErr(''); setBusy(true);
    setStep(STEP.CHECKING);
    try {
      const res = await sqCheck(mobile.trim());
      if (res.hasQuestions) {
        setSqQuestion(res.question);
        setStep(STEP.SQ_ANSWER);
      } else {
        // No security questions set — fall back to OTP
        const otpRes = await forgotPassword(mobile.trim());
        if (otpRes.otp_dev) Alert.alert('Dev OTP', `OTP: ${otpRes.otp_dev}`);
        setStep(STEP.OTP);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed. Check your connection.');
      setStep(STEP.MOBILE);
    } finally { setBusy(false); }
  };

  // ── SQ answer → reset password ────────────────────────────────────────────
  const handleSqReset = async () => {
    setErr('');
    if (!sqAnswer.trim()) { setErr('Please enter your answer'); return; }
    if (newPw !== confirmPw) { setErr('Passwords do not match'); return; }
    if (newPw.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await sqVerifyReset(mobile.trim(), sqQuestion, sqAnswer.trim(), newPw);
      setStep(STEP.DONE);
    } catch (e) { setErr(e?.response?.data?.message || 'Reset failed'); }
    finally { setBusy(false); }
  };

  // ── OTP verify + reset ─────────────────────────────────────────────────────
  const handleOtpReset = async () => {
    setErr('');
    if (newPw !== confirmPw) { setErr('Passwords do not match'); return; }
    if (newPw.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await resetPassword(mobile.trim(), otp.trim(), newPw);
      // After OTP reset, offer to set up security questions
      setPostOtpSetup(false);
      setStep(STEP.SQ_SETUP);
    } catch (e) { setErr(e?.response?.data?.message || 'Reset failed'); }
    finally { setBusy(false); }
  };

  // ── SQ setup save ─────────────────────────────────────────────────────────
  const handleSqSetup = async () => {
    setErr('');
    const filled = setupAnswers.filter((a) => a.question && a.answer.trim());
    if (filled.length < 2) { setErr('Please select and answer at least 2 questions'); return; }
    const qs = filled.map((a) => a.question);
    if (new Set(qs).size !== qs.length) { setErr('Please choose different questions for each'); return; }
    setBusy(true);
    try {
      await sqSetup(mobile.trim(), filled.map((a) => ({ question: a.question, answer: a.answer.trim() })));
      setPostOtpSetup(true);
      setStep(STEP.DONE);
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to save questions'); }
    finally { setBusy(false); }
  };

  const resendOtp = async () => {
    setBusy(true);
    try {
      const r = await forgotPassword(mobile.trim());
      if (r.otp_dev) Alert.alert('Dev OTP', `OTP: ${r.otp_dev}`);
    } catch {}
    finally { setBusy(false); }
  };

  // ── Which progress dots to show ────────────────────────────────────────────
  const flowSteps = step === STEP.SQ_SETUP || step === STEP.DONE && !postOtpSetup
    ? FLOW_SETUP
    : [STEP.SQ_ANSWER, STEP.NEW_PW].includes(step) ? FLOW_SQ : FLOW_OTP;

  const dotIndex = flowSteps.indexOf(step);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: 40 }]}
      >
        {/* Back */}
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          <Text style={styles.backTxt}>Sign in</Text>
        </Pressable>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.brand}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={step === STEP.DONE ? 'checkmark-circle-outline' : step === STEP.SQ_SETUP ? 'shield-checkmark-outline' : 'lock-open-outline'}
              size={36} color={COLORS.primary}
            />
          </View>
          <Text style={styles.title}>
            {step === STEP.SQ_SETUP ? 'Security Questions' : 'Forgot Password'}
          </Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </Animated.View>

        {/* ── DONE ── */}
        {step === STEP.DONE && (
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, SHADOW.card]}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
            </View>
            <Text style={styles.doneTxt}>
              {postOtpSetup
                ? 'Security questions saved. Next time you can reset your password by answering a question — no OTP needed.'
                : 'Your password has been reset. You can now sign in with your new password.'}
            </Text>
            <Pressable onPress={onBack} style={[styles.btn, { backgroundColor: COLORS.primary }, SHADOW.lift]}>
              <Text style={styles.btnTxt}>Back to Sign In</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── MOBILE ── */}
        {step === STEP.MOBILE && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.card, SHADOW.card]}>
            {!!err && <ErrBox msg={err} />}
            <Field icon="call-outline" placeholder="Mobile number" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
            <PrimaryBtn
              label="Continue"
              onPress={handleMobileNext}
              disabled={mobile.trim().length < 7 || busy}
              busy={busy}
            />
          </Animated.View>
        )}

        {/* ── CHECKING (spinner) ── */}
        {step === STEP.CHECKING && (
          <View style={styles.spinnerBox}>
            <ActivityIndicator color={COLORS.white} size="large" />
          </View>
        )}

        {/* ── SQ ANSWER ── */}
        {step === STEP.SQ_ANSWER && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.card, SHADOW.card]}>
            {!!err && <ErrBox msg={err} />}
            <View style={styles.sqBox}>
              <Ionicons name="help-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sqQuestion}>{sqQuestion}</Text>
            </View>
            <Field icon="chatbubble-outline" placeholder="Your answer" value={sqAnswer} onChangeText={setSqAnswer} />
            <View style={styles.divider} />
            <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>New Password</Text>
            <Field icon="lock-closed-outline" placeholder="New password (min 6 chars)" secure value={newPw} onChangeText={setNewPw} />
            <Field icon="lock-closed-outline" placeholder="Confirm new password" secure value={confirmPw} onChangeText={setConfirmPw} />
            <PrimaryBtn
              label="Reset Password"
              onPress={handleSqReset}
              disabled={!sqAnswer.trim() || newPw.length < 6 || busy}
              busy={busy}
            />
            {/* Fallback to OTP */}
            <Pressable onPress={async () => {
              setBusy(true);
              try { const r = await forgotPassword(mobile.trim()); if (r.otp_dev) Alert.alert('Dev OTP', `OTP: ${r.otp_dev}`); setStep(STEP.OTP); }
              catch {}
              finally { setBusy(false); }
            }} hitSlop={8} style={{ alignItems: 'center', marginTop: SP.sm }}>
              <Text style={styles.resendTxt}>Forgot the answer? <Text style={styles.resendLink}>Use OTP instead</Text></Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── OTP + NEW PASSWORD ── */}
        {(step === STEP.OTP || step === STEP.NEW_PW) && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.card, SHADOW.card]}>
            {!!err && <ErrBox msg={err} />}
            <Text style={styles.sectionLabel}>OTP</Text>
            <Field
              icon="keypad-outline" placeholder="6-digit OTP" keyboardType="number-pad"
              value={otp} maxLength={6}
              onChangeText={(v) => { setOtp(v); if (v.length === 6) setStep(STEP.NEW_PW); }}
            />
            {step === STEP.NEW_PW && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: SP.md }]}>New Password</Text>
                <Field icon="lock-closed-outline" placeholder="New password (min 6 chars)" secure value={newPw} onChangeText={setNewPw} />
                <Field icon="lock-closed-outline" placeholder="Confirm new password" secure value={confirmPw} onChangeText={setConfirmPw} />
              </>
            )}
            <PrimaryBtn
              label="Reset Password"
              onPress={handleOtpReset}
              disabled={otp.length < 6 || newPw.length < 6 || busy}
              busy={busy}
            />
            <Pressable onPress={resendOtp} hitSlop={8} style={{ alignItems: 'center', marginTop: SP.sm }}>
              <Text style={styles.resendTxt}>Didn't receive OTP? <Text style={styles.resendLink}>Resend</Text></Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── SQ SETUP (first-time or post-OTP-reset) ── */}
        {step === STEP.SQ_SETUP && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.card, SHADOW.card]}>
            {!!err && <ErrBox msg={err} />}

            <Text style={styles.setupInfo}>
              Choose 2 questions and remember your answers. Next time you forget your password, you can reset it instantly — no OTP needed.
            </Text>

            {setupAnswers.map((item, idx) => (
              <View key={idx} style={styles.setupBlock}>
                <Text style={styles.sectionLabel}>Question {idx + 1}</Text>
                {/* Question picker */}
                <View style={styles.qPickerWrap}>
                  {questionBank.map((q) => {
                    const otherChosen = setupAnswers.some((a, i) => i !== idx && a.question === q);
                    const selected = item.question === q;
                    return (
                      <TouchableOpacity
                        key={q}
                        disabled={otherChosen}
                        onPress={() => {
                          const copy = [...setupAnswers];
                          copy[idx] = { ...copy[idx], question: q };
                          setSetupAnswers(copy);
                        }}
                        style={[
                          styles.qOption,
                          selected && styles.qOptionSelected,
                          otherChosen && styles.qOptionDisabled,
                        ]}
                      >
                        <Text style={[
                          styles.qOptionTxt,
                          selected && styles.qOptionTxtSelected,
                          otherChosen && { color: COLORS.textMute },
                        ]}>{q}</Text>
                        {selected && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={{ marginLeft: 6, flexShrink: 0 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {item.question ? (
                  <Field
                    icon="chatbubble-outline"
                    placeholder="Your answer"
                    value={item.answer}
                    onChangeText={(v) => {
                      const copy = [...setupAnswers];
                      copy[idx] = { ...copy[idx], answer: v };
                      setSetupAnswers(copy);
                    }}
                  />
                ) : null}
              </View>
            ))}

            <PrimaryBtn
              label="Save Questions"
              onPress={handleSqSetup}
              disabled={setupAnswers.filter((a) => a.question && a.answer.trim()).length < 2 || busy}
              busy={busy}
            />
            <Pressable onPress={() => { setPostOtpSetup(false); setStep(STEP.DONE); }} hitSlop={8} style={{ alignItems: 'center', marginTop: SP.sm }}>
              <Text style={styles.resendTxt}><Text style={styles.resendLink}>Skip for now</Text></Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Progress dots */}
        {step !== STEP.DONE && step !== STEP.CHECKING && (
          <View style={styles.dots}>
            {flowSteps.map((s, i) => (
              <View key={i} style={[styles.dot, i <= dotIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Small reusable components ──────────────────────────────────────────────────
function ErrBox({ msg }) {
  return (
    <View style={styles.errBox}>
      <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
      <Text style={styles.errTxt}>{msg}</Text>
    </View>
  );
}

function PrimaryBtn({ label, onPress, disabled, busy }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: !disabled ? COLORS.primary : COLORS.border }, !disabled && SHADOW.lift]}
    >
      {busy ? <ActivityIndicator color={COLORS.white} /> : (
        <Text style={[styles.btnTxt, { color: !disabled ? COLORS.white : COLORS.textMute }]}>{label}</Text>
      )}
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  inner:       { flexGrow: 1, paddingHorizontal: SP.xl },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SP.xl },
  backTxt:     { ...TYPE.label, color: 'rgba(255,255,255,0.8)' },
  brand:       { alignItems: 'center', marginBottom: SP.xl },
  iconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: SP.md },
  title:       { fontSize: 24, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  sub:         { ...TYPE.label, color: 'rgba(255,255,255,0.65)', marginTop: 6, textAlign: 'center' },

  card:        { backgroundColor: COLORS.surface, borderRadius: R.xl, padding: SP.xl },
  errBox:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.dangerTint, borderRadius: R.sm, padding: SP.sm, marginBottom: SP.md },
  errTxt:      { flex: 1, ...TYPE.cap, color: COLORS.danger },

  sectionLabel: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '700', marginBottom: 4 },

  btn:         { height: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: SP.md },
  btnTxt:      { ...TYPE.title, fontSize: 16, color: COLORS.white },

  doneIcon:    { alignItems: 'center', marginBottom: SP.md },
  doneTxt:     { ...TYPE.body, color: COLORS.textSoft, textAlign: 'center', lineHeight: 22, marginBottom: SP.lg },

  spinnerBox:  { alignItems: 'center', marginTop: 40 },

  // Security question display
  sqBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.primaryTint, borderRadius: R.sm, padding: SP.md, marginBottom: SP.md },
  sqQuestion:  { flex: 1, ...TYPE.body, color: COLORS.primary, fontWeight: '700', lineHeight: 20 },

  divider:     { height: 1, backgroundColor: COLORS.border, marginVertical: SP.md },

  // SQ setup
  setupInfo:   { ...TYPE.body, color: COLORS.textSoft, lineHeight: 20, marginBottom: SP.lg },
  setupBlock:  { marginBottom: SP.lg },
  qPickerWrap: { gap: 6, marginBottom: SP.sm },
  qOption:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: 10, borderRadius: R.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  qOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  qOptionDisabled: { opacity: 0.4 },
  qOptionTxt:      { flex: 1, ...TYPE.body, color: COLORS.text, fontSize: 13 },
  qOptionTxtSelected: { color: COLORS.primary, fontWeight: '700' },

  resendTxt:   { ...TYPE.cap, color: COLORS.textMute },
  resendLink:  { color: COLORS.primary, fontWeight: '700' },

  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: SP.xl },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive:   { backgroundColor: COLORS.white, width: 20 },
});
