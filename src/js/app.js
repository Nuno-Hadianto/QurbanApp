const state = { user: null, hewan: [], peserta: [], pembayaran: [], laporan: { hewan: [], peserta: [], pembayaran: [] } };
let fotoHewanBase64 = '';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_TOUCH_THROTTLE_MS = 15000;
let sessionGuardStarted = false;
let lastSessionTouch = 0;

const qs = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(n || 0));

function toggleLoader(show) { qs('loader').classList.toggle('d-none', !show); }

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(type, msg) { 
  const icon = type === 'danger' ? 'error' : (type === 'warning' ? 'warning' : 'success');
  Toast.fire({ icon, title: msg }); 
}

let dashboardChart = null;

async function withLoad(fn) { try { toggleLoader(true); await fn(); } finally { toggleLoader(false); } }

function setSession(user) {
  state.user = user;
  sessionStorage.setItem('sessionUser', JSON.stringify(user));
  sessionStorage.setItem('sessionLastActive', String(Date.now()));
  qs('sessionUser').textContent = `${user.nama} (${user.role})`;
}

function restoreSession() {
  const s = sessionStorage.getItem('sessionUser');
  if (!s) return;
  const lastActive = Number(sessionStorage.getItem('sessionLastActive') || 0);
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
  const now = Date.now();
  if ((now - lastSessionTouch) < SESSION_TOUCH_THROTTLE_MS) return;
  lastSessionTouch = now;
  sessionStorage.setItem('sessionLastActive', String(Date.now()));
}

