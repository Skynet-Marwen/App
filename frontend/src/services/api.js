import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skynet_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('skynet_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// --- Auth ---
export const authApi = {
  login: (credentials) => {
    const form = new URLSearchParams()
    form.append('username', credentials.username)
    form.append('password', credentials.password)
    return api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  },
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

// --- Overview / Stats ---
export const statsApi = {
  overview: (range = '24h') => api.get(`/stats/overview?range=${range}`),
  realtime: () => api.get('/stats/realtime'),
}

// --- Visitors ---
export const visitorsApi = {
  list: (params) => api.get('/visitors', { params }),
  get: (id) => api.get(`/visitors/${id}`),
  block: (id, reason) => api.post(`/visitors/${id}/block`, { reason }),
  unblock: (id) => api.delete(`/visitors/${id}/block`),
}

// --- Users ---
export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  block: (id, reason) => api.post(`/users/${id}/block`, { reason }),
  unblock: (id) => api.delete(`/users/${id}/block`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  sessions: (id) => api.get(`/users/${id}/sessions`),
  revokeSession: (id, sessionId) => api.delete(`/users/${id}/sessions/${sessionId}`),
}

// --- Devices ---
export const devicesApi = {
  list: (params) => api.get('/devices', { params }),
  get: (id) => api.get(`/devices/${id}`),
  link: (deviceId, userId) => api.post(`/devices/${deviceId}/link`, { user_id: userId }),
  unlink: (deviceId) => api.delete(`/devices/${deviceId}/link`),
  block: (id, reason) => api.post(`/devices/${id}/block`, { reason }),
  unblock: (id) => api.delete(`/devices/${id}/block`),
}

// --- Blocking ---
export const blockingApi = {
  rules: (params) => api.get('/blocking/rules', { params }),
  createRule: (data) => api.post('/blocking/rules', data),
  deleteRule: (id) => api.delete(`/blocking/rules/${id}`),
  ipList: (params) => api.get('/blocking/ips', { params }),
  blockIp: (ip, reason) => api.post('/blocking/ips', { ip, reason }),
  unblockIp: (ip) => api.delete(`/blocking/ips/${ip}`),
}

// --- Anti-Evasion ---
export const antiEvasionApi = {
  config: () => api.get('/anti-evasion/config'),
  updateConfig: (data) => api.put('/anti-evasion/config', data),
  incidents: (params) => api.get('/anti-evasion/incidents', { params }),
  resolveIncident: (id) => api.post(`/anti-evasion/incidents/${id}/resolve`),
}

// --- Integration ---
export const integrationApi = {
  sites: () => api.get('/integration/sites'),
  createSite: (data) => api.post('/integration/sites', data),
  deleteSite: (id) => api.delete(`/integration/sites/${id}`),
  regenerateKey: (id) => api.post(`/integration/sites/${id}/regenerate-key`),
  trackerScript: (siteId) => api.get(`/integration/tracker-script?site_id=${siteId}`),
}

// --- System ---
export const systemApi = {
  info: () => api.get('/system/info'),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  keycloak: () => api.get('/settings/keycloak'),
  updateKeycloak: (data) => api.put('/settings/keycloak', data),
}

export default api
