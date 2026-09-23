/**
 * Time formatting utilities that always render in the company timezone (IST by default).
 *
 * The problem with `new Date(iso).toLocaleTimeString()` is that it uses the DEVICE's
 * local timezone. On servers or test devices running UTC this shows times 5.5 hours
 * behind IST (01:31 instead of 07:01, etc.).
 *
 * Always use these helpers when displaying stored UTC timestamps to users.
 */

const COMPANY_TZ = 'Asia/Kolkata'; // TODO: pass from company settings when multi-tz needed

/**
 * Format a UTC ISO string or Date to HH:MM in the company timezone.
 * e.g. "2026-09-08T05:01:00.000Z" → "10:31"  (IST = UTC+5:30)
 */
export const hhmm = (iso, tz = COMPANY_TZ) => {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
};

/**
 * Format to HH:MM:SS in the company timezone.
 */
export const hhmmss = (iso, tz = COMPANY_TZ) => {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
};
