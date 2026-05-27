# 🐂 QurbanApp — Aplikasi Desktop Pendataan Kurban Luring

[![Platform - Windows](https://img.shields.io/badge/platform-Windows-blue.svg?style=flat-square)](https://www.microsoft.com/windows)
[![License - ISC](https://img.shields.io/badge/license-ISC-green.svg?style=flat-square)](./LICENSE)
[![Framework - Electron](https://img.shields.io/badge/framework-Electron-47848F.svg?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Database - SQLite](https://img.shields.io/badge/database-SQLite-003B57.svg?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![UI - Bootstrap 5](https://img.shields.io/badge/UI-Bootstrap%205-7952B3.svg?style=flat-square&logo=bootstrap)](https://getbootstrap.com/)

**QurbanApp** adalah aplikasi desktop offline (luring) yang dirancang khusus untuk mempermudah panitia kurban dalam melakukan pencatatan data hewan kurban, pendaftaran peserta kurban, manajemen patungan sapi, pencatatan riwayat pembayaran, hingga ekspor laporan lengkap dalam format PDF.

Aplikasi ini bekerja 100% tanpa memerlukan koneksi internet, sangat ringan untuk komputer berspesifikasi rendah, dan menyimpan data secara lokal di komputer panitia.

---

## ✨ Fitur Utama

*   **🖥️ Dashboard Statistik**: Statistik ringkas jumlah total hewan, total peserta, total dana terkumpul, proporsi jenis hewan kurban (grafik lingkaran interaktif), dan status hewan yang telah dipotong.
*   **🐂 CRUD Data Hewan Kurban**: Pengelolaan data kurban (Sapi & Kambing) secara lengkap beserta kode hewan otomatis (`HWN-xxx`), berat, harga, status (`tersedia`, `dipotong`, `selesai`), serta unggah foto hewan kurban fisik dengan pratinjau instan.
*   **👥 CRUD Peserta Kurban**: Pencatatan identitas warga yang berkurban (Nama, Alamat, No HP, Jenis Kurban) dengan validasi data masukan.
*   **🤝 Modul Patungan Sapi**: Visualisasi 7 slot patungan kurban sapi dengan aturan ketat:
    *   Maksimal 7 orang per sapi.
    *   Pencegahan pengisian slot ganda pada nomor slot yang sama.
    *   Pencegahan pendaftaran peserta yang sama lebih dari sekali pada sapi yang sama.
*   **💰 Modul Pembayaran**: Pengelolaan data cicilan/pelunasan pembayaran kurban secara luring lengkap dengan metode transaksi (Cash/Transfer) dan status pelunasan.
*   **📄 Laporan Lengkap & Ekspor PDF**: Modul penyaringan laporan berdasarkan rentang tanggal. Dokumen laporan dapat langsung dicetak (*print*) maupun diekspor menjadi dokumen PDF resmi yang memuat tabel lengkap Hewan, Peserta, dan Riwayat Pembayaran.
*   **⚙️ Sistem Pengaturan Mandiri**:
    *   **Backup Database**: Menyalin seluruh isi data program menjadi berkas `.db` cadangan di mana saja secara aman menggunakan SQLite Backup API.
    *   **Restore Database**: Pemulihan database cadangan secara otomatis pada saat aplikasi dimuat ulang (*relaunch*) dengan pembersihan log WAL untuk mencegah korup data.
    *   **Keamanan Sandi & Sesi**: Enkripsi sandi satu arah (`scrypt`), verifikasi sandi aman dari *timing attack*, dan otomatis keluar (*logout*) setelah 30 menit tidak ada aktivitas.

---

## 🛠️ Stack Teknologi

Aplikasi dibangun luring penuh menggunakan pustaka-pustaka populer berikut:
*   **Core Desktop Shell**: Electron v37 & Node.js
*   **Database Engine**: SQLite 3 (melalui driver `better-sqlite3` yang berjalan sinkron & berkinerja tinggi)
*   **Antarmuka Pengguna (UI)**: Bootstrap 5, Bootstrap Icons, & SweetAlert2 untuk notifikasi toast premium
*   **Visualisasi Grafik**: Chart.js
*   **Mesin Dokumen PDF**: jsPDF & jsPDF-AutoTable

---

## 🚀 Petunjuk Instalasi & Menjalankan Lokal

### Prasyarat:
*   [Node.js](https://nodejs.org/) (Sangat direkomendasikan versi LTS terbaru)
*   [Git](https://git-scm.com/)

### Langkah Langkah:

1.  **Clone Repositori**:
    ```bash
    git clone https://github.com/username/QurbanApp.git
    ```
2.  **Masuk ke Direktori Proyek**:
    ```bash
    cd QurbanApp
    ```
3.  **Pasang Dependensi**:
    ```bash
    npm install
    ```
4.  **Jalankan Aplikasi Mode Pengembangan**:
    ```bash
    npm start
    ```

> 🔐 **Kredensial Default**:
> Gunakan **Username**: `admin` dan **Password**: `admin` untuk masuk pertama kali ke sistem. Anda dapat mengubah kata sandi kapan saja melalui menu **Pengaturan**.

---

## 📦 Mengompilasi dan Membuat Installer (.EXE)

Aplikasi ini menggunakan **electron-builder** untuk mengemas program menjadi installer Windows mandiri yang siap digunakan tanpa memerlukan Node.js terpasang pada komputer target:

1.  **Bersihkan Build Sebelumnya**:
    ```bash
    npm run clean
    ```
2.  **Kompilasi Program & Buat Installer**:
    ```bash
    npm run build
    ```
    *Atau Anda dapat langsung menjalankan perintah kompilasi sekaligus:*
    ```bash
    npm run release
    ```
3.  Hasil kompilasi file instalasi desktop `.exe` akan tersimpan di dalam direktori `dist/` dengan nama berkas **`QurbanAppSetup.exe`**.

---

## 📁 Struktur Direktori Proyek

```text
QurbanApp/
├── build/                 # Aset icon program (.ico) untuk keperluan installer
├── dist/                  # Output file kompilasi installer desktop (diabaikan Git)
├── docs/                  # Dokumentasi panduan
├── src/
│   ├── assets/            # Gambar dan aset statis antarmuka
│   ├── css/
│   │   └── style.css      # Desain CSS kustom premium, layout, & glassmorphism
│   ├── database/
│   │   ├── db.js          # Inisialisasi DB, WAL schema, & restore engine
│   │   └── service.js     # Query SQL, enkripsi password, & logika bisnis program
│   ├── js/
│   │   └── app.js         # Logika event DOM, chart visual, & IPC bridge renderer
│   └── views/
│       └── index.html     # Layout antarmuka tunggal utama program (SPA)
├── main.js                # Lifecycle Electron process & IPC handlers database
├── preload.js             # IPC bridge contextBridge aman
├── package.json           # Dependensi program dan scripts build
└── LICENSE                # Lisensi penggunaan kode program (ISC)
```

---

## ⚖️ Lisensi

Proyek ini dilisensikan di bawah **ISC License** - Lihat file [LICENSE](./LICENSE) untuk detail hukum selengkapnya.
