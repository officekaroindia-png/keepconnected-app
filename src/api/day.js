import api from './client';
export const getToday   = () => api.get('/day/today').then((r) => r.data.data);
// NOTE: the server replies 400 for "needs confirmation" cases (e.g. awayNeeded) and for
// validation messages. Axios rejects non-2xx, which would hide that body from the caller,
// so we unwrap the response data here and let the UI branch on res.success / res.awayNeeded.
export const doAction   = (type, lat, lng, address, useAway) =>
  api.post('/day/action', { type, lat, lng, address, useAway })
    .then((r) => r.data)
    .catch((e) => { if (e?.response?.data) return e.response.data; throw e; });
export const tapTask    = (id, lat, lng, address) => api.post(`/day/task/${id}`, { lat, lng, address }).then((r) => r.data);
export const getTimeline = (date) => api.get(`/day/timeline${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
export const myLeaves = (year, month) => api.get(`/day/leaves?year=${year}&month=${month}`).then((r) => r.data.data);
export const mySalary = (year, month) => api.get(`/day/salary${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data.data);
export const myAttendance = (year, month) => api.get(`/day/attendance${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data.data);
export const getWeather = () => api.get('/day/weather').then((r) => r.data.data);
// ---- Salary PIN (employee) ----
export const salaryPinStatus = () => api.get('/day/salary/pin').then((r) => r.data.data);
export const setSalaryPin    = (pin, currentPin) => api.post('/day/salary/pin', { pin, currentPin }).then((r) => r.data);
export const verifySalaryPin = (pin) => api.post('/day/salary/pin/verify', { pin }).then((r) => r.data);

// Same endpoint as setSalaryPin, but the server's rejection message ("current PIN
// is wrong") is handed back instead of thrown, so the Change PIN screen can show
// it inline. setSalaryPin is left untouched for the existing PIN modal.
export const changeSalaryPin = (pin, currentPin) =>
  api.post('/day/salary/pin', { pin, currentPin })
    .then((r) => r.data)
    .catch((e) => { if (e?.response?.data) return e.response.data; throw e; });

// Forgot the PIN — prove it is you with your login password, then pick a new PIN.
export const forgotSalaryPin = (password, pin) =>
  api.post('/day/salary/pin/forgot', { password, pin })
    .then((r) => r.data)
    .catch((e) => { if (e?.response?.data) return e.response.data; throw e; });

// Forgot the PIN — prove it with a security question answer, then pick a new PIN.
// GET /day/salary/pin/forgot-sq   → { question: '...' }
// POST /day/salary/pin/forgot-sq  → { success: true }
export const getSalaryPinQuestion = () =>
  api.get('/day/salary/pin/forgot-sq').then((r) => r.data.data);
export const forgotSalaryPinBySQ = (question, answer, pin) =>
  api.post('/day/salary/pin/forgot-sq', { question, answer, pin })
    .then((r) => r.data)
    .catch((e) => { if (e?.response?.data) return e.response.data; throw e; });

// ---- Colleagues (same company) ----
export const colleagueDirectory = () => api.get('/day/directory').then((r) => r.data.data);
export const colleagueTimeline  = (id, date) =>
  api.get(`/day/colleague/${id}/timeline${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
// ---- Self profile (change own mobile / name) ----
export const updateMyProfile = (body) => api.patch('/auth/profile', body).then((r) => r.data.data);
