import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { resolveAddress } from '../hooks/useLocation';

// Module-level cache so the same coords aren't looked up repeatedly across renders/screens.
const addrCache = new Map();
const keyOf = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

/**
 * Shows an event's address. Priority:
 *   1. The stored address (from when the event was recorded)
 *   2. A live reverse-geocode of the coords (for old records, or when capture-time
 *      geocoding failed — this is what stops raw coords from ever showing)
 *   3. Raw coords, only if every lookup genuinely fails (no internet)
 */
export default function EventAddress({ address, lat, lng, style }) {
  const hasCoords = lat != null && lng != null;
  const [resolved, setResolved] = useState(() => {
    if (address) return address;
    if (hasCoords) return addrCache.get(keyOf(lat, lng)) || null;
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    // Only look up when we have coords but no usable address yet.
    if (address || !hasCoords) { setResolved(address || null); return; }
    const k = keyOf(lat, lng);
    const cached = addrCache.get(k);
    if (cached) { setResolved(cached); return; }

    setLoading(true);
    resolveAddress(lat, lng).then((a) => {
      if (!alive) return;
      if (a) { addrCache.set(k, a); setResolved(a); }
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [address, lat, lng, hasCoords]);

  if (resolved) return <Text style={style}>{resolved}</Text>;
  if (loading) return <Text style={[style, { fontStyle: 'italic', opacity: 0.7 }]}>Locating…</Text>;
  if (hasCoords) return <Text style={style}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>;
  return null;
}
