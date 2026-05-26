# Release v1.0.0

Tanggal rilis: 2026-05-26
Status: GO-LIVE READY

## Artefak Distribusi
- Installer: `dist/QurbanAppSetup.exe`
- Blockmap: `dist/QurbanAppSetup.exe.blockmap`

## Requirement Target
- Windows 10/11 x64

## Ringkasan Fitur
- Login role-based (Admin/Bendahara/Panitia)
- Dashboard statistik kurban
- Data Hewan (CRUD)
- Peserta Kurban (CRUD)
- Patungan Sapi (7 slot, validasi, edit/hapus)
- Pembayaran (create/delete, status lunas/belum)
- Laporan (filter tanggal, PDF, print)
- Pengaturan (backup/restore DB, ganti password, DB path)

## Catatan Operasional
- Aplikasi full offline.
- Database aktif disimpan pada path user writable (lihat menu Pengaturan).
- Restore database diterapkan saat aplikasi restart.

## Verifikasi Pra-Distribusi
- UAT checklist: PASS seluruh skenario.
- Installer build: sukses.
