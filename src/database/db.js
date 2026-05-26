const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'qurbanapp.db');
const db = new Database(dbPath);

function initDatabase() {
  db.pragma('journal_mode = WAL');

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
  `);

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

  const insertUser = db.prepare('INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)');
  insertUser.run('Admin Qurban', 'admin', hashPassword('admin123'), 'Admin');
  insertUser.run('Bendahara Qurban', 'bendahara', hashPassword('bendahara123'), 'Bendahara');
  insertUser.run('Panitia Qurban', 'panitia', hashPassword('panitia123'), 'Panitia');

  const insertHewan = db.prepare('INSERT INTO hewan (kode_hewan, jenis_hewan, nama_hewan, berat, harga, status, foto, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertHewan.run('HWN-001', 'Sapi', 'Sapi Limosin A', 420, 31000000, 'tersedia', '', now);
  insertHewan.run('HWN-002', 'Kambing', 'Kambing Etawa B', 35, 4200000, 'dipotong', '', now);

  const insertPeserta = db.prepare('INSERT INTO peserta (nama, alamat, no_hp, jenis_kurban, created_at) VALUES (?, ?, ?, ?, ?)');
  const p1 = insertPeserta.run('Ahmad Fauzi', 'Jl. Melati 5', '081234567890', 'Patungan Sapi', now).lastInsertRowid;
  const p2 = insertPeserta.run('Budi Santoso', 'Jl. Mawar 2', '081298765432', 'Kambing Pribadi', now).lastInsertRowid;

  db.prepare('INSERT INTO patungan (hewan_id, peserta_id, slot_ke, status) VALUES (?, ?, ?, ?)').run(1, p1, 1, 'terisi');
  db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal) VALUES (?, ?, ?, ?, ?)').run(p1, 2500000, 'transfer', 'belum lunas', now);
  db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal) VALUES (?, ?, ?, ?, ?)').run(p2, 4200000, 'cash', 'lunas', now);
}

module.exports = { db, dbPath, initDatabase };
