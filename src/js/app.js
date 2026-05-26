const state = { user: null, hewan: [], peserta: [], pembayaran: [] };

const qs = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(n || 0));

function toggleLoader(show) { qs('loader').classList.toggle('d-none', !show); }
function notify(type, msg) { qs('alertBox').innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${msg}<button class="btn-close" data-bs-dismiss="alert"></button></div>`; }

async function withLoad(fn) { try { toggleLoader(true); await fn(); } finally { toggleLoader(false); } }

function setSession(user) {
  state.user = user;
  localStorage.setItem('sessionUser', JSON.stringify(user));
  qs('sessionUser').textContent = `${user.nama} (${user.role})`;
}

function restoreSession() {
  const s = localStorage.getItem('sessionUser');
  if (!s) return;
  state.user = JSON.parse(s);
  qs('loginView').classList.add('d-none');
  qs('appView').classList.remove('d-none');
  qs('sessionUser').textContent = `${state.user.nama} (${state.user.role})`;
  initApp();
}

async function initApp() {
  await loadDashboard();
  await loadHewan();
  await loadPeserta();
  await loadPembayaran();
  await setupPatungan();
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
    <td><button class="btn btn-sm btn-warning" onclick='editHewan(${JSON.stringify(h)})'>Edit</button> <button class="btn btn-sm btn-danger" onclick='hapusHewan(${h.id})'>Hapus</button></td>
  </tr>`).join('');
  qs('hewanTable').innerHTML = `<thead><tr><th>#</th><th>Kode</th><th>Jenis</th><th>Nama</th><th>Berat</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

window.editHewan = (h) => {
  qs('hewanId').value = h.id;
  qs('jenisHewan').value = h.jenis_hewan;
  qs('namaHewan').value = h.nama_hewan;
  qs('beratHewan').value = h.berat;
  qs('hargaHewan').value = h.harga;
  qs('statusHewan').value = h.status;
  new bootstrap.Modal(qs('hewanModal')).show();
};

window.hapusHewan = async (id) => {
  if (!confirm('Yakin hapus data hewan ini?')) return;
  await window.api.deleteHewan(id);
  notify('success', 'Data hewan dihapus');
  await loadHewan();
  await loadDashboard();
};

async function loadPeserta(q = '') {
  state.peserta = await window.api.listPeserta(q);
  qs('pesertaPatunganSelect').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  qs('pembayaranPeserta').innerHTML = state.peserta.map((p) => `<option value="${p.id}">${p.nama}</option>`).join('');
  const rows = state.peserta.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${p.nama}</td><td>${p.alamat}</td><td>${p.no_hp}</td><td>${p.jenis_kurban}</td>
    <td><button class="btn btn-sm btn-warning" onclick='editPeserta(${JSON.stringify(p)})'>Edit</button> <button class="btn btn-sm btn-danger" onclick='hapusPeserta(${p.id})'>Hapus</button></td>
  </tr>`).join('');
  qs('pesertaTable').innerHTML = `<thead><tr><th>#</th><th>Nama</th><th>Alamat</th><th>No HP</th><th>Jenis Kurban</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>`;
}

window.editPeserta = (p) => {
  qs('pesertaId').value = p.id;
  qs('namaPeserta').value = p.nama;
  qs('alamatPeserta').value = p.alamat;
  qs('hpPeserta').value = p.no_hp;
  qs('jenisKurban').value = p.jenis_kurban;
  new bootstrap.Modal(qs('pesertaModal')).show();
};

window.hapusPeserta = async (id) => {
  if (!confirm('Yakin hapus data peserta ini?')) return;
  await window.api.deletePeserta(id);
  notify('success', 'Data peserta dihapus');
  await loadPeserta();
  await loadDashboard();
};

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
  if (sapi.length) await renderPatunganTable();
}

async function renderPatunganTable() {
  const hewanId = Number(qs('sapiSelect').value);
  if (!hewanId) return;
  const rowsData = await window.api.listPatunganByHewan(hewanId);
  const slotMap = Object.fromEntries(rowsData.map((r) => [r.slot_ke, r]));
  const rows = [1,2,3,4,5,6,7].map((s) => {
    const r = slotMap[s];
    return `<tr><td>${s}</td><td>${r ? r.nama_peserta : '-'}</td><td>${r ? 'terisi' : 'kosong'}</td></tr>`;
  }).join('');
  qs('patunganTable').innerHTML = `<thead><tr><th>Slot</th><th>Peserta</th><th>Status</th></tr></thead><tbody>${rows}</tbody>`;
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
  }));

  qs('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('sessionUser');
    location.reload();
  });

  qs('searchHewan').addEventListener('input', (e) => loadHewan(e.target.value));
  qs('searchPeserta').addEventListener('input', (e) => loadPeserta(e.target.value));

  qs('hewanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: Number(qs('hewanId').value || 0),
      jenis_hewan: qs('jenisHewan').value,
      nama_hewan: qs('namaHewan').value,
      berat: Number(qs('beratHewan').value),
      harga: Number(qs('hargaHewan').value),
      status: qs('statusHewan').value
    };
    if (payload.id) await window.api.updateHewan(payload); else await window.api.createHewan(payload);
    bootstrap.Modal.getInstance(qs('hewanModal')).hide();
    qs('hewanForm').reset(); qs('hewanId').value = '';
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
    if (payload.id) await window.api.updatePeserta(payload); else await window.api.createPeserta(payload);
    bootstrap.Modal.getInstance(qs('pesertaModal')).hide();
    qs('pesertaForm').reset(); qs('pesertaId').value = '';
    notify('success', 'Data peserta tersimpan');
    await loadPeserta(); await loadDashboard();
  });

  qs('pembayaranForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await window.api.createPembayaran({
      peserta_id: Number(qs('pembayaranPeserta').value),
      jumlah: Number(qs('jumlahBayar').value),
      metode: qs('metodeBayar').value,
      status: qs('statusBayar').value,
      tanggal: new Date().toISOString()
    });
    bootstrap.Modal.getInstance(qs('pembayaranModal')).hide();
    qs('pembayaranForm').reset();
    notify('success', 'Pembayaran berhasil ditambahkan');
    await loadPembayaran(); await loadDashboard();
  });

  qs('savePatunganBtn').addEventListener('click', async () => {
    const res = await window.api.addPatungan({
      hewan_id: Number(qs('sapiSelect').value),
      peserta_id: Number(qs('pesertaPatunganSelect').value),
      slot_ke: Number(qs('slotSelect').value)
    });
    notify(res.success ? 'success' : 'danger', res.message);
    await renderPatunganTable();
  });

  qs('sapiSelect').addEventListener('change', renderPatunganTable);

  qs('backupBtn').addEventListener('click', async () => {
    const res = await window.api.backupDb();
    notify(res.success ? 'success' : 'warning', res.message);
  });

  qs('restoreBtn').addEventListener('click', async () => {
    const res = await window.api.restoreDb();
    notify(res.success ? 'success' : 'warning', res.message);
  });

  qs('exportPdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Laporan QurbanApp', 14, 16);
    doc.text(`Total Hewan: ${state.hewan.length}`, 14, 26);
    doc.text(`Total Peserta: ${state.peserta.length}`, 14, 34);
    doc.text(`Total Pembayaran: ${rupiah(state.pembayaran.reduce((a,b)=>a+Number(b.jumlah),0))}`, 14, 42);
    doc.save('laporan-qurbanapp.pdf');
  });
}

bindEvents();
restoreSession();
