import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { saveTokens, clearTokens, getRefresh } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => { (async () => {
    try { const r = await getRefresh(); if (r) { const { data } = await api.get('/auth/me'); setUser(data.data); } }
    catch {} finally { setBooting(false); }
  })(); }, []);

  const handleAuth = async (p) => { await saveTokens(p.accessToken, p.refreshToken); setUser(p.user); };
  const login = useCallback(async (identifier, password) => { const { data } = await api.post('/auth/login', { identifier, password }); await handleAuth(data.data); }, []);
  const registerCompany = useCallback(async (form) => { const { data } = await api.post('/auth/register/company', form); await handleAuth(data.data); }, []);
  const registerJoin = useCallback(async (form) => { const { data } = await api.post('/auth/register/join', form); await handleAuth(data.data); }, []);
  const logout = useCallback(async () => {
    try { const r = await getRefresh(); if (r) await api.post('/auth/logout', { refreshToken: r }); } catch {}
    await clearTokens(); setUser(null);
  }, []);
  const refreshMe = useCallback(async () => { try { const { data } = await api.get('/auth/me'); setUser(data.data); } catch {} }, []);

  return <AuthContext.Provider value={{ user, booting, login, registerCompany, registerJoin, logout, refreshMe }}>{children}</AuthContext.Provider>;
}
