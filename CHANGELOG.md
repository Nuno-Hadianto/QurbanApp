# Changelog

## [1.0.0] - 2026-05-26
### Added
- Aplikasi desktop offline QurbanApp berbasis Electron + Node.js + SQLite.
- Sistem login 3 role: Admin, Bendahara, Panitia.
- Dashboard statistik hewan, peserta, pembayaran.
- CRUD Data Hewan (termasuk upload foto base64).
- CRUD Peserta Kurban.
- Modul Patungan Sapi:
  - maksimal 7 slot
  - validasi anti-duplikat peserta
  - edit/hapus slot patungan
  - visual slot 1-7
- Modul Pembayaran:
  - input pembayaran cash/transfer
  - status lunas/belum lunas
  - hapus pembayaran
- Modul Laporan:
  - filter tanggal
  - tabel detail hewan/peserta/pembayaran
  - export PDF dan print
- Modul Pengaturan:
  - backup database
  - restore database (scheduled restore on restart)
  - ganti password
  - tampilan lokasi database aktif + copy path

### Security
- Password menggunakan hash `scrypt`.
- Session timeout 30 menit idle.
- Session auth untuk perubahan password dikunci di main process.

### Fixed
- Perbaikan path database untuk mode installer agar writable di user profile.
- Perbaikan penanganan error IPC agar notifikasi lebih konsisten.
- Perbaikan generate `kode_hewan` agar tidak bentrok setelah penghapusan data.

### Quality
- UAT end-to-end lulus penuh (GO-LIVE: GO).
