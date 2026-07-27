import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://keepconnectedd.duckdns.org/api'; // set to your backend

const KEYS = { access: 'kc_access', refresh: 'kc_refresh' };
export const saveTokens = async (a, r) => { await SecureStore.setItemAsync(KEYS.access, a); if (r) await SecureStore.setItemAsync(KEYS.refresh, r); };
export const clearTokens = async () => { await SecureStore.deleteItemAsync(KEYS.access).catch(()=>{}); await SecureStore.deleteItemAsync(KEYS.refresh).catch(()=>{}); };
export const getRefresh = () => SecureStore.getItemAsync(KEYS.refresh);

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });
api.interceptors.request.use(async (cfg) => { const t = await SecureStore.getItemAsync(KEYS.access); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });

let refreshing = null;
api.interceptors.response.use((r) => r, async (error) => {
  const original = error.config;
  if (error.response?.status === 401 && !original._retry) {
    original._retry = true;
    try {
      if (!refreshing) refreshing = (async () => {
        const refresh = await getRefresh(); if (!refresh) throw new Error('no refresh');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        await SecureStore.setItemAsync(KEYS.access, data.data.accessToken); return data.data.accessToken;
      })();
      const nt = await refreshing; refreshing = null;
      original.headers.Authorization = `Bearer ${nt}`; return api(original);
    } catch (e) { refreshing = null; await clearTokens(); throw error; }
  }
  throw error;
});
export default api;
