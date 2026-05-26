const { db, dbPath } = require('./db');

const now = () => new Date().toISOString();

function login({ username, password }) {
  const user = db.prepare('SELECT id, nama, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) return { success: false, message: 'Username / password salah' };
  return { success: true, data: user };
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
  const count = db.prepare('SELECT COUNT(*) total FROM hewan').get().total + 1;
  const kode = `HWN-${String(count).padStart(3, '0')}`;
  const stmt = db.prepare('INSERT INTO hewan (kode_hewan, jenis_hewan, nama_hewan, berat, harga, status, foto, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(kode, payload.jenis_hewan, payload.nama_hewan, payload.berat, payload.harga, payload.status, payload.foto || '', now());
  return { success: true, message: 'Data hewan ditambahkan' };
}

function updateHewan(payload) {
  const stmt = db.prepare('UPDATE hewan SET jenis_hewan = ?, nama_hewan = ?, berat = ?, harga = ?, status = ?, foto = ? WHERE id = ?');
  stmt.run(payload.jenis_hewan, payload.nama_hewan, payload.berat, payload.harga, payload.status, payload.foto || '', payload.id);
  return { success: true, message: 'Data hewan diperbarui' };
}

function deleteHewan(id) {
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

  db.prepare('INSERT INTO patungan (hewan_id, peserta_id, slot_ke, status) VALUES (?, ?, ?, ?)')
    .run(hewan_id, peserta_id, slot_ke, 'terisi');
  return { success: true, message: 'Peserta masuk patungan sapi' };
}

function getDbPath() {
  return dbPath;
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
  getPembayaranSummary,
  listSapi,
  listPatunganByHewan,
  addPatungan,
  getDbPath
};
