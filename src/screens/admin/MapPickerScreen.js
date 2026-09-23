import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, TextInput, Keyboard,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getCoordsAndAddress } from '../../hooks/useLocation';

// ─── PUT YOUR MAPTILER API KEY HERE ──────────────────────────────────────────
// Sign up free at https://maptiler.com  →  Account → API Keys → Copy default key
// Free tier: 100,000 map loads + 100,000 geocoding requests per month
const MAPTILER_KEY = 'HTk2HhLKM6T9fWSFg3MM';
// ─────────────────────────────────────────────────────────────────────────────

const buildHtml = (lat, lng) => {
  const startLat = lat || 28.6139;
  const startLng = lng || 77.2090;
  const zoom = lat ? 16 : 11;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #map { height: 100%; width: 100%; }
  .leaflet-control-attribution { display: none; }
  .custom-marker {
    width: 32px; height: 32px;
    background: #3B5BDB;
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  }
  .custom-marker::after {
    content: '';
    position: absolute;
    width: 10px; height: 10px;
    background: white;
    border-radius: 50%;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  }
  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
  }
  .leaflet-control-zoom a {
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    font-size: 18px !important;
    color: #1a1a2e !important;
    border-radius: 8px !important;
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var KEY = '${MAPTILER_KEY}';
  var map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
  }).setView([${startLat}, ${startLng}], ${zoom});

  // MapTiler Streets — Google Maps quality, worldwide coverage
  L.tileLayer(
    'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=' + KEY,
    { maxZoom: 20, tileSize: 256 }
  ).addTo(map);

  // Custom teardrop marker icon
  var icon = L.divIcon({
    className: '',
    html: '<div class="custom-marker"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  var marker = L.marker([${startLat}, ${startLng}], { draggable: true, icon: icon }).addTo(map);

  function send(ll) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: ll.lat, lng: ll.lng }));
  }

  send(marker.getLatLng());

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    send(e.latlng);
  });

  marker.on('dragend', function() {
    send(marker.getLatLng());
  });

  // Called from RN to fly to a searched/GPS location
  window.flyTo = function(la, ln, z) {
    var p = [la, ln];
    map.flyTo(p, z || 17, { duration: 1 });
    marker.setLatLng(p);
    send({ lat: la, lng: ln });
  };
</script>
</body>
</html>`;
};

export default function MapPickerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { onPick, initial } = route.params || {};
  const webRef = useRef(null);

  const [coord, setCoord] = useState(initial || null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);

  // Autocomplete state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const onMessage = (e) => {
    try {
      const c = JSON.parse(e.nativeEvent.data);
      setCoord({ lat: c.lat, lng: c.lng });
    } catch {}
  };

  // ── Autocomplete: fires as user types, debounced 350ms ──
  const onQueryChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(text.trim()), 350);
  };

  const fetchSuggestions = async (q) => {
    setSearching(true);
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=6&language=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = (data.features || []).map((f) => ({
        label: f.place_name || f.text || '',
        lat: f.center[1],
        lng: f.center[0],
      }));
      setSuggestions(items);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseSuggestion = (item) => {
    Keyboard.dismiss();
    setQuery(item.label);
    setSuggestions([]);
    setCoord({ lat: item.lat, lng: item.lng });
    webRef.current?.injectJavaScript(`window.flyTo(${item.lat}, ${item.lng}, 17); true;`);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // ── GPS current location ──
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { lat, lng } = await getCoordsAndAddress();
      setCoord({ lat, lng });
      webRef.current?.injectJavaScript(`window.flyTo(${lat}, ${lng}, 18); true;`);
    } catch (err) {
      Alert.alert('Location', err.message || 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!coord) {
      Alert.alert('Pick a spot', 'Search for a place, tap the map, or use your current location.');
      return;
    }
    onPick?.(coord);
    navigation.goBack();
  };

  const coordLabel = coord
    ? `${coord.lat.toFixed(6)},  ${coord.lng.toFixed(6)}`
    : 'Search, tap the map, or use current location';

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Pick location</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Search bar + autocomplete dropdown ── */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, SHADOW.card]}>
          <Ionicons name="search" size={18} color={COLORS.textMute} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search any place in the world…"
            placeholderTextColor={COLORS.textMute}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : query
              ? <Pressable onPress={clearSearch} hitSlop={10}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textMute} />
                </Pressable>
              : null}
        </View>

        {suggestions.length > 0 && (
          <View style={[styles.dropdown, SHADOW.lift]}>
            {suggestions.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => chooseSuggestion(s)}
                style={({ pressed }) => [
                  styles.suggestion,
                  i < suggestions.length - 1 && styles.suggestionBorder,
                  pressed && { backgroundColor: COLORS.surfaceAlt },
                ]}
              >
                <View style={styles.suggestionIcon}>
                  <Ionicons name="location" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.suggestionTxt} numberOfLines={2}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Map ── */}
      <View style={{ flex: 1 }}>
        {!mapReady && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderTxt}>Loading map…</Text>
          </View>
        )}
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: buildHtml(initial?.lat, initial?.lng) }}
          onMessage={onMessage}
          onLoadEnd={() => setMapReady(true)}
          geolocationEnabled
          style={[{ flex: 1 }, !mapReady && { opacity: 0 }]}
          scrollEnabled={false}
          bounces={false}
        />

        {/* GPS locate button */}
        <Pressable
          onPress={useMyLocation}
          style={[styles.locBtn, SHADOW.lift]}
        >
          {locating
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="locate" size={22} color={COLORS.primary} />}
        </Pressable>
      </View>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SP.md }]}>
        <View style={styles.coordRow}>
          <Ionicons
            name={coord ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={coord ? COLORS.success : COLORS.textMute}
          />
          <Text style={[styles.coordTxt, coord && { color: COLORS.text }]} numberOfLines={1}>
            {coordLabel}
          </Text>
        </View>
        <Pressable
          onPress={confirm}
          style={({ pressed }) => [styles.confirmBtn, SHADOW.lift, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="checkmark" size={20} color={COLORS.white} />
          <Text style={styles.confirmTxt}>Use this location</Text>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.lg, paddingBottom: SP.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { ...TYPE.h2, color: COLORS.text },

  // search
  searchWrap: { zIndex: 20 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface,
    marginHorizontal: SP.lg, marginTop: SP.sm, marginBottom: 4,
    paddingHorizontal: SP.md, height: 50,
    borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, ...TYPE.body, fontSize: 15, color: COLORS.text },

  // autocomplete dropdown
  dropdown: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SP.lg,
    borderRadius: R.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    maxHeight: 280,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SP.md, paddingVertical: 13,
    backgroundColor: COLORS.surface,
  },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionTxt: { flex: 1, ...TYPE.body, fontSize: 14, color: COLORS.text, lineHeight: 19 },

  // map overlay
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg, zIndex: 2, gap: 12,
  },
  loaderTxt: { ...TYPE.cap, color: COLORS.textMute },
  locBtn: {
    position: 'absolute', right: SP.lg, bottom: SP.lg,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // footer
  footer: {
    padding: SP.lg, gap: SP.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordTxt: { ...TYPE.cap, color: COLORS.textMute, flex: 1 },
  confirmBtn: {
    height: 52, borderRadius: R.md, backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
});
