import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Returns the live keyboard height in dp.
 *
 * Why not KeyboardAvoidingView: Expo SDK 54+ forces edge-to-edge on Android, so the
 * window does NOT resize when the keyboard opens (softwareKeyboardLayoutMode:"resize"
 * is ignored). KAV has nothing to react to. Reading the real height and shifting the
 * sheet ourselves works regardless of edge-to-edge, Modal windows, or OS version.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setHeight(e?.endCoordinates?.height ?? 0);
    const onHide = () => setHeight(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, []);
  return height;
}
