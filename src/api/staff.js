import api from './client';
export const getDirectory = () => api.get('/staff').then((r) => r.data.data);
