import * as Location from 'expo-location';

// Accurate coords for every action. Gets a FRESH high-accuracy GPS fix (not a cached
// one), so check-in/checkout location is trustworthy. A 20s hard timeout means it
// still fails gracefully instead of hanging forever if GPS can't get a lock.
export async function getCoordsAndAddress() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') { const e = new Error('Location permission is needed for this action.'); e.code = 'NO_PERMISSION'; throw e; }

  // Make sure location services are on
  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) throw new Error('Turn on location/GPS and try again.');

  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('Could not get an accurate location. Move to open sky and try again.')), 20000)),
  ]);
  const { latitude: lat, longitude: lng } = pos.coords;

  // Address is best-effort (cosmetic) — capped at 2s so it never delays the action.
  let address = '';
  try {
    address = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).then((places) => {
        const p = places?.[0]; if (!p) return '';
        return [p.name, p.street, p.district || p.subregion, p.city, p.postalCode]
          .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
      }),
      new Promise((resolve) => setTimeout(() => resolve(''), 4000)),
    ]);
  } catch {}
  return { lat, lng, address, accuracy: pos.coords.accuracy };
}
