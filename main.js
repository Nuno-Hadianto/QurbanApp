const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./src/database/db');
const service = require('./src/database/service');

let mainWindow;
const authSessions = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/views/index.html'));
  const senderId = mainWindow.webContents.id;
  mainWindow.webContents.on('destroyed', () => {
    authSessions.delete(senderId);
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const safeHandle = (handler) => async (...args) => {
  try {
    return await handler(...args);
  } catch (error) {
    return { success: false, message: error?.message || 'Terjadi kesalahan sistem' };
  }
};

const secureHandle = (handler) => async (event, ...args) => {
  if (!authSessions.has(event.sender.id)) {
    return { success: false, message: 'Sesi tidak valid atau telah berakhir. Silakan login ulang.' };
  }
  try {
    return await handler(event, ...args);
  } catch (error) {
    return { success: false, message: error?.message || 'Terjadi kesalahan sistem' };
  }
};

ipcMain.handle('auth:login', safeHandle(async (event, payload) => {
  const res = service.login(payload);
  if (res?.success) authSessions.set(event.sender.id, res.data.id);
  return res;
}));
ipcMain.handle('auth:change-password', secureHandle(async (event, payload) => {
  const userId = authSessions.get(event.sender.id);
  return service.changePassword({
    userId,
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword
  });
}));
ipcMain.handle('auth:logout', async (event) => {
  authSessions.delete(event.sender.id);
  return { success: true };
});
ipcMain.handle('dashboard:stats', async () => service.getDashboardStats());

ipcMain.handle('hewan:list', async (_, q) => service.listHewan(q));
ipcMain.handle('hewan:create', secureHandle(async (_, payload) => service.createHewan(payload)));
ipcMain.handle('hewan:update', secureHandle(async (_, payload) => service.updateHewan(payload)));
ipcMain.handle('hewan:delete', secureHandle(async (_, id) => service.deleteHewan(id)));

ipcMain.handle('peserta:list', async (_, q) => service.listPeserta(q));
ipcMain.handle('peserta:create', secureHandle(async (_, payload) => service.createPeserta(payload)));
ipcMain.handle('peserta:update', secureHandle(async (_, payload) => service.updatePeserta(payload)));
ipcMain.handle('peserta:delete', secureHandle(async (_, id) => service.deletePeserta(id)));

ipcMain.handle('pembayaran:list', async () => service.listPembayaran());
ipcMain.handle('pembayaran:create', secureHandle(async (_, payload) => service.createPembayaran(payload)));
ipcMain.handle('pembayaran:delete', secureHandle(async (_, id) => service.deletePembayaran(id)));
ipcMain.handle('pembayaran:summary', async () => service.getPembayaranSummary());
ipcMain.handle('laporan:get', async (_, payload) => service.getLaporan(payload || {}));

ipcMain.handle('master:sapi', async () => service.listSapi());
ipcMain.handle('patungan:list', async (_, hewanId) => service.listPatunganByHewan(hewanId));
ipcMain.handle('patungan:add', secureHandle(async (_, payload) => service.addPatungan(payload)));
ipcMain.handle('patungan:update', secureHandle(async (_, payload) => service.updatePatungan(payload)));
ipcMain.handle('patungan:delete', secureHandle(async (_, id) => service.deletePatungan(id)));

ipcMain.handle('settings:backup', safeHandle(async () => {
  const result = await dialog.showSaveDialog({
    title: 'Backup Database',
    defaultPath: `qurbanapp-backup-${Date.now()}.db`,
    filters: [{ name: 'SQLite DB', extensions: ['db'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, message: 'Dibatalkan' };

  fs.copyFileSync(service.getDbPath(), result.filePath);
  return { success: true, message: 'Backup berhasil' };
}));

ipcMain.handle('settings:db-path', async () => {
  return { path: service.getDbPath() };
});

ipcMain.handle('settings:restore', safeHandle(async () => {
  const result = await dialog.showOpenDialog({
    title: 'Restore Database',
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) return { success: false, message: 'Dibatalkan' };

  fs.copyFileSync(result.filePaths[0], service.getPendingRestorePath());
  
  app.relaunch();
  app.exit(0);
}));
