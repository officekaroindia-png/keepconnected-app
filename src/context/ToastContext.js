import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';

// Lightweight success/error toast.
//
// IMPORTANT layout note: the old version rendered a full-screen dimmed card as a bare
// sibling of the app tree. Because that sibling wasn't inside a stable flex container,
// mounting/unmounting it forced a layout pass that visibly pushed the whole screen up
// ("comes from beneath, screen pushed up"). We fix that two ways:
//   1) Wrap {children} in a flex:1 View so the app content owns a fixed slot.
//   2) Render the toast as an ABSOLUTE overlay inside that wrapper (pointerEvents
//      box-none) so it floats on top and can never move the screen behind it.
// It's also now a compact strip pinned under the status bar that auto-dismisses —
// much better for frequent check-in / check-out confirmations than a modal + OK button.
const ToastCtx = createContext({ showToast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message: String(message ?? ''), type, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    // Errors linger a touch longer so they can be read.
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 3200 : 2200);
  }, []);

  const dismiss = () => { if (timer.current) clearTimeout(timer.current); setToast(null); };

  const isError = toast?.type === 'error';
  const c = isError ? COLORS.danger : COLORS.success;
  const tint = isError ? COLORS.dangerTint : COLORS.successTint;

  return (
    <ToastCtx.Provider value={{ showToast }}>
      <View style={styles.root}>
        {children}
        {toast && (
          <View pointerEvents="box-none" style={[styles.host, { top: (insets.top || 0) + SP.sm }]}>
            <Animated.View key={toast.key} entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(160)} style={styles.animWrap}>
              <Pressable onPress={dismiss} style={[styles.toast, SHADOW.lift, { borderLeftColor: c }]}>
                <View style={[styles.iconWrap, { backgroundColor: tint }]}>
                  <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={c} />
                </View>
                <Text style={styles.msg} numberOfLines={3}>{toast.message}</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: SP.lg,
    zIndex: 9999, elevation: 24,
  },
  animWrap: { width: '100%', maxWidth: 460, alignItems: 'stretch' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: COLORS.surface, borderRadius: R.md,
    borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SP.md, paddingHorizontal: SP.md,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  msg: { flex: 1, ...TYPE.title, fontSize: 14, color: COLORS.text, lineHeight: 19 },
});
