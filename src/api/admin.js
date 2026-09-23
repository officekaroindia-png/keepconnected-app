import api from './client';
export const staffStatus    = (date) => api.get(`/admin/staff${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
export const staffDashboard = (id, year, month) => api.get(`/admin/staff/${id}/dashboard${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data.data);
export const staffTimeline  = (id, date) => api.get(`/admin/staff/${id}/timeline${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
export const setSelfService = (id, body) => api.patch(`/admin/staff/${id}/self-service`, body).then((r) => r.data);
export const staffAction    = (id, kind, date) => api.post(`/admin/staff/${id}/action`, { kind, date }).then((r) => r.data);
export const editEventTime  = (id, which, date, time) => api.patch(`/admin/staff/${id}/event`, { which, date, time }).then((r) => r.data);
export const staffTasks    = (id, date) => api.get(`/admin/staff/${id}/tasks${date ? `?date=${date}` : ''}`).then((r) => r.data.data);
export const pendingTasks  = (id) => api.get(`/admin/staff/${id}/pending`).then((r) => r.data.data);
export const approveTasks  = (id, date) => api.post(`/admin/staff/${id}/tasks/approve`, { date }).then((r) => r.data);
export const declineTasks  = (id, date) => api.post(`/admin/staff/${id}/tasks/decline`, { date }).then((r) => r.data);
// ---- Salaries ----
export const listSalaries  = (year, month) => api.get(`/admin/salaries${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data.data);
export const getSalary     = (id, year, month) => api.get(`/admin/salaries/${id}${year ? `?year=${year}&month=${month}` : ''}`).then((r) => r.data);
export const setSalary     = (id, salary, allowedPaidLeaves) => api.put(`/admin/salaries/${id}`, { salary, allowedPaidLeaves }).then((r) => r.data);
export const setSalaryOverride = (id, year, month, amount, excusedLeaves, note) => api.put(`/admin/salaries/${id}/override`, { year, month, amount, excusedLeaves, note }).then((r) => r.data);
export const grantSalaryAccess  = (id, adminId) => api.post(`/admin/salaries/${id}/grant`, { adminId }).then((r) => r.data);
export const revokeSalaryAccess = (id, adminId) => api.post(`/admin/salaries/${id}/revoke`, { adminId }).then((r) => r.data);
export const listSalaryAdmins   = () => api.get('/admin/salaries/admins').then((r) => r.data.data);
// ---- Away check-ins ----
export const listAwayCheckins    = () => api.get('/admin/away-checkins').then((r) => r.data.data);
export const staffAwayHistory    = (id) => api.get(`/admin/staff/${id}/away-history`).then((r) => r.data.data);
export const setAwayCheckins     = (id, perMonth, unlimited) => api.patch(`/admin/staff/${id}/away-checkins`, { perMonth, unlimited }).then((r) => r.data);
export const setBulkAwayCheckins = (userIds, perMonth, unlimited) => api.post('/admin/bulk-away-checkins', { userIds, perMonth, unlimited }).then((r) => r.data);
export const listTasks   = () => api.get('/admin/tasks').then((r) => r.data.data);
export const createTask  = (body) => api.post('/admin/tasks', body).then((r) => r.data);
export const updateTask  = (id, body) => api.patch(`/admin/tasks/${id}`, body).then((r) => r.data);
export const deleteTask  = (id) => api.delete(`/admin/tasks/${id}`).then((r) => r.data);
export const setStaffRole  = (id, role) => api.patch(`/admin/staff/${id}/role`, { role }).then((r) => r.data);
export const resetStaffPassword = (id, newPassword) => api.patch(`/admin/staff/${id}/reset-password`, { newPassword }).then((r) => r.data);
export const setStaffMobile = (id, mobile) => api.patch(`/admin/staff/${id}/mobile`, { mobile }).then((r) => r.data);
// ---- Check-in spots ----
export const listCheckinSpots = () => api.get('/admin/checkin-spots').then((r) => r.data.data);
export const createCheckinSpot = (spot) => api.post('/admin/checkin-spots', spot).then((r) => r.data);
export const updateCheckinSpot = (id, spot) => api.patch(`/admin/checkin-spots/${id}`, spot).then((r) => r.data);
export const deleteCheckinSpot = (id) => api.delete(`/admin/checkin-spots/${id}`).then((r) => r.data);
export const setCheckinSpotEmployees = (id, employeeIds) => api.patch(`/admin/checkin-spots/${id}/employees`, { employeeIds }).then((r) => r.data);
export const listCustomActions = () => api.get('/admin/custom-actions').then((r) => r.data.data);
export const addCustomAction   = (body) => api.post('/admin/custom-actions', body).then((r) => r.data);
export const updateCustomAction = (key, body) => api.patch(`/admin/custom-actions/${key}`, body).then((r) => r.data);
export const deleteCustomAction = (key) => api.delete(`/admin/custom-actions/${key}`).then((r) => r.data);
export const setOvertime = (id, overtime, date) => api.patch(`/admin/staff/${id}/overtime`, { overtime, date }).then((r) => r.data);
export const approveWFH = (id, date, approved) => api.patch(`/admin/staff/${id}/wfh-approve`, { date, approved }).then((r) => r.data);
export const staffLeaves = (id, year, month) => api.get(`/admin/staff/${id}/leaves?year=${year}&month=${month}`).then((r) => r.data.data);
export const setCompulsoryLocation = (id, loc) => api.patch(`/admin/staff/${id}/compulsory-location`, loc).then((r) => r.data);
export const setBulkCompulsoryLocation = (userIds, location) => api.post('/admin/bulk-compulsory-location', { userIds, location }).then((r) => r.data);
// Per-employee shift override. Pass null on any field to reset that field to the company default.
export const setStaffShift = (id, shiftStartMinute, shiftEndMinute, graceMinutes) =>
  api.patch(`/admin/staff/${id}/shift`, { shiftStartMinute, shiftEndMinute, graceMinutes }).then((r) => r.data);
export const setBulkStaffShift = (userIds, shiftStartMinute, shiftEndMinute, graceMinutes) =>
  api.post('/admin/bulk-shift', { userIds, shiftStartMinute, shiftEndMinute, graceMinutes }).then((r) => r.data);
// ---- Offsite Authorization ----
export const setOffsiteAuth = (id) => api.post(`/admin/staff/${id}/offsite-auth`).then((r) => r.data);
