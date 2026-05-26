# UAT Checklist QurbanApp v1.0

## Info Uji
- Tanggal Uji: __________
- Tester: __________
- Versi App: __________
- OS: __________
- Build: `dist/QurbanAppSetup.exe`

Status: `PASS` | `FAIL` | `BLOCKED`

---

## A. Instalasi & Startup
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| A1 | Install aplikasi | Jalankan installer `QurbanAppSetup.exe` | Install sukses tanpa error |  |  |
| A2 | Startup app | Buka aplikasi dari desktop/start menu | App terbuka normal ke halaman login |  |  |
| A3 | DB path aktif | Masuk > Pengaturan lihat "Lokasi Database Aktif" | Path tampil dan mengarah ke folder writable user |  |  |

## B. Login & Session
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| B1 | Login admin valid | Login `admin/admin123` | Login sukses, masuk dashboard |  |  |
| B2 | Login invalid | Masukkan password salah | Muncul notifikasi gagal login |  |  |
| B3 | Logout | Klik tombol logout | Kembali ke halaman login |  |  |
| B4 | Session timeout | Diamkan app > 30 menit tanpa aktivitas | Auto logout + pesan timeout |  |  |

## C. Dashboard
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| C1 | Statistik tampil | Buka menu Dashboard | Semua card statistik tampil |  |  |
| C2 | Statistik update realtime | Tambah data hewan/peserta/pembayaran | Nilai card ikut berubah |  |  |

## D. Data Hewan
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| D1 | Tambah hewan sapi | Isi form hewan valid lalu simpan | Data tersimpan, muncul di tabel |  |  |
| D2 | Tambah hewan kambing | Isi form hewan valid lalu simpan | Data tersimpan, muncul di tabel |  |  |
| D3 | Kode hewan otomatis | Tambah beberapa data | `kode_hewan` terbentuk otomatis dan unik |  |  |
| D4 | Edit hewan | Klik edit lalu ubah data | Perubahan tersimpan |  |  |
| D5 | Hapus hewan | Klik hapus + konfirmasi | Data terhapus dari tabel |  |  |
| D6 | Search hewan | Isi kolom cari hewan | Tabel terfilter sesuai keyword |  |  |
| D7 | Upload foto | Pilih file foto di form | Data tersimpan tanpa error |  |  |

## E. Peserta Kurban
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| E1 | Tambah peserta | Isi form valid lalu simpan | Data peserta tersimpan |  |  |
| E2 | Edit peserta | Ubah data peserta | Data berubah di tabel |  |  |
| E3 | Hapus peserta | Hapus + konfirmasi | Data terhapus |  |  |
| E4 | Cari peserta | Isi kolom pencarian | Tabel terfilter |  |  |

## F. Patungan Sapi
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| F1 | Tambah slot patungan | Pilih sapi, peserta, slot lalu simpan | Slot menjadi terisi |  |  |
| F2 | Max 7 peserta | Isi slot 1-7 lalu coba tambah lagi | Ditolak dengan pesan slot penuh |  |  |
| F3 | Cegah duplikat peserta | Peserta sama ditambahkan ke sapi yang sama | Ditolak dengan notifikasi |  |  |
| F4 | Edit slot | Klik edit slot lalu ubah slot/peserta | Data patungan terupdate |  |  |
| F5 | Hapus slot | Klik hapus slot + konfirmasi | Slot kembali kosong |  |  |
| F6 | Visual slot | Lihat grid slot 1-7 | Status Terisi/Kosong akurat |  |  |

## G. Pembayaran
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| G1 | Input pembayaran cash | Tambah pembayaran metode cash | Data tersimpan di riwayat |  |  |
| G2 | Input pembayaran transfer | Tambah pembayaran metode transfer | Data tersimpan di riwayat |  |  |
| G3 | Status lunas/belum lunas | Input 2 status berbeda | Status tampil benar di tabel |  |  |

## H. Laporan
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| H1 | Laporan default | Buka menu laporan tanpa filter | Tabel hewan/peserta/pembayaran tampil |  |  |
| H2 | Filter tanggal | Isi dari/sampai lalu terapkan | Data terfilter sesuai periode |  |  |
| H3 | Reset filter | Klik reset | Filter kosong + data kembali normal |  |  |
| H4 | Export PDF | Klik export PDF | File PDF terbentuk tanpa error |  |  |
| H5 | Print | Klik print | Dialog print muncul |  |  |

## I. Pengaturan
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| I1 | Backup DB | Klik backup dan simpan file | File backup `.db` tersimpan |  |  |
| I2 | Restore DB | Klik restore, pilih backup | Muncul pesan restore dijadwalkan |  |  |
| I3 | Apply restore | Tutup-buka app setelah restore | Data sesuai isi backup |  |  |
| I4 | Ganti password sukses | Isi password lama + password baru valid | Password berubah, notifikasi sukses |  |  |
| I5 | Ganti password gagal | Isi password lama salah | Ditolak dengan notifikasi |  |  |
| I6 | Copy DB path | Klik tombol copy path | Path tersalin / ada fallback message |  |  |

## J. Data Persistensi Offline
| ID | Skenario | Langkah Uji | Expected Result | Status | Catatan |
|---|---|---|---|---|---|
| J1 | Persist setelah restart | Tambah data, tutup app, buka lagi | Data tetap ada |  |  |
| J2 | Offline penuh | Putus internet lalu gunakan app | Semua fitur inti tetap berjalan |  |  |

---

## Kriteria Go-Live v1.0
- Semua test kritikal (`A`, `B`, `D`, `E`, `F`, `G`, `I`) status `PASS`.
- Tidak ada bug `High`/`Critical` tersisa.
- Installer dapat dipasang dan dibuka di minimal 1 mesin uji.

## Ringkasan Hasil UAT
- Total Case: 42
- PASS: 42
- FAIL: 0
- BLOCKED: 0
- Keputusan: `GO`
