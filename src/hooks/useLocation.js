import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Fresh location every time. Two-tier: Balanced first, High as fallback if Balanced fails.
// No caching. If GPS is off, we PROMPT the user via Android's native "Turn on location?" dialog
// (same one Maps/Uber use) — no need for the user to leave the app.

async function ensurePermissionAndGps() {
  // 1) Permission — this pops the native permission dialog if not yet granted.
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const e = new Error('Location permission is needed for this action.');
    e.code = 'NO_PERMISSION';
    throw e;
  }

  // 2) System location toggle — check whether GPS/Location services are actually on.
  let enabled = await Location.hasServicesEnabledAsync().catch(() => true);

  if (!enabled) {
    // Android has a native "Turn on location?" dialog that we can trigger from inside
    // the app — same one Google Maps uses. iOS has no equivalent, user has to go to
    // Settings themselves.
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        enabled = await Location.hasServicesEnabledAsync().catch(() => false);
      } catch {
        // User dismissed or declined the dialog — enabled stays false.
      }
    }
    if (!enabled) {
      const e = new Error(Platform.OS === 'ios'
        ? 'Open iOS Settings → Privacy → Location Services and turn it on, then try again.'
        : 'Location was not turned on. Tap again and choose OK on the prompt.');
      e.code = 'GPS_OFF';
      throw e;
    }
  }
}

const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => { const e = new Error(`${label} timed out`); e.code = 'TIMEOUT'; rej(e); }, ms)),
]);

// Format an address from expo's on-device geocode result.
const formatDevicePlace = (p) => {
  if (!p) return '';
  return [p.name, p.street, p.district || p.subregion, p.city, p.region, p.postalCode]
    .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
};

// On-device reverse geocode (fast when it works, but unreliable on many Androids).
async function deviceGeocode(lat, lng, ms = 6000) {
  try {
    return await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).then((places) => formatDevicePlace(places?.[0])),
      new Promise((resolve) => setTimeout(() => resolve(''), ms)),
    ]);
  } catch { return ''; }
}

// Web fallback via OpenStreetMap Nominatim — free, no API key, works everywhere.
// This is what reliably returns an address when the on-device geocoder comes up empty.
async function webGeocode(lat, lng, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'KeepConnected/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (data?.display_name) {
      // Trim Nominatim's very long display_name to the meaningful leading parts.
      const a = data.address || {};
      const parts = [
        a.building || a.amenity || a.shop || a.office,
        a.road || a.pedestrian || a.neighbourhood,
        a.suburb || a.city_district,
        a.city || a.town || a.village || a.county,
        a.state,
        a.postcode,
      ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
      return parts.length ? parts.slice(0, 5).join(', ') : data.display_name;
    }
    return '';
  } catch { return ''; }
  finally { clearTimeout(timer); }
}

// Get a readable address for coordinates. Tries on-device first (fast), then the web
// fallback (reliable), retrying the web one once if needed. Returns '' only if EVERY
// method genuinely fails (e.g. no internet at all) — in which case the caller shows coords.
async function reverseGeocode(lat, lng) {
  // 1) On-device — instant when it works.
  const device = await deviceGeocode(lat, lng, 5000);
  if (device && device.length > 3) return device;

  // 2) Web fallback (Nominatim). Retry once on failure — this is the reliable path.
  for (let i = 0; i < 2; i++) {
    const web = await webGeocode(lat, lng, 8000);
    if (web && web.length > 3) return web;
    await new Promise((r) => setTimeout(r, 500));
  }
  return '';
}

// Public helper for resolving an address from coords at DISPLAY time (e.g. timeline
// rows whose stored address is missing). Same reliable path as capture-time.
export async function resolveAddress(lat, lng) {
  if (lat == null || lng == null) return '';
  return reverseGeocode(lat, lng);
}

/**
 * Get lat/lng/address FRESH from the phone. No caching.
 * @param {object} opts
 * @param {boolean} opts.strict When true (default), demand High accuracy at the end.
 *                              When false, accept Balanced (still fresh) — used for task taps
 *                              where sub-40m accuracy is plenty and speed matters.
 */
export async function getCoordsAndAddress(opts = {}) {
  const { strict = true } = opts;
  await ensurePermissionAndGps();

  // 1) Balanced accuracy — network/wifi/cell assisted GPS. Fresh reading, ~10-40m, 2-5s indoors.
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      strict ? 8_000 : 6_000, 'Balanced location'
    );
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const address = await reverseGeocode(lat, lng);
    return { lat, lng, address, accuracy, source: 'balanced' };
  } catch (e) {
    if (!strict) throw e;
  }

  // 2) High accuracy — pure GPS, slower but precise.
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    15_000, 'High-accuracy GPS'
  );
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  const address = await reverseGeocode(lat, lng);
  return { lat, lng, address, accuracy, source: 'high' };
}
