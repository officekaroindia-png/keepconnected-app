import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';

// Centered success/error confirmation card (like the old app): a colored header
// with the message, and an OK button. Auto-dismisses, or tap OK / outside.
const ToastCtx = createContext({ showToast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const dismiss = () => { if (timer.current) clearTimeout(timer.current); setToast(null); };

  const isError = toast?.type === 'error';
  const c = isError ? COLORS.danger : COLORS.success;

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View key={toast.key} entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          <Animated.View entering={ZoomIn.duration(180)} style={[styles.card, SHADOW.lift]}>
            <View style={[styles.head, { backgroundColor: c }]}>
              <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={30} color={COLORS.white} />
              <Text style={styles.title}>{isError ? 'Oops' : 'Success'}</Text>
              <Text style={styles.msg}>{toast.message}</Text>
            </View>
            <Pressable onPress={dismiss} style={styles.okBtn} android_ripple={{ color: '#E5EEFF' }}>
              <Text style={[styles.okTxt, { color: c }]}>OK</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: SP.xl },
  card: { width: '86%', maxWidth: 340, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surface },
  head: { paddingVertical: SP.xl, paddingHorizontal: SP.lg, alignItems: 'center', gap: SP.sm },
  title: { ...TYPE.h2, color: COLORS.white, fontWeight: '800' },
  msg: { ...TYPE.body, color: COLORS.white, textAlign: 'center', fontSize: 16, lineHeight: 22, opacity: 0.97 },
  okBtn: { paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.surface },
  okTxt: { ...TYPE.title, fontSize: 17, fontWeight: '800' },
});
