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

function getDashboardStats(tahun) {
  const totalHewan = db.prepare('SELECT COUNT(*) total FROM hewan WHERE tahun_kurban = ?').get(tahun).total;
  const totalPeserta = db.prepare('SELECT COUNT(*) total FROM peserta WHERE tahun_kurban = ?').get(tahun).total;
  const totalPembayaran = db.prepare('SELECT IFNULL(SUM(jumlah),0) total FROM pembayaran WHERE tahun_kurban = ?').get(tahun).total;
  const jumlahSapi = db.prepare("SELECT COUNT(*) total FROM hewan WHERE jenis_hewan = 'Sapi' AND tahun_kurban = ?").get(tahun).total;
  const jumlahKambing = db.prepare("SELECT COUNT(*) total FROM hewan WHERE jenis_hewan = 'Kambing' AND tahun_kurban = ?").get(tahun).total;
  const selesai = db.prepare("SELECT COUNT(*) total FROM hewan WHERE status = 'selesai' AND tahun_kurban = ?").get(tahun).total;
  return { totalHewan, totalPeserta, totalPembayaran, jumlahSapi, jumlahKambing, selesai };
}


function getHewanPhotoBase64(filename) {
  if (!filename) return '';
  const uploadDir = path.join(path.dirname(dbPath), 'uploads');
  const filepath = path.join(uploadDir, filename);
  if (fs.existsSync(filepath)) {
    try {
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      const base64 = fs.readFileSync(filepath, { encoding: 'base64' });
      return `data:${mime};base64,${base64}`;
    } catch (_) {
      return '';
    }
  }
  return '';
}

function listHewan(q = '', tahun) {
  const rows = db.prepare(`SELECT * FROM hewan
    WHERE (kode_hewan LIKE ? OR nama_hewan LIKE ? OR jenis_hewan LIKE ?) AND tahun_kurban = ?
    ORDER BY id DESC`).all(`%${q}%`, `%${q}%`, `%${q}%`, tahun);
  return rows.map(r => ({
    ...r,
    foto: getHewanPhotoBase64(r.foto)
  }));
}

