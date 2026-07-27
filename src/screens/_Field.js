import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SP, R, TYPE } from '../theme/theme';

export default function Field({ icon, secure, ...props }) {
  const [f, setF] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.field, f && styles.focus]}>
      <Ionicons name={icon} size={18} color={f ? COLORS.primary : COLORS.textMute} />
      <TextInput style={styles.input} placeholderTextColor={COLORS.textMute}
        secureTextEntry={secure && !show} onFocus={() => setF(true)} onBlur={() => setF(false)} {...props} />
      {secure && <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMute} />
      </Pressable>}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, height: 54, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: R.md, paddingHorizontal: SP.md, marginBottom: SP.md, backgroundColor: COLORS.surfaceAlt },
  focus: { borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  input: { flex: 1, ...TYPE.body, fontSize: 15, color: COLORS.text },
});
