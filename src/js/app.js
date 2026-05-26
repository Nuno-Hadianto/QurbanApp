const state = { user: null, hewan: [], peserta: [], pembayaran: [], laporan: { hewan: [], peserta: [], pembayaran: [] } };
let fotoHewanBase64 = '';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let sessionGuardStarted = false;

const qs = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(n || 0));

function toggleLoader(show) { qs('loader').classList.toggle('d-none', !show); }
function notify(type, msg) { qs('alertBox').innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${msg}<button class="btn-close" data-bs-dismiss="alert"></button></div>`; }

async function withLoad(fn) { try { toggleLoader(true); await fn(); } finally { toggleLoader(false); } }

function setSession(user) {
  state.user = user;
  localStorage.setItem('sessionUser', JSON.stringify(user));
  localStorage.setItem('sessionLastActive', String(Date.now()));
  qs('sessionUser').textContent = `${user.nama} (${user.role})`;
}

function restoreSession() {
  const s = localStorage.getItem('sessionUser');
  if (!s) return;
  const lastActive = Number(localStorage.getItem('sessionLastActive') || 0);
  if (!lastActive || (Date.now() - lastActive) > SESSION_TIMEOUT_MS) {
    clearSession('Sesi berakhir karena tidak ada aktivitas. Silakan login ulang.');
    return;
  }
  state.user = JSON.parse(s);
  qs('loginView').classList.add('d-none');
  qs('appView').classList.remove('d-none');
  qs('sessionUser').textContent = `${state.user.nama} (${state.user.role})`;
  startSessionGuard();
  initApp();
}

function touchSession() {
  if (!state.user) return;
  localStorage.setItem('sessionLastActive', String(Date.now()));
}

function clearSession(message) {
  localStorage.removeItem('sessionUser');
  localStorage.removeItem('sessionLastActive');
  if (message) alert(message);
  location.reload();
}

function startSessionGuard() {
  if (sessionGuardStarted) return;
  sessionGuardStarted = true;
  ['click', 'keydown', 'mousemove'].forEach((evt) => {
    document.addEventListener(evt, touchSession, { passive: true });
  });
  setInterval(() => {
    const lastActive = Number(localStorage.getItem('sessionLastActive') || 0);
    if (state.user && lastActive && (Date.now() - lastActive) > SESSION_TIMEOUT_MS) {
      clearSession('Sesi berakhir karena timeout 30 menit.');
    }
  }, 60000);
}

async function initApp() {
  await loadDashboard();
  await loadHewan();
  await loadPeserta();
  await loadPembayaran();
  await setupPatungan();
  await loadLaporan();
  await loadDbPath();
}

async function loadDashboard() {
  const s = await window.api.getDashboardStats();
  qs('dashboardSection').innerHTML = `
    <div class="row g-3">
      ${card('Total Hewan', s.totalHewan, 'bi-box2-heart')}
      ${card('Total Peserta', s.totalPeserta, 'bi-people')}
      ${card('Total Pembayaran', rupiah(s.totalPembayaran), 'bi-cash-stack')}
      ${card('Jumlah Sapi', s.jumlahSapi, 'bi-circle')}
      ${card('Jumlah Kambing', s.jumlahKambing, 'bi-circle-fill')}
      ${card('Selesai Dipotong', s.selesai, 'bi-check2-circle')}
    </div>`;
}

function card(title, value, icon) {
  return `<div class="col-md-4"><div class="card card-stat shadow-sm"><div class="card-body d-flex justify-content-between"><div><small>${title}</small><h4>${value}</h4></div><i class="bi ${icon} fs-2 text-emerald"></i></div></div></div>`;
}

async function loadHewan(q = '') {
  state.hewan = await window.api.listHewan(q);
  const rows = state.hewan.map((h, i) => `<tr>
    <td>${i + 1}</td><td>${h.kode_hewan}</td><td>${h.jenis_hewan}</td><td>${h.nama_hewan}</td>
    <td>${h.berat} kg</td><td>${rupiah(h.harga)}</td><td>${h.status}</td>
    <td><button class="btn btn-sm btn-warning btn-edit-hewan" data-id="${h.id}">Edit</button> <button class="btn btn-sm btn-danger btn-del-hewan" data-id="${h.id}">Hapus</button></td>
  </tr>`).join('');
  qs('hewanTable').innerHTML = `<thead><tr><th>#</th><th>Kode</th><th>Jenis</th><th>Nama</th><th>Berat</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

function editHewan(h) {
  qs('hewanId').value = h.id;
  qs('jenisHewan').value = h.jenis_hewan;
  qs('namaHewan').value = h.nama_hewan;
  qs('beratHewan').value = h.berat;
  qs('hargaHewan').value = h.harga;
  qs('statusHewan').value = h.status;
  fotoHewanBase64 = h.foto || '';
  new bootstrap.Modal(qs('hewanModal')).show();
}

async function hapusHewan(id) {
  if (!confirm('Yakin hapus data hewan ini?')) return;
  const res = await window.api.deleteHewan(id);
  if (!res?.success) return notify('danger', res?.message || 'Gagal hapus data hewan');
  notify('success', 'Data hewan dihapus');
  await loadHewan();
  await loadDashboard();
}

async function loadPeserta(q = '') {
  state.peserta = await window.api.listPeserta(q);
  qs('pesertaPatunganSelect').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  qs('pembayaranPeserta').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  const rows = state.peserta.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${p.nama}</td><td>${p.alamat}</td><td>${p.no_hp}</td><td>${p.jenis_kurban}</td>
    <td><button class="btn btn-sm btn-warning btn-edit-peserta" data-id="${p.id}">Edit</button> <button class="btn btn-sm btn-danger btn-del-peserta" data-id="${p.id}">Hapus</button></td>
  </tr>`).join('');
  qs('pesertaTable').innerHTML = `<thead><tr><th>#</th><th>Nama</th><th>Alamat</th><th>No HP</th><th>Jenis Kurban</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

function editPeserta(p) {
  qs('pesertaId').value = p.id;
  qs('namaPeserta').value = p.nama;
  qs('alamatPeserta').value = p.alamat;
  qs('hpPeserta').value = p.no_hp;
  qs('jenisKurban').value = p.jenis_kurban;
  new bootstrap.Modal(qs('pesertaModal')).show();
}

async function hapusPeserta(id) {
  if (!confirm('Yakin hapus data peserta ini?')) return;
  const res = await window.api.deletePeserta(id);
  if (!res?.success) return notify('danger', res?.message || 'Gagal hapus data peserta');
  notify('success', 'Data peserta dihapus');
  await loadPeserta();
  await loadDashboard();
}

async function loadPembayaran() {
  state.pembayaran = await window.api.listPembayaran();
  const rows = state.pembayaran.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${p.nama_peserta}</td><td>${rupiah(p.jumlah)}</td><td>${p.metode}</td><td>${p.status}</td><td>${new Date(p.tanggal).toLocaleString('id-ID')}</td>
  </tr>`).join('');
  qs('pembayaranTable').innerHTML = `<thead><tr><th>#</th><th>Peserta</th><th>Jumlah</th><th>Metode</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>${rows}</tbody>`;
}

async function setupPatungan() {
  qs('slotSelect').innerHTML = [1,2,3,4,5,6,7].map((s) => `<option value="${s}">Slot ${s}</option>`).join('');
  const sapi = await window.api.listSapi();
  qs('sapiSelect').innerHTML = sapi.map((s) => `<option value="${s.id}">${s.kode_hewan} - ${s.nama_hewan}</option>`).join('');
  resetPatunganForm();
  if (sapi.length) await renderPatunganTable();
}

async function loadLaporan() {
  const payload = { from: qs('laporanFrom')?.value || '', to: qs('laporanTo')?.value || '' };
  state.laporan = await window.api.getLaporan(payload);

  const summary = [
    card('Hewan (Filter)', state.laporan.hewan.length, 'bi-box2-heart'),
    card('Peserta (Filter)', state.laporan.peserta.length, 'bi-people'),
    card('Total Bayar (Filter)', rupiah(state.laporan.pembayaran.reduce((a, b) => a + Number(b.jumlah || 0), 0)), 'bi-cash-stack')
  ].join('');
  qs('laporanSummary').innerHTML = summary;

  qs('laporanHewanTable').innerHTML = `<thead><tr><th>#</th><th>Kode</th><th>Jenis</th><th>Nama</th><th>Berat</th><th>Harga</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>${
    state.laporan.hewan.map((h, i) => `<tr><td>${i + 1}</td><td>${h.kode_hewan}</td><td>${h.jenis_hewan}</td><td>${h.nama_hewan}</td><td>${h.berat} kg</td><td>${rupiah(h.harga)}</td><td>${h.status}</td><td>${new Date(h.created_at).toLocaleDateString('id-ID')}</td></tr>`).join('')
  }</tbody>`;
  qs('laporanPesertaTable').innerHTML = `<thead><tr><th>#</th><th>Nama</th><th>Alamat</th><th>No HP</th><th>Jenis Kurban</th><th>Tanggal</th></tr></thead><tbody>${
    state.laporan.peserta.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nama}</td><td>${p.alamat}</td><td>${p.no_hp}</td><td>${p.jenis_kurban}</td><td>${new Date(p.created_at).toLocaleDateString('id-ID')}</td></tr>`).join('')
  }</tbody>`;
  qs('laporanPembayaranTable').innerHTML = `<thead><tr><th>#</th><th>Peserta</th><th>Jumlah</th><th>Metode</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>${
    state.laporan.pembayaran.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nama_peserta}</td><td>${rupiah(p.jumlah)}</td><td>${p.metode}</td><td>${p.status}</td><td>${new Date(p.tanggal).toLocaleString('id-ID')}</td></tr>`).join('')
  }</tbody>`;
}

