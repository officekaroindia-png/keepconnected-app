import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { saveTokens, clearTokens, getRefresh } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const CACHED_USER_KEY = 'kc_cached_user';

// Try /auth/me a few times before giving up — handles cold-start servers
// (free hosting spins down and can take 20-40s to wake) and brief network drops.
async function fetchMeWithRetry(attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const { data } = await api.get('/auth/me', { timeout: 20000 });
      return { ok: true, user: data.data };
    } catch (e) {
      lastErr = e;
      // Genuine auth rejection (refresh token dead, confirmed by the interceptor) →
      // stop and show login. A 401 whose refresh only failed on the network is NOT
      // a real rejection — fall through to retry instead of logging the user out.
      if (e?._authRejected) return { ok: false, authRejected: true };
      // Network / timeout / 5xx / refresh-network-error → wait and retry.
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  return { ok: false, authRejected: false, error: lastErr };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  // True when a refresh token is stored — the user HAS a session even if we can't reach
  // the server right now. Lets the Gate show an "offline" screen instead of the login
  // form when the network is down (the #1 "app not working" complaint).
  const [sessionExists, setSessionExists] = useState(false);

  const boot = useCallback(async () => {
    setBooting(true);
    try {
      const refresh = await getRefresh();
      if (!refresh) { setSessionExists(false); setUser(null); setBooting(false); return; } // genuinely logged out
      setSessionExists(true); // token present → there is a session

      const res = await fetchMeWithRetry(3);
      if (res.ok) {
        setUser(res.user);
        // Cache the profile so a future flaky start can show the app instantly.
        SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(res.user)).catch(() => {});
      } else if (res.authRejected) {
        // Server said the session is invalid — tokens already cleared by the interceptor.
        await clearTokens();
        setSessionExists(false);
        setUser(null);
      } else {
        // Network/server hiccup — DON'T log out and DON'T show login. Show the app from
        // the cached profile if we have one; otherwise the Gate shows the offline screen
        // (sessionExists is true but user is null), never the login form.
        const cached = await SecureStore.getItemAsync(CACHED_USER_KEY).catch(() => null);
        if (cached) { try { setUser(JSON.parse(cached)); } catch { /* fall through */ } }
      }
    } catch { /* never crash boot */ }
    finally { setBooting(false); }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const handleAuth = async (p) => {
    await saveTokens(p.accessToken, p.refreshToken);
    setSessionExists(true);
    setUser(p.user);
    SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(p.user)).catch(() => {});
  };
  const login = useCallback(async (identifier, password) => { const { data } = await api.post('/auth/login', { identifier, password }); await handleAuth(data.data); }, []);
  const registerCompany = useCallback(async (form) => { const { data } = await api.post('/auth/register/company', form); await handleAuth(data.data); }, []);
  const registerJoin = useCallback(async (form) => { const { data } = await api.post('/auth/register/join', form); await handleAuth(data.data); }, []);
  const logout = useCallback(async () => {
    try { const r = await getRefresh(); if (r) await api.post('/auth/logout', { refreshToken: r }); } catch {}
    await clearTokens();
    await SecureStore.deleteItemAsync(CACHED_USER_KEY).catch(() => {});
    setSessionExists(false);
    setUser(null);
  }, []);
  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me', { timeout: 20000 });
      setUser(data.data);
      SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(data.data)).catch(() => {});
    } catch { /* keep current user on failure */ }
  }, []);
  const forgotPassword   = useCallback(async (mobile) => { const { data } = await api.post('/auth/forgot-password', { mobile }); return data; }, []);
  const resetPassword    = useCallback(async (mobile, otp, newPassword) => { const { data } = await api.post('/auth/reset-password', { mobile, otp, newPassword }); return data; }, []);

  // Security questions
  const sqListQuestions  = useCallback(async () => { const { data } = await api.get('/auth/security-questions/list'); return data.data; }, []);
  const sqSetup          = useCallback(async (mobile, answers) => { const { data } = await api.post('/auth/security-questions/setup', { mobile, answers }); return data; }, []);
  const sqCheck          = useCallback(async (mobile) => { const { data } = await api.post('/auth/security-questions/check', { mobile }); return data.data; }, []);
  const sqVerifyReset    = useCallback(async (mobile, question, answer, newPassword) => { const { data } = await api.post('/auth/security-questions/verify-reset', { mobile, question, answer, newPassword }); return data; }, []);

  return <AuthContext.Provider value={{ user, booting, sessionExists, reconnect: boot, login, registerCompany, registerJoin, logout, refreshMe, forgotPassword, resetPassword, sqListQuestions, sqSetup, sqCheck, sqVerifyReset }}>{children}</AuthContext.Provider>;
}
