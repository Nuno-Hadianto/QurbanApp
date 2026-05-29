const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function resolveDbPath() {
  const explicit = process.env.QURBANAPP_DB_PATH;
  if (explicit) return explicit;

  const appDataBase = process.env.APPDATA || path.join(os.homedir(), '.config');
  const appDataDir = path.join(appDataBase, 'QurbanApp');
  if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true });
  return path.join(appDataDir, 'qurbanapp.db');
}

const dbPath = resolveDbPath();
const restorePendingPath = `${dbPath}.restore`;

function isValidSqliteFile(filePath) {
  try {
    const testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    testDb.prepare('PRAGMA schema_version').get();
    testDb.close();
    return true;
  } catch (_) {
    return false;
  }
}

function applyPendingRestoreIfExists() {
  if (!fs.existsSync(restorePendingPath)) return;
  if (!isValidSqliteFile(restorePendingPath)) {
    fs.unlinkSync(restorePendingPath);
    return;
  }
  
  // Hapus file pendamping WAL jika ada sebelum menyalin file baru
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  if (fs.existsSync(walPath)) {
    try { fs.unlinkSync(walPath); } catch (_) {}
  }
  if (fs.existsSync(shmPath)) {
    try { fs.unlinkSync(shmPath); } catch (_) {}
  }

  fs.copyFileSync(restorePendingPath, dbPath);
  fs.unlinkSync(restorePendingPath);
}

applyPendingRestoreIfExists();
const db = new Database(dbPath);

function initDatabase() {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hewan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_hewan TEXT UNIQUE NOT NULL,
      jenis_hewan TEXT NOT NULL,
      nama_hewan TEXT NOT NULL,
      berat REAL NOT NULL,
      harga REAL NOT NULL,
      status TEXT NOT NULL,
      foto TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS peserta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      alamat TEXT NOT NULL,
      no_hp TEXT NOT NULL,
      jenis_kurban TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patungan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hewan_id INTEGER NOT NULL,
      peserta_id INTEGER NOT NULL,
      slot_ke INTEGER NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (hewan_id) REFERENCES hewan(id),
      FOREIGN KEY (peserta_id) REFERENCES peserta(id)
    );

    CREATE TABLE IF NOT EXISTS pembayaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peserta_id INTEGER NOT NULL,
      jumlah REAL NOT NULL,
      metode TEXT NOT NULL,
      status TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      FOREIGN KEY (peserta_id) REFERENCES peserta(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrasi kolom tahun_kurban jika belum ada
  try {
    db.prepare("SELECT tahun_kurban FROM hewan LIMIT 1").get();
  } catch (_) {
    db.exec("ALTER TABLE hewan ADD COLUMN tahun_kurban TEXT DEFAULT '1447 H / 2026 M'");
  }
  try {
    db.prepare("SELECT tahun_kurban FROM peserta LIMIT 1").get();
  } catch (_) {
    db.exec("ALTER TABLE peserta ADD COLUMN tahun_kurban TEXT DEFAULT '1447 H / 2026 M'");
  }
  try {
    db.prepare("SELECT tahun_kurban FROM pembayaran LIMIT 1").get();
  } catch (_) {
    db.exec("ALTER TABLE pembayaran ADD COLUMN tahun_kurban TEXT DEFAULT '1447 H / 2026 M'");
  }

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('nama_organisasi', 'PANITIA KURBAN')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('alamat_organisasi', 'Aplikasi Pendataan Kurban Mandiri - QurbanApp')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('tahun_kurban_list', '1447 H / 2026 M,1448 H / 2027 M,1449 H / 2028 M')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('tahun_kurban_aktif', '1447 H / 2026 M')").run();

  seedData();
}

function seedData() {
  const c = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
  if (c > 0) return;

  const now = new Date().toISOString();
  const hashPassword = (plain) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  };

  const seedTransaction = db.transaction(() => {
    const insertUser = db.prepare('INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)');
    insertUser.run('Admin Qurban', 'admin', hashPassword('admin'), 'Admin');

    const insertHewan = db.prepare('INSERT INTO hewan (kode_hewan, jenis_hewan, nama_hewan, berat, harga, status, foto, created_at, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertHewan.run('HWN-001', 'Sapi', 'Sapi Limosin A', 420, 31000000, 'tersedia', '', now, '1447 H / 2026 M');
    insertHewan.run('HWN-002', 'Kambing', 'Kambing Etawa B', 35, 4200000, 'dipotong', '', now, '1447 H / 2026 M');

    const insertPeserta = db.prepare('INSERT INTO peserta (nama, alamat, no_hp, jenis_kurban, created_at, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)');
    const p1 = insertPeserta.run('Ahmad Fauzi', 'Jl. Melati 5', '081234567890', 'Patungan Sapi', now, '1447 H / 2026 M').lastInsertRowid;
    const p2 = insertPeserta.run('Budi Santoso', 'Jl. Mawar 2', '081298765432', 'Kambing Pribadi', now, '1447 H / 2026 M').lastInsertRowid;

    db.prepare('INSERT INTO patungan (hewan_id, peserta_id, slot_ke, status) VALUES (?, ?, ?, ?)').run(1, p1, 1, 'terisi');
    db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)').run(p1, 2500000, 'transfer', 'belum lunas', now, '1447 H / 2026 M');
    db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)').run(p2, 4200000, 'cash', 'lunas', now, '1447 H / 2026 M');
  });
  
  seedTransaction();
}

module.exports = { db, dbPath, restorePendingPath, initDatabase };
