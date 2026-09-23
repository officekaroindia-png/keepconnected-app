// KeepConnected — design tokens. One place; every screen derives from here.
export const COLORS = {
  // Brand
  ink:        '#0B1F3A',   // deep navy — headers
  inkSoft:    '#13294B',
  primary:    '#2563EB',   // confident blue — primary actions
  primaryDeep:'#1D4ED8',
  primaryTint:'#EFF4FF',

  // The single bold accent — reserved for points / rewards only
  gold:       '#F59E0B',
  goldTint:   '#FEF3C7',

  // States
  success:    '#16A34A',   // present / done
  successTint:'#DCFCE7',
  danger:     '#EF4444',   // late / missed
  dangerTint: '#FEE2E2',
  warn:       '#D97706',

  // Neutrals
  bg:         '#F1F5F9',
  surface:    '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  border:     '#E7ECF3',
  text:       '#0F172A',
  textSoft:   '#475569',
  textMute:   '#94A3B8',
  white:      '#FFFFFF',
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R  = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const TYPE = {
  h1:    { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  h2:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  title: { fontSize: 16, fontWeight: '700' },
  body:  { fontSize: 14, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  cap:   { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
};

export const SHADOW = {
  card: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  lift: {
    shadowColor: '#2563EB', shadowOpacity: 0.20, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
};

// minutes-since-midnight → "8:00 AM"
export const fmtMin = (m) => {
  const h = Math.floor(m / 60), min = m % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(min).padStart(2, '0')} ${ampm}`;
};
