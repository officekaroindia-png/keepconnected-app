import api from './client';
export const getLeaderboard = (year, month) => api.get(`/leaderboard${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data.data);
export const getAnnouncements = () => api.get('/announcements').then((r) => r.data.data);
export const postAnnouncement = (body, status) => api.post('/announcements', { body, status }).then((r) => r.data.data);
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`).then((r) => r.data);
export const getSettings = () => api.get('/settings').then((r) => r.data.data);
export const updateSettings = (body) => api.patch('/settings', body).then((r) => r.data.data);
export const getAppInfo = () => api.get('/app-info').then((r) => r.data.data);