function createHewan(payload) {
  const maxId = db.prepare('SELECT IFNULL(MAX(id), 0) maxId FROM hewan').get().maxId;
  const kode = `HWN-${String(Number(maxId) + 1).padStart(3, '0')}`;
  const filename = saveBase64Image(payload.foto || '');
  const stmt = db.prepare('INSERT INTO hewan (kode_hewan, jenis_hewan, nama_hewan, berat, harga, status, foto, created_at, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(kode, payload.jenis_hewan, payload.nama_hewan, payload.berat, payload.harga, payload.status, filename, now(), payload.tahun_kurban);
  return { success: true, message: 'Data hewan ditambahkan' };
}

function updateHewan(payload) {
  const oldRow = db.prepare('SELECT foto FROM hewan WHERE id = ?').get(payload.id);
  let filename = oldRow ? oldRow.foto : '';
  
  if (payload.foto) {
    if (payload.foto.startsWith('data:image/')) {
      const oldBase64 = oldRow && oldRow.foto ? getHewanPhotoBase64(oldRow.foto) : '';
      if (payload.foto !== oldBase64) {
        filename = saveBase64Image(payload.foto);
        if (oldRow && oldRow.foto) {
          const uploadDir = path.join(path.dirname(dbPath), 'uploads');
          const filepath = path.join(uploadDir, oldRow.foto);
          if (fs.existsSync(filepath)) {
            try { fs.unlinkSync(filepath); } catch (_) {}
          }
        }
      }
    } else {
      filename = payload.foto;
    }
  } else {
    filename = '';
    if (oldRow && oldRow.foto) {
      const uploadDir = path.join(path.dirname(dbPath), 'uploads');
      const filepath = path.join(uploadDir, oldRow.foto);
      if (fs.existsSync(filepath)) {
        try { fs.unlinkSync(filepath); } catch (_) {}
      }
    }
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
  const row = db.prepare('SELECT foto FROM hewan WHERE id = ?').get(id);
  if (row && row.foto) {
    const uploadDir = path.join(path.dirname(dbPath), 'uploads');
    const filepath = path.join(uploadDir, row.foto);
    if (fs.existsSync(filepath)) {
      try { fs.unlinkSync(filepath); } catch (_) {}
    }
  }
  db.prepare('DELETE FROM hewan WHERE id = ?').run(id);
  return { success: true, message: 'Data hewan dihapus' };
}

function listPeserta(q = '', tahun) {
  return db.prepare(`SELECT * FROM peserta WHERE (nama LIKE ? OR no_hp LIKE ? OR jenis_kurban LIKE ?) AND tahun_kurban = ? ORDER BY id DESC`).all(`%${q}%`, `%${q}%`, `%${q}%`, tahun);
}

function createPeserta(payload) {
  const createTransaction = db.transaction(() => {
    const stmt = db.prepare('INSERT INTO peserta (nama, alamat, no_hp, jenis_kurban, created_at, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)');
    const res = stmt.run(payload.nama, payload.alamat, payload.no_hp, payload.jenis_kurban, now(), payload.tahun_kurban);
    const pesertaId = res.lastInsertRowid;
    
    if (payload.jenis_kurban === 'Patungan Sapi' && payload.sapi_id && payload.slot_ke) {
      const resPatungan = addPatungan({
        hewan_id: payload.sapi_id,
        peserta_id: pesertaId,
        slot_ke: payload.slot_ke
      });
      if (!resPatungan.success) {
        throw new Error(resPatungan.message);
      }
    }
  });

  try {
    createTransaction();
    return { success: true, message: 'Peserta ditambahkan' };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal menambahkan peserta' };
  }
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

function listPembayaran(tahun) {
  return db.prepare(`SELECT p.*, ps.nama as nama_peserta, ps.alamat as alamat_peserta, ps.no_hp as no_hp_peserta, ps.jenis_kurban as jenis_kurban_peserta
    FROM pembayaran p JOIN peserta ps ON p.peserta_id = ps.id
    WHERE p.tahun_kurban = ?
    ORDER BY p.id DESC`).all(tahun);
}

function createPembayaran(payload) {
  if (!payload.peserta_id || !payload.jumlah) {
    return { success: false, message: 'Peserta atau jumlah pembayaran tidak boleh kosong' };
  }
  const existPeserta = db.prepare('SELECT id FROM peserta WHERE id = ?').get(payload.peserta_id);
  if (!existPeserta) return { success: false, message: 'Peserta tidak ditemukan' };

  db.prepare('INSERT INTO pembayaran (peserta_id, jumlah, metode, status, tanggal, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)')
    .run(payload.peserta_id, payload.jumlah, payload.metode, payload.status, payload.tanggal || now(), payload.tahun_kurban);
  return { success: true, message: 'Pembayaran ditambahkan' };
}

function deletePembayaran(id) {
  db.prepare('DELETE FROM pembayaran WHERE id = ?').run(id);
  return { success: true, message: 'Pembayaran dihapus' };
}

function getPembayaranSummary(tahun) {
  return {
    lunas: db.prepare("SELECT COUNT(*) total FROM pembayaran WHERE status = 'lunas' AND tahun_kurban = ?").get(tahun).total,
    belum: db.prepare("SELECT COUNT(*) total FROM pembayaran WHERE status = 'belum lunas' AND tahun_kurban = ?").get(tahun).total
  };
}

function listSapi(tahun) {
  return db.prepare("SELECT * FROM hewan WHERE jenis_hewan = 'Sapi' AND tahun_kurban = ? ORDER BY id DESC").all(tahun);
}

function listPatunganByHewan(hewanId) {
  return db.prepare(`SELECT pa.*, pe.nama as nama_peserta
    FROM patungan pa JOIN peserta pe ON pa.peserta_id = pe.id
    WHERE pa.hewan_id = ? ORDER BY pa.slot_ke ASC`).all(hewanId);
}

function addPatungan({ hewan_id, peserta_id, slot_ke }) {
  if (!hewan_id || !peserta_id || !slot_ke) {
    return { success: false, message: 'Data sapi, peserta, atau slot tidak boleh kosong' };
  }
  const existHewan = db.prepare('SELECT id FROM hewan WHERE id = ?').get(hewan_id);
  if (!existHewan) return { success: false, message: 'Hewan kurban tidak ditemukan' };
  const existPeserta = db.prepare('SELECT id FROM peserta WHERE id = ?').get(peserta_id);
  if (!existPeserta) return { success: false, message: 'Peserta tidak ditemukan' };

  const used = db.prepare('SELECT COUNT(*) total FROM patungan WHERE hewan_id = ?').get(hewan_id).total;
  if (used >= 7) return { success: false, message: 'Slot sapi sudah penuh (7 peserta)' };

  const existSlot = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND slot_ke = ?').get(hewan_id, slot_ke);
  if (existSlot) return { success: false, message: 'Slot sudah terisi' };
  const existPesertaInPatungan = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND peserta_id = ?').get(hewan_id, peserta_id);
  if (existPesertaInPatungan) return { success: false, message: 'Peserta sudah terdaftar di sapi ini' };

  db.prepare('INSERT INTO patungan (hewan_id, peserta_id, slot_ke, status) VALUES (?, ?, ?, ?)')
    .run(hewan_id, peserta_id, slot_ke, 'terisi');
  return { success: true, message: 'Peserta masuk patungan sapi' };
}

function updatePatungan({ id, hewan_id, peserta_id, slot_ke }) {
  if (!id || !hewan_id || !peserta_id || !slot_ke) {
    return { success: false, message: 'Data patungan tidak lengkap' };
  }
  const existHewan = db.prepare('SELECT id FROM hewan WHERE id = ?').get(hewan_id);
  if (!existHewan) return { success: false, message: 'Hewan kurban tidak ditemukan' };
  const existPeserta = db.prepare('SELECT id FROM peserta WHERE id = ?').get(peserta_id);
  if (!existPeserta) return { success: false, message: 'Peserta tidak ditemukan' };

  const row = db.prepare('SELECT * FROM patungan WHERE id = ?').get(id);
  if (!row) return { success: false, message: 'Data patungan tidak ditemukan' };

  const existSlot = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND slot_ke = ? AND id != ?').get(hewan_id, slot_ke, id);
  if (existSlot) return { success: false, message: 'Slot tujuan sudah terisi' };
  const existPesertaInPatungan = db.prepare('SELECT id FROM patungan WHERE hewan_id = ? AND peserta_id = ? AND id != ?').get(hewan_id, peserta_id, id);
  if (existPesertaInPatungan) return { success: false, message: 'Peserta sudah terdaftar di sapi ini' };

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

function getLaporan({ from, to, tahun }) {
  const fromIso = from ? `${from}T00:00:00.000Z` : null;
  const toIso = to ? `${to}T23:59:59.999Z` : null;
  const dateFilter = (field) => {
    if (fromIso && toIso) return `${field} BETWEEN ? AND ?`;
    if (fromIso) return `${field} >= ?`;
    if (toIso) return `${field} <= ?`;
    return '1=1';
  };
  const params = (field) => {
    const arr = [];
    if (fromIso && toIso) arr.push(fromIso, toIso);
    else if (fromIso) arr.push(fromIso);
    else if (toIso) arr.push(toIso);
    arr.push(tahun);
    return arr;
  };

  const hewan = db.prepare(`SELECT * FROM hewan WHERE ${dateFilter('created_at')} AND tahun_kurban = ? ORDER BY id DESC`).all(...params('created_at'));
  const peserta = db.prepare(`SELECT * FROM peserta WHERE ${dateFilter('created_at')} AND tahun_kurban = ? ORDER BY id DESC`).all(...params('created_at'));
  const pembayaran = db.prepare(`SELECT p.*, ps.nama as nama_peserta
    FROM pembayaran p JOIN peserta ps ON p.peserta_id = ps.id
    WHERE ${dateFilter('p.tanggal')} AND p.tahun_kurban = ? ORDER BY p.id DESC`).all(...params('p.tanggal'));

  return { hewan, peserta, pembayaran };
}

function importPesertaBatch(rows, tahun) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: 'Data kosong atau tidak valid' };
  }

  const insert = db.prepare('INSERT INTO peserta (nama, alamat, no_hp, jenis_kurban, created_at, tahun_kurban) VALUES (?, ?, ?, ?, ?, ?)');
  
  const insertTransaction = db.transaction((data) => {
    let imported = 0;
    for (const r of data) {
      if (!r.nama) continue;
      const alamat = r.alamat || '';
      const no_hp = r.no_hp || '';
      const jenis_kurban = r.jenis_kurban || 'Kambing Pribadi';
      
      insert.run(r.nama, alamat, no_hp, jenis_kurban, now(), tahun);
      imported++;
    }
    return imported;
  });

  try {
    const count = insertTransaction(rows);
    return { success: true, message: `${count} data peserta berhasil diimpor` };
  } catch (err) {
    return { success: false, message: `Gagal mengimpor data: ${err.message}` };
  }
}

function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  for (const r of rows) {
    settingsObj[r.key] = r.value;
  }
  return settingsObj;
}

function saveSettings(payload) {
  if (!payload || typeof payload !== 'object') {
    return { success: false, message: 'Data pengaturan tidak valid' };
  }

  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateTransaction = db.transaction((data) => {
    for (const [key, val] of Object.entries(data)) {
      stmt.run(key, String(val));
    }
  });

  try {
    updateTransaction(payload);
    return { success: true, message: 'Profil kuitansi berhasil diperbarui' };
  } catch (err) {
    return { success: false, message: `Gagal memperbarui profil: ${err.message}` };
  }
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
  getLaporan,
  importPesertaBatch,
  getSettings,
  saveSettings
};
