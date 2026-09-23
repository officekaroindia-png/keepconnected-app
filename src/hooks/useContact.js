import { Linking, Alert } from 'react-native';

const clean = (m) => String(m || '').replace(/[^\d+]/g, '');
export const callNumber = (mobile) => {
  const n = clean(mobile); if (!n) return;
  Linking.openURL(`tel:${n}`).catch(() => Alert.alert('Call', 'Could not open the dialer.'));
};
export const whatsappNumber = (mobile) => {
  let n = clean(mobile);
  if (n.startsWith('+')) n = n.slice(1);
  const url = `whatsapp://send?phone=${n}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://wa.me/${n}`).catch(() => Alert.alert('WhatsApp', 'WhatsApp is not installed.')));
};
