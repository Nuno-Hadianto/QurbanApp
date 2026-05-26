const { db, dbPath, restorePendingPath, initDatabase } = require('./db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
initDatabase();

const now = () => new Date().toISOString();

function saveBase64Image(base64Str) {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str;
  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return base64Str;
  
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  const uploadDir = path.join(path.dirname(dbPath), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  
  const filename = `hewan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, buffer);
  
  return filename;
}

function login({ username, password }) {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row) return { success: false, message: 'Username / password salah' };

  let valid = false;
  if (isHashedPassword(row.password)) {
    valid = verifyPassword(password, row.password);
  } else {
    valid = row.password === password;
    if (valid) {
      const hashed = hashPassword(password);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, row.id);
    }
  }

  if (!valid) return { success: false, message: 'Username / password salah' };
  return { success: true, data: { id: row.id, nama: row.nama, username: row.username, role: row.role } };
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  const [algo, salt, hash] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const hashVerify = crypto.scryptSync(plain, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'));
}

function isHashedPassword(v) {
  return String(v).startsWith('scrypt$');
}

function changePassword({ userId, currentPassword, newPassword }) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) return { success: false, message: 'User tidak ditemukan' };
  if (!newPassword || newPassword.length < 6) return { success: false, message: 'Password baru minimal 6 karakter' };

  const validCurrent = isHashedPassword(row.password)
    ? verifyPassword(currentPassword, row.password)
    : row.password === currentPassword;
  if (!validCurrent) return { success: false, message: 'Password saat ini salah' };

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), row.id);
  return { success: true, message: 'Password berhasil diperbarui' };
}

function getDashboardStats() {
  const totalHewan = db.prepare('SELECT COUNT(*) total FROM hewan').get().total;
  const totalPeserta = db.prepare('SELECT COUNT(*) total FROM peserta').get().total;
  const totalPembayaran = db.prepare('SELECT IFNULL(SUM(jumlah),0) total FROM pembayaran').get().total;
  const jumlahSapi = db.prepare("SELECT COUNT(*) total FROM hewan WHERE jenis_hewan = 'Sapi'").get().total;
  const jumlahKambing = db.prepare("SELECT COUNT(*) total FROM hewan WHERE jenis_hewan = 'Kambing'").get().total;
  const selesai = db.prepare("SELECT COUNT(*) total FROM hewan WHERE status = 'selesai'").get().total;
  return { totalHewan, totalPeserta, totalPembayaran, jumlahSapi, jumlahKambing, selesai };
}

function listHewan(q = '') {
  return db.prepare(`SELECT * FROM hewan
    WHERE kode_hewan LIKE ? OR nama_hewan LIKE ? OR jenis_hewan LIKE ?
    ORDER BY id DESC`).all(`%${q}%`, `%${q}%`, `%${q}%`);
}

function createHewan(payload) {
  const maxId = db.prepare('SELECT IFNULL(MAX(id), 0) maxId FROM hewan').get().maxId;
  const kode = `HWN-${String(Number(maxId) + 1).padStart(3, '0')}`;
  const filename = saveBase64Image(payload.foto || '');
  const stmt = db.prepare('INSERT INTO hewan (kode_hewan, jenis_hewan, nama_hewan, berat, harga, status, foto, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(kode, payload.jenis_hewan, payload.nama_hewan, payload.berat, payload.harga, payload.status, filename, now());
  return { success: true, message: 'Data hewan ditambahkan' };
}

function updateHewan(payload) {
  let filename = payload.foto || '';
  if (filename.startsWith('data:image/')) {
    filename = saveBase64Image(payload.foto);
  }
  const stmt = db.prepare('UPDATE hewan SET jenis_hewan = ?, nama_hewan = ?, berat = ?, harga = ?, status = ?, foto = ? WHERE id = ?');
  stmt.run(payload.jenis_hewan, payload.nama_hewan, payload.berat, payload.harga, payload.status, filename, payload.id);
  return { success: true, message: 'Data hewan diperbarui' };
}

function deleteHewan(id) {
  const usedInPatungan = db.prepare('SELECT COUNT(*) total FROM patungan WHERE hewan_id = ?').get(id).total;
  if (usedInPatungan > 0) {
    return { success: false, message: 'Hewan tidak bisa dihapus karena masih dipakai di data patungan.' };
  }
  db.prepare('DELETE FROM hewan WHERE id = ?').run(id);
  return { success: true, message: 'Data hewan dihapus' };
}

function listPeserta(q = '') {
  return db.prepare(`SELECT * FROM peserta WHERE nama LIKE ? OR no_hp LIKE ? OR jenis_kurban LIKE ? ORDER BY id DESC`).all(`%${q}%`, `%${q}%`, `%${q}%`);
}

function createPeserta(payload) {
  db.prepare('INSERT INTO peserta (nama, alamat, no_hp, jenis_kurban, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(payload.nama, payload.alamat, payload.no_hp, payload.jenis_kurban, now());
  return { success: true, message: 'Peserta ditambahkan' };
}

function updatePeserta(payload) {
  db.prepare('UPDATE peserta SET nama = ?, alamat = ?, no_hp = ?, jenis_kurban = ? WHERE id = ?')
    .run(payload.nama, payload.alamat, payload.no_hp, payload.jenis_kurban, payload.id);
  return { success: true, message: 'Peserta diperbarui' };
}

function deletePeserta(id) {
  const usedInPatungan = db.prepare('SELECT COUNT(*) total FROM patungan WHERE peserta_id = ?').get(id).total;
  if (usedInPatungan > 0) {
    return { success: false, message: 'Peserta tidak bisa dihapus karena masih terdaftar di patungan sapi.' };
  }
  const usedInPembayaran = db.prepare('SELECT COUNT(*) total FROM pembayaran WHERE peserta_id = ?').get(id).total;
  if (usedInPembayaran > 0) {
    return { success: false, message: 'Peserta tidak bisa dihapus karena masih memiliki riwayat pembayaran.' };
  }
  db.prepare('DELETE FROM peserta WHERE id = ?').run(id);
  return { success: true, message: 'Peserta dihapus' };
}

function listPembayaran() {
  return db.prepare(`SELECT p.*, ps.nama as nama_peserta
    FROM pembayaran p JOIN peserta ps ON p.peserta_id = ps.id
    ORDER BY p.id DESC`).all();
}

function createPembayaran(payload) {
  db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal) VALUES (?, ?, ?, ?, ?)')
    .run(payload.peserta_id, payload.jumlah, payload.metode, payload.status, payload.tanggal || now());
  return { success: true, message: 'Pembayaran ditambahkan' };
}

function deletePembayaran(id) {
  db.prepare('DELETE FROM pembayaran WHERE id = ?').run(id);
  return { success: true, message: 'Pembayaran dihapus' };
}

function getPembayaranSummary() {
  return {
    lunas: db.prepare("SELECT COUNT(*) total FROM pembayaran WHERE status = 'lunas'").get().total,
    belum: db.prepare("SELECT COUNT(*) total FROM pembayaran WHERE status = 'belum lunas'").get().total
  };
}

function listSapi() {
  return db.prepare("SELECT * FROM hewan WHERE jenis_hewan = 'Sapi' ORDER BY id DESC").all();
}

function listPatunganByHewan(hewanId) {
  return db.prepare(`SELECT pa.*, pe.nama as nama_peserta
    FROM patungan pa JOIN peserta pe ON pa.peserta_id = pe.id
    WHERE pa.hewan_id = ? ORDER BY pa.slot_ke ASC`).all(hewanId);
}

function addPatungan({ hewan_id, peserta_id, slot_ke }) {
  const used = db.prepare('SELECT COUNT(*) total FROM patungan WHERE hewan_id = ?').get(hewan_id).total;
  if (used >= 7) return { success: false, message: 'Slot sapi sudah penuh (7 peserta)' };

  const existSlot = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND slot_ke = ?').get(hewan_id, slot_ke);
  if (existSlot) return { success: false, message: 'Slot sudah terisi' };
  const existPeserta = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND peserta_id = ?').get(hewan_id, peserta_id);
  if (existPeserta) return { success: false, message: 'Peserta sudah terdaftar di sapi ini' };

  db.prepare('INSERT INTO patungan (hewan_id, peserta_id, slot_ke, status) VALUES (?, ?, ?, ?)')
    .run(hewan_id, peserta_id, slot_ke, 'terisi');
  return { success: true, message: 'Peserta masuk patungan sapi' };
}

function updatePatungan({ id, hewan_id, peserta_id, slot_ke }) {
  const row = db.prepare('SELECT * FROM patungan WHERE id = ?').get(id);
  if (!row) return { success: false, message: 'Data patungan tidak ditemukan' };

  const existSlot = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND slot_ke = ? AND id != ?').get(hewan_id, slot_ke, id);
  if (existSlot) return { success: false, message: 'Slot tujuan sudah terisi' };
  const existPeserta = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND peserta_id = ? AND id != ?').get(hewan_id, peserta_id, id);
  if (existPeserta) return { success: false, message: 'Peserta sudah terdaftar di sapi ini' };

  db.prepare('UPDATE patungan SET peserta_id = ?, slot_ke = ? WHERE id = ?').run(peserta_id, slot_ke, id);
  return { success: true, message: 'Data patungan diperbarui' };
}

function deletePatungan(id) {
  db.prepare('DELETE FROM patungan WHERE id = ?').run(id);
  return { success: true, message: 'Slot patungan dikosongkan' };
}

function getDbPath() {
  return dbPath;
}

function getPendingRestorePath() {
  return restorePendingPath;
}

function getLaporan({ from, to }) {
  const fromIso = from ? `${from}T00:00:00.000Z` : null;
  const toIso = to ? `${to}T23:59:59.999Z` : null;
  const dateFilter = (field) => {
    if (fromIso && toIso) return `${field} BETWEEN ? AND ?`;
    if (fromIso) return `${field} >= ?`;
    if (toIso) return `${field} <= ?`;
    return '1=1';
  };
  const params = (field) => {
    if (fromIso && toIso) return [fromIso, toIso];
    if (fromIso) return [fromIso];
    if (toIso) return [toIso];
    return [];
  };

  const hewan = db.prepare(`SELECT * FROM hewan WHERE ${dateFilter('created_at')} ORDER BY id DESC`).all(...params('created_at'));
  const peserta = db.prepare(`SELECT * FROM peserta WHERE ${dateFilter('created_at')} ORDER BY id DESC`).all(...params('created_at'));
  const pembayaran = db.prepare(`SELECT p.*, ps.nama as nama_peserta
    FROM pembayaran p JOIN peserta ps ON p.peserta_id = ps.id
    WHERE ${dateFilter('p.tanggal')} ORDER BY p.id DESC`).all(...params('p.tanggal'));

  return { hewan, peserta, pembayaran };
}

module.exports = {
  login,
  getDashboardStats,
  listHewan,
  createHewan,
  updateHewan,
  deleteHewan,
  listPeserta,
  createPeserta,
  updatePeserta,
  deletePeserta,
  listPembayaran,
  createPembayaran,
  deletePembayaran,
  getPembayaranSummary,
  listSapi,
  listPatunganByHewan,
  addPatungan,
  updatePatungan,
  deletePatungan,
  changePassword,
  getDbPath,
  getPendingRestorePath,
  getLaporan
};
