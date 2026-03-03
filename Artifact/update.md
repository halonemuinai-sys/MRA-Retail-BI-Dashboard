# Pembaruan Dashboard Retail: Ringkasan Fitur & Konsep Baru

Dokumen ini merangkum seluruh pembaruan signifikan yang baru saja diimplementasikan pada **Bvlgari Sales Intelligence Dashboard**. Pembaruan ini difokuskan pada penambahan menu `Quarterly Performance`, perbaikan visualisasi grafik, serta penambahan insight detail (Top 10) guna memudahkan pengambilan keputusan strategis.

## 1. Pembaharuan Konsep Menu: "Quarterly Performance"

Menu baru **Quarterly Performance** telah ditambahkan ke dalam navigasi utama. Fitur ini dirancang khusus untuk memonitor siklus bisnis per-kuartal, mengingat analisis hanya bulanan seringkali tidak cukup untuk melihat tren makro.

**Konsep Utama:**
*   **Isolasi Kode (Performa Maksimal):** Untuk menghindari *bloating* (kode membengkak), fitur ini dibangun menggunakan file terpisah yang berdiri sendiri:
    *   [ViewQuarterly.html](file:///d:/Bvlgari%20Dashboard/ViewQuarterly.html): Khusus menangani tata letak antarmuka pengguna (UI).
    *   [8-API_Quarterly.gs](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs): Khusus menangani agregasi dan logika matematika (Sales, Target, dll) murni dari sisi server.
*   **Filter Spesifik Kuartal:**  Menyediakan filter "Q1", "Q2", "Q3", dan "Q4" (beserta Tahun) untuk mengisolasi 3 bulan tertentu secara tepat dan merangkumnya menjadi *Quarter-To-Date (QTD)*.
*   **Metric Utama (Highlight KPI):**
    *   **QTD Sales (Exc. HO):** Total penjualan 3 bulan berjalan.
    *   **Quarter Target & Achievement:** Target akumulasi dari ketiga bulan tersebut, dan *Achievement* divisualisasikan menggunakan *progress bar* dinamis.
    *   **YoY Growth:** Pertumbuhan langsung dibandingkan dengan Kuartal yang sama pada tahun sebelumnya.
*   **Tabel Pacing Bulanan (3-Month Trajectory):** Menjabarkan kontribusi masing-masing dari ke-3 bulan di kuartal terpilih agar dapat dilacak bulan mana yang paling lambat/cepat tarikannya.

## 2. Perbaikan Visualisasi Grafik (Charts)

Untuk membuat dashboard lebih intuitif dan akurat dalam menceritakan data, beberapa perbaikan visualisasi telah ditetapkan:

*   **Judul Chart Dinamis:** Judul grafik pada menu Bulanan (Monthly Overview) kini secara otomatis berubah menyesuaikan filter Bulan dan Tahun yang sedang diplih (bukan lagi *Current Month* statis).
*   **Indikator Weekend & Holiday:** Pada grafik garis "Daily Sales Trend", kini hari libur nasional Indonesia dan hari *Weekend* (Sabtu/Minggu) diberikan penanda warna merah pada titik nadirnya serta penjelasan *tooltip* apabila di-hover. Fitur ini menggunakan [7-Holidays.gs](file:///d:/Bvlgari%20Dashboard/7-Holidays.gs).
*   **Perubahan Diagram "Category Dominance":** Merespon kebutuhan pembacaan komparatif yang lebih detail, diagram pie (*doughnut*) pada *Quarterly View* telah diubah menjadi **Diagram Batang Horizontal (Horizontal Bar Chart)**. Hal ini menanggulangi sulitnya membandingkan irisan *pie* yang ukurannya berdekatan, serta menambahkan proporsi kontribusi (%) langsung di samping label tiap kategori.

## 3. Penambahan Tabel "Top 10" yang Lebih Analitis

Untuk memberi *insight* yang lebih konkrit di menu *Quarterly*, ditambahkan dua tabel analisis detail di bawah bagian *Category Dominance*:

*   **Top 10 Collection:** Menampilkan peringkat 10 besar koleksi produk yang terjual.
*   **Top 10 Catalogue Code (SAP):** Menampilkan pergerakan SKU individu secara lebih spesifik.
*   **Dimensi Analisis (Qty vs Sales):** Berdasarkan konsep *volume vs value*, kedua tabel tersebut kini menjejerkan secara berdampingan kolom **Qty** (Jumlah unit terjual) dan **Sales** (Total harga Net), ditambah *badge* nama kategori utama. Ini membantu pengguna mengetahui barang mana yang laris namun murah, dibandingkan barang yang jarang terjual namun menyumbang omzet raksasa.

---
**Status Keseluruhan:** Semua poin telah diintegrasikan, disejajarkan dengan komponen UI sistem, bebas dari _lint errors_, dan siap digunakan pada tahapan *Production*.
