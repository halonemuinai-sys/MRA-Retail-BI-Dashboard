# 📈 Dokumentasi Modul Forecasting & Proyeksi

Modul ini adalah mesin kecerdasan bisnis yang dirancang untuk memberikan estimasi performa penjualan akhir bulan (**Month-End**) dan akhir tahun (**Year-End**) secara akurat bagi ekosistem retail Bvlgari.

## 🌟 Fitur Utama

### 1. Filter Bulanan Dinamis
Sistem kini mendukung pemilihan bulan secara manual.
*   **Otomatis:** Mendeteksi bulan berjalan berdasarkan data terbaru.
*   **Manual:** Memungkinkan pengguna meninjau performa historis bulan-bulan sebelumnya.
*   **Logika Cerdas:** Jika bulan yang dipilih sudah lewat, sistem secara otomatis mengunci perhitungan pada hari terakhir bulan tersebut untuk menampilkan angka aktual akhir.

### 2. Analisis Skenario (Down, Mid, Up)
Manajemen dapat melihat rentang potensi hasil akhir bulan untuk perencanaan yang lebih konservatif atau agresif:
*   **Realistic (Mid):** Proyeksi standar berdasarkan laju jual (*run rate*) saat ini.
*   **Pessimistic (Down):** Estimasi batas bawah (85% dari performa saat ini). Berguna untuk mitigasi risiko.
*   **Optimistic (Up):** Estimasi batas atas (115% dari performa saat ini). Digunakan untuk menetapkan target peregangan (*stretch targets*).

### 3. Algoritma Peramalan Awal Bulan (Smart Early-Month)
Untuk mengatasi volatilitas data pada 1-3 hari pertama setiap bulan, sistem menggunakan algoritma **Historical Anchor**:
*   **Kondisi:** Aktif jika data penjualan riil baru tersedia < 4 hari.
*   **Logika:** Menggabungkan 70% data historis (Target/Penjualan tahun lalu) dengan 30% performa riil saat ini.
*   **Hasil:** Angka proyeksi yang stabil di awal bulan, mencegah lonjakan angka yang tidak masuk akal akibat transaksi besar tunggal atau nihilnya transaksi di hari pertama.

---

## 🛠️ Detail Teknis

### Backend (`4-API_Dashboard.gs`)
Fungsi utama: `getForecastingData(year, month)`
*   **Input:** Tahun (angka) dan Bulan (0-11 atau 'current').
*   **Proses:**
    1.  Memuat data aktual tahun berjalan dan tahun sebelumnya.
    2.  Menghitung laju jual harian (*daily run rate*) berdasarkan hari aktif penjualan.
    3.  Menerapkan algoritma *Historical Anchor* jika di awal bulan.
    4.  Menganalisis dampak hari libur dan pola mingguan.
    5.  Menyusun struktur data proyeksi per butik dan per kategori.

### Frontend (`ViewForecasting.html` & `JsForecasting.html`)
*   **Antarmuka:** Menggunakan Tailwind CSS dengan gaya *Glassmorphism*.
*   **Visualisasi:**
    *   **Kartu Proyeksi:** Menampilkan 3 angka skenario secara jelas.
    *   **Progress Bar:** Menunjukkan pencapaian aktual terhadap target dan penanda waktu (*time marker*).
    *   **Chart.js:** Grafik *Seasonal Projection* yang membandingkan Aktual vs Proyeksi vs Target vs Tahun Lalu.

---

## 🐞 Ringkasan Perbaikan Terbaru (Bug Fixes)

1.  **Urutan Inisialisasi:** Memperbaiki *ReferenceError* di mana target dan data tahun lalu dimuat setelah digunakan oleh algoritma awal bulan.
2.  **Scope Variabel:** Memperbaiki masalah variabel `remainingSellingDays` yang tidak terdefinisi pada perhitungan proyeksi butik.
3.  **Stabilitas Data:** Menambahkan *fallback* otomatis jika data historis tahun lalu tidak ditemukan.

---

> [!TIP]
> **Tips Penggunaan:** Gunakan skenario **Pessimistic** untuk perencanaan stok barang minimum, dan skenario **Optimistic** untuk memotivasi tim butik dalam mencapai bonus performa.

> [!IMPORTANT]
> Proyeksi ini bersifat estimasi statistik. Faktor eksternal seperti *event* mendadak atau penutupan toko dapat mempengaruhi akurasi hasil akhir.
