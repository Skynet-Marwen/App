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
  delete: (id) => api.delete(`/visitors/${id}`),
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
  groups: (params) => api.get('/devices/groups', { params }),
  get: (id) => api.get(`/devices/${id}`),
  visitors: (id) => api.get(`/devices/${id}/visitors`),
  link: (deviceId, userId) => api.post(`/devices/${deviceId}/link`, { user_id: userId }),
  unlink: (deviceId) => api.delete(`/devices/${deviceId}/link`),
  block: (id, reason) => api.post(`/devices/${id}/block`, { reason }),
  unblock: (id) => api.delete(`/devices/${id}/block`),
  delete: (id) => api.delete(`/devices/${id}`),
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
  bootstrapStatus: () => api.get('/system/bootstrap-status'),
}

export const searchApi = {
  query: (params) => api.get('/search', { params }),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  getBlockPage: () => api.get('/settings/block-page'),
  updateBlockPage: (data) => api.put('/settings/block-page', data),
  listBackups: () => api.get('/settings/backups'),
  createBackup: (data) => api.post('/settings/backups', data),
  downloadBackup: (filename) => api.get(`/settings/backups/${filename}/download`, { responseType: 'blob' }),
  restoreBackup: (filename, data) => api.post(`/settings/backups/${filename}/restore`, data),
  restoreUploadedBackup: ({ file, mode, services, password }) => {
    const form = new FormData()
    form.append('file', file)
    form.append('mode', mode)
    form.append('services', services.join(','))
    form.append('password', password || '')
    return api.post('/settings/backups/restore-upload', form)
  },
  getHttpsStatus: () => api.get('/settings/https/status'),
  uploadHttpsCertificate: ({ certificate, privateKey, chain }) => {
    const form = new FormData()
    form.append('certificate', certificate)
    form.append('private_key', privateKey)
    if (chain) form.append('chain', chain)
    return api.post('/settings/https/upload', form)
  },
  generateSelfSignedCertificate: (data) => api.post('/settings/https/self-signed', data),
  // GeoIP
  geoipStatus: () => api.get('/settings/geoip/status'),
  uploadMmdb: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/settings/geoip/upload', form)
  },
  // SMTP
  updateSmtp: (data) => api.put('/settings/smtp', data),
  testSmtp: (data) => api.post('/settings/smtp/test', data),
}

// --- Themes ---
export const themesApi = {
  list: () => api.get('/themes'),
  create: (data) => api.post('/themes', data),
  update: (id, data) => api.put(`/themes/${id}`, data),
  delete: (id) => api.delete(`/themes/${id}`),
  setDefault: ({ theme_id }) => api.post('/themes/set-default', { theme_id }),
  starterPacks: () => api.get('/themes/starter-packs'),
  installStarterPack: (packId, data = {}) => api.post(`/themes/starter-packs/${packId}/install`, data),
  exportPackage: (id) => api.get(`/themes/${id}/export`, { responseType: 'blob' }),
  importPackage: ({ file, replaceExisting = false }) => {
    const form = new FormData()
    form.append('file', file)
    form.append('replace_existing', String(replaceExisting))
    return api.post('/themes/import', form)
  },
  uploadLogo: (id, file) => {
    const form = new FormData()
    form.append('logo', file)
    return api.post(`/themes/${id}/logo`, form)
  },
  removeLogo: (id) => api.delete(`/themes/${id}/logo`),
}

export const userThemeApi = {
  get: () => api.get('/user/theme'),
  set: (data) => api.post('/user/theme', data),
}

// --- Identity Intelligence ---
export const riskApi = {
  listUsers: (params) => api.get('/risk/users', { params }),
  recompute: (externalUserId) => api.post(`/risk/${externalUserId}/recompute`),
}

export const identityApi = {
  profile: (externalUserId) => api.get(`/identity/${externalUserId}/profile`),
  devices: (externalUserId) => api.get(`/identity/${externalUserId}/devices`),
  riskHistory: (externalUserId, params) => api.get(`/identity/${externalUserId}/risk-history`, { params }),
  activity: (externalUserId, params) => api.get(`/identity/${externalUserId}/activity`, { params }),
  flags: (externalUserId) => api.get(`/identity/${externalUserId}/flags`),
  updateFlag: (externalUserId, flagId, data) => api.put(`/identity/${externalUserId}/flags/${flagId}`, data),
  setEnhancedAudit: (externalUserId, data) => api.post(`/identity/${externalUserId}/enhanced-audit`, data),
  keycloakSyncStatus: () => api.get('/identity/sync/keycloak/status'),
  syncKeycloakUsers: () => api.post('/identity/sync/keycloak'),
}

export const gatewayApi = {
  status: () => api.get('/gateway/status'),
}

// --- Security Center ---
export const securityApi = {
  status: () => api.get('/security/status'),
  findings: () => api.get('/security/findings'),
  recommendations: () => api.get('/security/recommendations'),
  scan: (data) => api.post('/security/scan', data),
  ignoreFinding: (id) => api.post(`/security/findings/${id}/ignore`),
  applyRecommendation: (id) => api.post(`/security/recommendations/${id}/apply`),
}

// --- Audit ---
export const auditApi = {
  logs: (params) => api.get('/audit/logs', { params }),
}

export default api
