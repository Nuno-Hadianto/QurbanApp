const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  listHewan: (q) => ipcRenderer.invoke('hewan:list', q),
  createHewan: (payload) => ipcRenderer.invoke('hewan:create', payload),
  updateHewan: (payload) => ipcRenderer.invoke('hewan:update', payload),
  deleteHewan: (id) => ipcRenderer.invoke('hewan:delete', id),

  listPeserta: (q) => ipcRenderer.invoke('peserta:list', q),
  createPeserta: (payload) => ipcRenderer.invoke('peserta:create', payload),
  updatePeserta: (payload) => ipcRenderer.invoke('peserta:update', payload),
  deletePeserta: (id) => ipcRenderer.invoke('peserta:delete', id),

  listPembayaran: () => ipcRenderer.invoke('pembayaran:list'),
  createPembayaran: (payload) => ipcRenderer.invoke('pembayaran:create', payload),
  getPembayaranSummary: () => ipcRenderer.invoke('pembayaran:summary'),
  getLaporan: (payload) => ipcRenderer.invoke('laporan:get', payload),

  listSapi: () => ipcRenderer.invoke('master:sapi'),
  listPatunganByHewan: (hewanId) => ipcRenderer.invoke('patungan:list', hewanId),
  addPatungan: (payload) => ipcRenderer.invoke('patungan:add', payload),

  backupDb: () => ipcRenderer.invoke('settings:backup'),
  restoreDb: () => ipcRenderer.invoke('settings:restore')
});
