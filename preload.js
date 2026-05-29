const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  changePassword: (payload) => ipcRenderer.invoke('auth:change-password', payload),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getDashboardStats: (tahun) => ipcRenderer.invoke('dashboard:stats', tahun),

  listHewan: (q, tahun) => ipcRenderer.invoke('hewan:list', q, tahun),
  createHewan: (payload) => ipcRenderer.invoke('hewan:create', payload),
  updateHewan: (payload) => ipcRenderer.invoke('hewan:update', payload),
  deleteHewan: (id) => ipcRenderer.invoke('hewan:delete', id),

  listPeserta: (q, tahun) => ipcRenderer.invoke('peserta:list', q, tahun),
  createPeserta: (payload) => ipcRenderer.invoke('peserta:create', payload),
  updatePeserta: (payload) => ipcRenderer.invoke('peserta:update', payload),
  deletePeserta: (id) => ipcRenderer.invoke('peserta:delete', id),
  importPesertaBatch: (rows, tahun) => ipcRenderer.invoke('peserta:import-batch', rows, tahun),

  listPembayaran: (tahun) => ipcRenderer.invoke('pembayaran:list', tahun),
  createPembayaran: (payload) => ipcRenderer.invoke('pembayaran:create', payload),
  deletePembayaran: (id) => ipcRenderer.invoke('pembayaran:delete', id),
  getPembayaranSummary: (tahun) => ipcRenderer.invoke('pembayaran:summary', tahun),
  getLaporan: (payload) => ipcRenderer.invoke('laporan:get', payload),

  listSapi: (tahun) => ipcRenderer.invoke('master:sapi', tahun),
  listPatunganByHewan: (hewanId) => ipcRenderer.invoke('patungan:list', hewanId),
  addPatungan: (payload) => ipcRenderer.invoke('patungan:add', payload),
  updatePatungan: (payload) => ipcRenderer.invoke('patungan:update', payload),
  deletePatungan: (id) => ipcRenderer.invoke('patungan:delete', id),

  backupDb: () => ipcRenderer.invoke('settings:backup'),
  restoreDb: () => ipcRenderer.invoke('settings:restore'),
  getDbPath: () => ipcRenderer.invoke('settings:db-path'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url)
});