function clearSession(message) {
  sessionStorage.removeItem('sessionUser');
  sessionStorage.removeItem('sessionLastActive');
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
    const lastActive = Number(sessionStorage.getItem('sessionLastActive') || 0);
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
  const hasData = (s.jumlahSapi > 0 || s.jumlahKambing > 0);

  qs('dashboardSection').innerHTML = `
    <div class="row g-3 mb-4">
      ${card('Total Hewan', s.totalHewan, 'bi-box2-heart')}
      ${card('Total Peserta', s.totalPeserta, 'bi-people')}
      ${card('Total Pembayaran', rupiah(s.totalPembayaran), 'bi-cash-stack')}
      ${card('Jumlah Sapi', s.jumlahSapi, 'bi-circle')}
      ${card('Jumlah Kambing', s.jumlahKambing, 'bi-circle-fill')}
      ${card('Selesai Dipotong', s.selesai, 'bi-check2-circle')}
    </div>
    <div class="row">
      <div class="col-md-6 offset-md-3">
        <div class="card shadow-sm"><div class="card-body">
          <h6 class="card-title text-center">Proporsi Jenis Hewan</h6>
          <div style="height: 250px; position: relative;" class="d-flex align-items-center justify-content-center">
            ${hasData ? '<canvas id="hewanChart"></canvas>' : '<span class="text-muted small">Tidak ada data hewan kurban untuk menampilkan grafik</span>'}
          </div>
        </div></div>
      </div>
    </div>`;

  if (dashboardChart) dashboardChart.destroy();
  const ctx = qs('hewanChart');
  if (hasData && ctx && typeof Chart !== 'undefined') {
    dashboardChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sapi', 'Kambing'],
        datasets: [{
          data: [s.jumlahSapi, s.jumlahKambing],
          backgroundColor: ['#198754', '#ffc107']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function card(title, value, icon) {
  return `<div class="col-md-4"><div class="card card-stat shadow-sm"><div class="card-body d-flex justify-content-between"><div><small>${title}</small><h4>${value}</h4></div><i class="bi ${icon} fs-2 text-emerald"></i></div></div></div>`;
}

function renderHewan() {
  const rows = state.hewan.map((h, i) => {
    const imgHtml = h.foto 
      ? `<img src="${h.foto}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #dee2e6;" />` 
      : `<span class="text-muted small">No Photo</span>`;
    const badgeClass = h.status === 'tersedia' ? 'bg-success' : (h.status === 'dipotong' ? 'bg-warning' : 'bg-secondary');
    return `<tr>
      <td>${i + 1}</td>
      <td>${imgHtml}</td>
      <td>${h.kode_hewan}</td>
      <td>${h.jenis_hewan}</td>
      <td>${h.nama_hewan}</td>
      <td>${h.berat} kg</td>
      <td>${rupiah(h.harga)}</td>
      <td><span class="badge ${badgeClass}">${h.status}</span></td>
      <td><button class="btn btn-sm btn-warning btn-edit-hewan" data-id="${h.id}">Edit</button> <button class="btn btn-sm btn-danger btn-del-hewan" data-id="${h.id}">Hapus</button></td>
    </tr>`;
  }).join('');
  qs('hewanTable').innerHTML = `<thead><tr><th>#</th><th>Foto</th><th>Kode</th><th>Jenis</th><th>Nama</th><th>Berat</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

async function loadHewan(q = '') {
  state.hewan = await window.api.listHewan(q);
  renderHewan();
}

function editHewan(h) {
  qs('hewanId').value = h.id;
  qs('jenisHewan').value = h.jenis_hewan;
  qs('namaHewan').value = h.nama_hewan;
  qs('beratHewan').value = h.berat;
  qs('hargaHewan').value = h.harga;
  qs('statusHewan').value = h.status;
  fotoHewanBase64 = h.foto || '';

  const preview = qs('previewFotoHewan');
  if (fotoHewanBase64) {
    preview.src = fotoHewanBase64;
    preview.classList.remove('d-none');
  } else {
    preview.src = '';
    preview.classList.add('d-none');
  }
  qs('fotoHewan').value = '';

  new bootstrap.Modal(qs('hewanModal')).show();
}

async function hapusHewan(id) {
  if (!confirm('Yakin hapus data hewan ini?')) return;
  const res = await window.api.deleteHewan(id);
  if (!res?.success) return notify('danger', res?.message || 'Gagal hapus data hewan');
  notify('success', 'Data hewan dihapus');
  state.hewan = state.hewan.filter(h => h.id !== id);
  renderHewan();
  await loadDashboard();
}

function renderPeserta() {
  qs('pesertaPatunganSelect').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  if (qs('pembayaranPeserta')) qs('pembayaranPeserta').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  const rows = state.peserta.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${p.nama}</td><td>${p.alamat}</td><td>${p.no_hp}</td><td>${p.jenis_kurban}</td>
    <td><button class="btn btn-sm btn-warning btn-edit-peserta" data-id="${p.id}">Edit</button> <button class="btn btn-sm btn-danger btn-del-peserta" data-id="${p.id}">Hapus</button></td>
  </tr>`).join('');
  qs('pesertaTable').innerHTML = `<thead><tr><th>#</th><th>Nama</th><th>Alamat</th><th>No HP</th><th>Jenis Kurban</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

async function loadPeserta(q = '') {
  state.peserta = await window.api.listPeserta(q);
  renderPeserta();
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
  state.peserta = state.peserta.filter(p => p.id !== id);
  renderPeserta();
  await loadDashboard();
}

function renderPembayaran() {
  const rows = state.pembayaran.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${p.nama_peserta}</td><td>${rupiah(p.jumlah)}</td><td>${p.metode}</td><td>${p.status}</td><td>${new Date(p.tanggal).toLocaleString('id-ID')}</td>
    <td><button class="btn btn-sm btn-danger btn-del-pembayaran" data-id="${p.id}">Hapus</button></td>
  </tr>`).join('');
  qs('pembayaranTable').innerHTML = `<thead><tr><th>#</th><th>Peserta</th><th>Jumlah</th><th>Metode</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

async function loadPembayaran() {
  state.pembayaran = await window.api.listPembayaran();
  renderPembayaran();
}

async function setupPatungan() {
  qs('slotSelect').innerHTML = [1,2,3,4,5,6,7].map((s) => `<option value="${s}">Slot ${s}</option>`).join('');
  const sapi = await window.api.listSapi();
  qs('sapiSelect').innerHTML = sapi.map((s) => `<option value="${s.id}">${s.kode_hewan} - ${s.nama_hewan}</option>`).join('');
  resetPatunganForm();
  await renderPatunganTable();
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
  if (!hewanId) {
    qs('slotGrid').innerHTML = '<div class="col-12 text-muted text-center py-3">Pilih atau tambahkan hewan Sapi terlebih dahulu.</div>';
    qs('patunganTable').innerHTML = '<tbody><tr><td colspan="4" class="text-center text-muted">Tidak ada data patungan</td></tr></tbody>';
    return;
  }
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

async function copyTextSafe(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // Fallback below.
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
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
  qs('pembayaranTable').addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.id || 0);
    if (!id || !e.target.classList.contains('btn-del-pembayaran')) return;
    if (!confirm('Yakin hapus pembayaran ini?')) return;
    const res = await window.api.deletePembayaran(id);
    if (!res?.success) return notify('danger', res?.message || 'Gagal hapus pembayaran');
    notify('success', 'Pembayaran dihapus');
    state.pembayaran = state.pembayaran.filter(p => p.id !== id);
    renderPembayaran();
    await loadDashboard();
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
    const hewan_id = Number(qs('sapiSelect').value || 0);
    const peserta_id = Number(qs('pesertaPatunganSelect').value || 0);
    const slot_ke = Number(qs('slotSelect').value || 0);

    if (!hewan_id) {
      return notify('danger', 'Silakan pilih Sapi terlebih dahulu (tambahkan jika belum ada).');
    }
    if (!peserta_id) {
      return notify('danger', 'Silakan pilih Peserta terlebih dahulu (tambahkan jika belum ada).');
    }
    if (!slot_ke) {
      return notify('danger', 'Silakan pilih Slot terlebih dahulu.');
    }

    const payload = { hewan_id, peserta_id, slot_ke };
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
    const preview = qs('previewFotoHewan');
    if (!file) {
      preview.classList.add('d-none');
      preview.src = '';
      fotoHewanBase64 = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { 
      fotoHewanBase64 = reader.result; 
      preview.src = reader.result;
      preview.classList.remove('d-none');
    };
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
    const ok = await copyTextSafe(pathVal);
    notify(ok ? 'success' : 'warning', ok ? 'Path database disalin' : 'Gagal menyalin otomatis. Silakan copy manual dari kolom path.');
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
    
    doc.setFontSize(14);
    doc.text('Laporan QurbanApp', 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${from} s/d ${to}`, 14, 22);
    doc.text(`Hewan: ${state.laporan.hewan.length} | Peserta: ${state.laporan.peserta.length} | Total Bayar: ${rupiah(state.laporan.pembayaran.reduce((a,b)=>a+Number(b.jumlah),0))}`, 14, 28);

    doc.setFontSize(11);
    doc.text('Data Hewan:', 14, 38);
    const hewanBody = state.laporan.hewan.map((h, i) => [
      i + 1, h.kode_hewan, h.jenis_hewan, h.nama_hewan, `${h.berat} kg`, rupiah(h.harga), h.status
    ]);
    doc.autoTable({
      startY: 42,
      head: [['No', 'Kode', 'Jenis', 'Nama', 'Berat', 'Harga', 'Status']],
      body: hewanBody,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 135, 84] }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 260) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(11);
    doc.text('Data Peserta:', 14, finalY);
    const pesertaBody = state.laporan.peserta.map((p, i) => [
      i + 1, p.nama, p.alamat, p.no_hp, p.jenis_kurban, new Date(p.created_at).toLocaleDateString('id-ID')
    ]);
    doc.autoTable({
      startY: finalY + 4,
      head: [['No', 'Nama', 'Alamat', 'No HP', 'Jenis Kurban', 'Tanggal']],
      body: pesertaBody,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 135, 84] }
    });

    finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 260) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(11);
    doc.text('Data Pembayaran:', 14, finalY);
    const pembayaranBody = state.laporan.pembayaran.map((p, i) => [
      i + 1, p.nama_peserta, rupiah(p.jumlah), p.metode, p.status, new Date(p.tanggal).toLocaleDateString('id-ID')
    ]);
    doc.autoTable({
      startY: finalY + 4,
      head: [['No', 'Peserta', 'Jumlah', 'Metode', 'Status', 'Tanggal']],
      body: pembayaranBody,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 135, 84] }
    });

    doc.save('laporan-qurbanapp.pdf');
  });

  qs('filterLaporanBtn').addEventListener('click', loadLaporan);
  qs('resetLaporanBtn').addEventListener('click', async () => {
    qs('laporanFrom').value = '';
    qs('laporanTo').value = '';
    await loadLaporan();
  });

  qs('hewanModal').addEventListener('show.bs.modal', (e) => {
    if (e.relatedTarget) {
      qs('hewanForm').reset();
      qs('hewanId').value = '';
      fotoHewanBase64 = '';
      qs('previewFotoHewan').classList.add('d-none');
      qs('previewFotoHewan').src = '';
    }
  });
}

bindEvents();
restoreSession();