async function renderPatunganTable() {
  const hewanId = Number(qs('sapiSelect').value);
  if (!hewanId) return;
  const rowsData = await window.api.listPatunganByHewan(hewanId);
  const slotMap = Object.fromEntries(rowsData.map((r) => [r.slot_ke, r]));
  qs('slotGrid').innerHTML = [1,2,3,4,5,6,7].map((s) => {
    const r = slotMap[s];
    return `<div class="col-md-3">
      <div class="slot-card ${r ? 'terisi' : 'kosong'}">
        <div class="d-flex justify-content-between">
          <strong>Slot ${s}</strong>
          <span class="badge ${r ? 'text-bg-success' : 'text-bg-secondary'}">${r ? 'Terisi' : 'Kosong'}</span>
        </div>
        <div class="mt-2 small">${r ? r.nama_peserta : '-'}</div>
      </div>
    </div>`;
  }).join('');
  const rows = [1,2,3,4,5,6,7].map((s) => {
    const r = slotMap[s];
    return `<tr>
      <td>${s}</td><td>${r ? r.nama_peserta : '-'}</td><td>${r ? 'terisi' : 'kosong'}</td>
      <td>${r ? `<button class="btn btn-sm btn-warning btn-edit-patungan" data-id="${r.id}" data-slot="${r.slot_ke}" data-peserta="${r.peserta_id}">Edit</button> <button class="btn btn-sm btn-danger btn-del-patungan" data-id="${r.id}">Hapus</button>` : '-'}</td>
    </tr>`;
  }).join('');
  qs('patunganTable').innerHTML = `<thead><tr><th>Slot</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

function resetPatunganForm() {
  qs('patunganId').value = '';
  qs('savePatunganBtn').textContent = 'Simpan';
  qs('cancelPatunganEditBtn').classList.add('d-none');
}

async function loadDbPath() {
  const res = await window.api.getDbPath();
  qs('dbPathInput').value = res?.path || '-';
}

function bindEvents() {
  qs('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withLoad(async () => {
      const res = await window.api.login({ username: qs('username').value, password: qs('password').value });
      if (!res.success) return notify('danger', res.message);
      setSession(res.data);
      qs('loginView').classList.add('d-none');
      qs('appView').classList.remove('d-none');
      startSessionGuard();
      notify('success', `Selamat datang, ${res.data.nama}`);
      await initApp();
    });
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    qs('pageTitle').textContent = btn.textContent.trim();
    document.querySelectorAll('.view-section').forEach((s) => s.classList.add('d-none'));
    qs(`${view}Section`).classList.remove('d-none');
    if (view === 'patungan') renderPatunganTable();
    if (view === 'laporan') loadLaporan();
  }));

  qs('logoutBtn').addEventListener('click', () => {
    window.api.logout().finally(() => clearSession());
  });

  qs('searchHewan').addEventListener('input', (e) => loadHewan(e.target.value));
  qs('searchPeserta').addEventListener('input', (e) => loadPeserta(e.target.value));
  qs('hewanTable').addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.id);
    if (!id) return;
    if (e.target.classList.contains('btn-edit-hewan')) editHewan(state.hewan.find((h) => h.id === id));
    if (e.target.classList.contains('btn-del-hewan')) await hapusHewan(id);
  });
  qs('pesertaTable').addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.id);
    if (!id) return;
    if (e.target.classList.contains('btn-edit-peserta')) editPeserta(state.peserta.find((p) => p.id === id));
    if (e.target.classList.contains('btn-del-peserta')) await hapusPeserta(id);
  });

  qs('hewanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: Number(qs('hewanId').value || 0),
      jenis_hewan: qs('jenisHewan').value,
      nama_hewan: qs('namaHewan').value,
      berat: Number(qs('beratHewan').value),
      harga: Number(qs('hargaHewan').value),
      status: qs('statusHewan').value,
      foto: fotoHewanBase64
    };
    const res = payload.id ? await window.api.updateHewan(payload) : await window.api.createHewan(payload);
    if (!res?.success) return notify('danger', res?.message || 'Gagal menyimpan data hewan');
    bootstrap.Modal.getInstance(qs('hewanModal')).hide();
    qs('hewanForm').reset(); qs('hewanId').value = ''; fotoHewanBase64 = '';
    notify('success', 'Data hewan tersimpan');
    await loadHewan(); await loadDashboard(); await setupPatungan();
  });

  qs('pesertaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: Number(qs('pesertaId').value || 0),
      nama: qs('namaPeserta').value,
      alamat: qs('alamatPeserta').value,
      no_hp: qs('hpPeserta').value,
      jenis_kurban: qs('jenisKurban').value
    };
    const res = payload.id ? await window.api.updatePeserta(payload) : await window.api.createPeserta(payload);
    if (!res?.success) return notify('danger', res?.message || 'Gagal menyimpan data peserta');
    bootstrap.Modal.getInstance(qs('pesertaModal')).hide();
    qs('pesertaForm').reset(); qs('pesertaId').value = '';
    notify('success', 'Data peserta tersimpan');
    await loadPeserta(); await loadDashboard();
  });

  qs('pembayaranForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await window.api.createPembayaran({
      peserta_id: Number(qs('pembayaranPeserta').value),
      jumlah: Number(qs('jumlahBayar').value),
      metode: qs('metodeBayar').value,
      status: qs('statusBayar').value,
      tanggal: new Date().toISOString()
    });
    if (!res?.success) return notify('danger', res?.message || 'Gagal menambah pembayaran');
    bootstrap.Modal.getInstance(qs('pembayaranModal')).hide();
    qs('pembayaranForm').reset();
    notify('success', 'Pembayaran berhasil ditambahkan');
    await loadPembayaran(); await loadDashboard();
  });

  qs('savePatunganBtn').addEventListener('click', async () => {
    const id = Number(qs('patunganId').value || 0);
    const payload = {
      hewan_id: Number(qs('sapiSelect').value),
      peserta_id: Number(qs('pesertaPatunganSelect').value),
      slot_ke: Number(qs('slotSelect').value)
    };
    const res = id ? await window.api.updatePatungan({ ...payload, id }) : await window.api.addPatungan(payload);
    notify(res.success ? 'success' : 'danger', res.message);
    if (res.success) resetPatunganForm();
    await renderPatunganTable();
  });

  qs('cancelPatunganEditBtn').addEventListener('click', () => resetPatunganForm());
  qs('sapiSelect').addEventListener('change', async () => {
    resetPatunganForm();
    await renderPatunganTable();
  });
  qs('patunganTable').addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.id || 0);
    if (!id) return;
    if (e.target.classList.contains('btn-edit-patungan')) {
      qs('patunganId').value = id;
      qs('slotSelect').value = e.target.dataset.slot;
      qs('pesertaPatunganSelect').value = e.target.dataset.peserta;
      qs('savePatunganBtn').textContent = 'Update Slot';
      qs('cancelPatunganEditBtn').classList.remove('d-none');
      return;
    }
    if (e.target.classList.contains('btn-del-patungan')) {
      if (!confirm('Yakin kosongkan slot ini?')) return;
      const res = await window.api.deletePatungan(id);
      notify(res.success ? 'success' : 'danger', res.message);
      resetPatunganForm();
      await renderPatunganTable();
    }
  });
  qs('fotoHewan').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { fotoHewanBase64 = reader.result; };
    reader.readAsDataURL(file);
  });

  qs('backupBtn').addEventListener('click', async () => {
    const res = await window.api.backupDb();
    notify(res.success ? 'success' : 'warning', res.message);
  });

  qs('restoreBtn').addEventListener('click', async () => {
    const res = await window.api.restoreDb();
    notify(res.success ? 'success' : 'warning', res.message);
  });
  qs('copyDbPathBtn').addEventListener('click', async () => {
    const pathVal = qs('dbPathInput').value;
    if (!pathVal || pathVal === '-') return;
    await navigator.clipboard.writeText(pathVal);
    notify('success', 'Path database disalin');
  });

  qs('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = qs('currentPassword').value;
    const newPassword = qs('newPassword').value;
    const confirmPassword = qs('confirmPassword').value;
    if (newPassword !== confirmPassword) {
      notify('danger', 'Konfirmasi password baru tidak cocok');
      return;
    }
    const res = await window.api.changePassword({ currentPassword, newPassword });
    notify(res.success ? 'success' : 'danger', res.message);
    if (res.success) qs('changePasswordForm').reset();
  });

  qs('exportPdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const from = qs('laporanFrom').value || '-';
    const to = qs('laporanTo').value || '-';
    let y = 16;
    doc.text('Laporan QurbanApp', 14, y); y += 8;
    doc.text(`Periode: ${from} s/d ${to}`, 14, y); y += 8;
    doc.text(`Hewan: ${state.laporan.hewan.length} | Peserta: ${state.laporan.peserta.length} | Total Bayar: ${rupiah(state.laporan.pembayaran.reduce((a,b)=>a+Number(b.jumlah),0))}`, 14, y); y += 10;

    doc.text('Data Hewan:', 14, y); y += 6;
    state.laporan.hewan.slice(0, 20).forEach((h, i) => {
      doc.text(`${i + 1}. ${h.kode_hewan} | ${h.jenis_hewan} | ${h.nama_hewan} | ${h.status}`, 14, y);
      y += 6;
    });
    if (y > 250) { doc.addPage(); y = 20; }
    doc.text('Data Pembayaran:', 14, y); y += 6;
    state.laporan.pembayaran.slice(0, 20).forEach((p, i) => {
      doc.text(`${i + 1}. ${p.nama_peserta} | ${rupiah(p.jumlah)} | ${p.metode} | ${p.status}`, 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save('laporan-qurbanapp.pdf');
  });

  qs('filterLaporanBtn').addEventListener('click', loadLaporan);
  qs('resetLaporanBtn').addEventListener('click', async () => {
    qs('laporanFrom').value = '';
    qs('laporanTo').value = '';
    await loadLaporan();
  });
}

bindEvents();
restoreSession();
