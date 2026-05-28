const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { db, initDatabase } = require('./src/database/db');
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

let isQuitting = false;
app.on('before-quit', async (event) => {
  if (isQuitting) return;
  event.preventDefault();

  try {
    const dbPath = service.getDbPath();
    const dbDir = path.dirname(dbPath);
    const backupsDir = path.join(dbDir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const backupName = `qurbanapp-autobackup-${yyyy}${mm}${dd}-${hh}${min}${ss}.db`;
    const backupPath = path.join(backupsDir, backupName);

    // Jalankan SQLite backup secara asinkron
    await db.backup(backupPath);

    // Pertahankan hanya 5 file backup otomatis terbaru
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('qurbanapp-autobackup-') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 5) {
      for (let i = 5; i < files.length; i++) {
        try {
          fs.unlinkSync(path.join(backupsDir, files[i].name));
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('Backup otomatis gagal:', err);
  } finally {
    isQuitting = true;
    app.quit();
  }
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
ipcMain.handle('peserta:import-batch', secureHandle(async (_, rows) => service.importPesertaBatch(rows)));

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

  await db.backup(result.filePath);
  return { success: true, message: 'Backup berhasil' };
}));

ipcMain.handle('settings:db-path', async () => {
  return { path: service.getDbPath() };
});
ipcMain.handle('settings:get', safeHandle(async () => service.getSettings()));
ipcMain.handle('settings:save', secureHandle(async (_, payload) => service.saveSettings(payload)));
ipcMain.handle('shell:open', async (_, url) => {
  await shell.openExternal(url);
  return { success: true };
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
