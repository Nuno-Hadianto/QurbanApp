const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./src/database/db');
const service = require('./src/database/service');

let mainWindow;

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

ipcMain.handle('auth:login', async (_, payload) => service.login(payload));
ipcMain.handle('dashboard:stats', async () => service.getDashboardStats());

ipcMain.handle('hewan:list', async (_, q) => service.listHewan(q));
ipcMain.handle('hewan:create', async (_, payload) => service.createHewan(payload));
ipcMain.handle('hewan:update', async (_, payload) => service.updateHewan(payload));
ipcMain.handle('hewan:delete', async (_, id) => service.deleteHewan(id));

ipcMain.handle('peserta:list', async (_, q) => service.listPeserta(q));
ipcMain.handle('peserta:create', async (_, payload) => service.createPeserta(payload));
ipcMain.handle('peserta:update', async (_, payload) => service.updatePeserta(payload));
ipcMain.handle('peserta:delete', async (_, id) => service.deletePeserta(id));

ipcMain.handle('pembayaran:list', async () => service.listPembayaran());
ipcMain.handle('pembayaran:create', async (_, payload) => service.createPembayaran(payload));
ipcMain.handle('pembayaran:summary', async () => service.getPembayaranSummary());
ipcMain.handle('laporan:get', async (_, payload) => service.getLaporan(payload || {}));

ipcMain.handle('master:sapi', async () => service.listSapi());
ipcMain.handle('patungan:list', async (_, hewanId) => service.listPatunganByHewan(hewanId));
ipcMain.handle('patungan:add', async (_, payload) => service.addPatungan(payload));

ipcMain.handle('settings:backup', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Backup Database',
    defaultPath: `qurbanapp-backup-${Date.now()}.db`,
    filters: [{ name: 'SQLite DB', extensions: ['db'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, message: 'Dibatalkan' };

  fs.copyFileSync(service.getDbPath(), result.filePath);
  return { success: true, message: 'Backup berhasil' };
});

ipcMain.handle('settings:restore', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Restore Database',
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) return { success: false, message: 'Dibatalkan' };

  fs.copyFileSync(result.filePaths[0], service.getDbPath());
  return { success: true, message: 'Restore berhasil. Silakan restart aplikasi.' };
});
