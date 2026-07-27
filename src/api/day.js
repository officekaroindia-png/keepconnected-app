import api from './client';
export const getToday   = () => api.get('/day/today').then((r) => r.data.data);
export const doAction   = (type, lat, lng, address) => api.post('/day/action', { type, lat, lng, address }).then((r) => r.data);
export const tapTask    = (id) => api.post(`/day/task/${id}`).then((r) => r.data);
export const getTimeline = (date) => api.get(`/day/timeline${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
