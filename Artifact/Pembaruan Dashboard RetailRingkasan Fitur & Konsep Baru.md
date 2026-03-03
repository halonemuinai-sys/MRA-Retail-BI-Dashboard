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
    *   **QTD Sales (Exc. HO):** Total penjualan
### 1. Sales Heatmap Calendar (Monthly Transaction Sub-Menu)
- Integrated a new "Heatmap Calendar" sub-view within the **Monthly Transaction** page.
- Users can toggle between the traditional "Tabular View" and the visual "Heatmap Calendar" using the buttons at the top right of the Monthly Transaction section.
- Converts daily sales data into a visual heatmap grid where darker emerald colors represent higher sales.
- Displays comprehensive calendar insights:
    - **Highest Grossing Day**
    - **Lowest Grossing Day**
    - **Best Day of the Week**
- Includes hover tooltips on each calendar day block for granular data inspection (Net Sales & Quantity).
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

## 4. Peningkatan Kecepatan (Data Caching)

Untuk mengatasi masalah waktu *loading* yang lama saat berpindah tab atau mengubah filter, kami telah mengimplementasikan sistem **Data Caching (Penyimpanan Memori Sementara)** di level server menggunakan Google Apps Script `CacheService`. Optimisasi ini dibagi menjadi dua fase yang kini telah sepenuhnya mencakup seluruh dashboard.

**Detail Peningkatan:**
*   **Cakupan Penuh:** *Cache Memory* kini aktif untuk Dashboard Utama, Quarterly Overview, Category Trend, Product Rank (Top 10 SAP), dan Monthly Transactions (termasuk Heatmap Calendar).
*   **Kecepatan Instan (< 0.5 Detik):** Membuka data spesifik bulan/kuartal yang sama dalam rentang waktu yang berdekatan tidak lagi membebani proses pembacaan ribuan baris di Google Sheets, memangkas waktu dari ~5 detik menjadi hampir instan.
*   **Masa Aktif Cache 5 Menit:** Menjaga keseimbangan antara kecepatan *(performance)* dan visibilitas pembaruan data terbaru *(data freshness)*.
*   **Fitur "Force Refresh":** Tombol **Sync** dan **Filter** kini secara otomatis mengirim instruksi bypass *cache* ke *backend*, menarik data paling segar langsung dari sumbernya dan memecahkan perulangan *cache* lama.

---

## 5. Fitur Analisis "Category Trend (Value & Qty)"

Sebagai evolusi historis untuk analisis performa produk, menu **Product Rank (SAP)** kini telah dilengkapi dengan mode **Category Trend**:

**Tujuan dan Manfaat:**
Memungkinkan manajemen untuk melihat dengan cepat perbandingan performa aktual tiap kategori barang (*Jewelry*, *Watches*, dll) secara *Year-on-Year* (YoY) selama beberapa tahun terakhir (2023-2026), baik dari segi **Nilai Rupiah (Value)** maupun **Kuantitas Terjual (Qty)**.

**Komponen Utama:**
*   **Mode "Category Trend":** Dapat diakses melalui tombol *toggle* pada halaman **Product Rank Analysis**.
*   **Dual-Metric Toggle:** Menghadirkan dua tombol baru: **By Value (Rp)** dan **By Qty (Pcs)**. Pengguna dapat secara dinamis mengubah satuan metrik yang ditampilkan pada keseluruhan halaman (Grafik, Tabel, Angka Ringkasan) tanpa harus memuat ulang (*reload*) halaman.
*   **Interactive Category Pills:** Opsi kategori kini menggunakan tombol gaya *pill* (Jewelry, Watches, Accessories, Fragrance). Pengguna difokuskan untuk memilih satu kategori spesifik guna menghindari perhitungan unit Qty yang tidak setara antar jenis produk (contoh: menggabung kalung dengan parfum).
*   **Visualisasi Trend Multi-Tahun:** Menyajikan grafik interaktif 12 bulan (Januari-Desember) yang melacak titik jatuh bangun performa aktual per bulan. Grafik ini langsung menimpa data komparasi tahun sebelumnya (2025, 2024, 2023) dalam satu bidang pandang.
*   **Interactive Year Legend:** Pengguna dapat mengklik label tahun (contoh: 2024 atau 2023) di pojok grafik untuk menyalakan/mematikan (*toggle*) garis perbandingan historis tahun tersebut secara dinamis, sehingga layar tidak terlalu penuh.
*   **Metrik Ringkasan (Dinamo):** Menghitung dan menampilkan **YTD Actual** (Tahun berjalan), **Prev Year YTD** (Periode yang sama di tahun sebelumnya), dan persentase **YoY Growth** (Pertumbuhan). Angka-angka ini otomatis menyesuaikan format Rupiah atau PCS tergantung tombol ukur yang aktif.

---
**Status Keseluruhan:** Semua poin telah diintegrasikan, disejajarkan dengan komponen UI sistem, bebas dari _lint errors_, dan siap digunakan pada tahapan *Production*.

---

## 6. Fitur "Quarterly Budget vs Actual 2026"

Sebuah sub-menu baru telah ditambahkan ke dalam **Quarterly Performance** untuk memberikan wawasan langsung mengenai pencapaian penjualan aktual terhadap target *Budget 2026*.

**Tujuan dan Manfaat:**
Memfasilitasi pelacakan otomatis performa toko terhadap target tahunan yang telah ditetapkan (`master_budget_store_2026`), menghilangkan keharusan perhitungan manual untuk varians (*variance*) dan persentase pencapaian (*% achieved*).

**Komponen Utama:**
*   **Sub-View Toggle:** Pengguna dapat beralih antara "Standard View" (Grafik QTD konvensional) dan "Budget 2026 Compare" melalui tombol khusus di kanan atas menu Quarterly.
*   **Tabel Varians Otomatis:** Menampilkan daftar seluruh butik/toko dengan perbandingan berdampingan: *Actual Sales*, *Budget*, *Variance* (Selisih aktual vs target), dan *Achievement %*.
*   **Visualisasi Progress Bar:** Kolom *Achievement %* dilengkapi dengan palang kemajuan berwarna dinamis:
    *   **Hijau (Emerald):** Jika pencapaian >= 100%.
    *   **Kuning (Amber):** Jika pencapaian antara 80% - 99%.
    *   **Merah (Red):** Jika pencapaian < 50%.
*   **Highlight KPI Cards:** Ringkasan total dari seluruh toko di kuartal tersebut (*Total QTD Actual*, *Total QTD Budget*, *Variance Keseluruhan*, dan *Persentase Gabungan*).
    *   **Interactive Tooltips:** Setiap KPI card kini dilengkapi dengan ikon tanda tanya (❓) yang memunculkan kotak penjelasan interaktif ketika digeser (*hover*), memberikan konteks detail tentang arti masing-masing angka ukur.
*   **Auto-Validation:** Karena arsitektur berfokus khusus pada *budget* 2026, sistem otomatis menampilkan peringatan halus jika pengguna mengakses menu ini menggunakan filter waktu selain tahun 2026.

### Fitur Lanjutan: Store Monthly Breakdown
Tepat di bawah tabel utama, kini terdapat tabel analitik tingkat lanjut yang dipecah per-bulan:
*   **Segmentasi Otomatis (M1, M2, M3):** Tabel ini memisahkan total *Quarter-To-Date* (QTD) tadi menjadi tiga kolom bulan yang membentuk kuartal tersebut secara spesifik (Misal: Jika Quarter 1 dipilih, judul tabel otomatis beradaptasi menjadi *January, February, March*).
*   **3-Point Comparison:** Setiap bulan menjabarkan secara eksklusif nilai **Actual**, **Budget**, dan porsi **Achievement %**-nya masing-masing.
*   **Color Coded Tracker:** Sama seperti tabel QTD di atasnya, nilai `% Achv` pada breakdown bulanan juga telah dikalibrasi menggunakan kode-warna lalu lintas (Hijau/Kuning/Merah), mempermudah deteksi dini tren toko yang merosot cepat (jatuh tajam ke merah) di tengah-tengah rentang kuartal berjalan.

## [6. Customer Intelligence & Segmentation](#customer-intelligence)
Revamped the Customer Segmentation view to provide actionable insights directly on the main dashboard tab without adding unnecessary sub-menus or load times:
*   **Executive KPI Cards:** Added summary cards to display `Total Active Customers`, `Avg. Lifetime Value`, `Top Spender Name`, and the `New Customer Acquisition Ratio` for the current year.
*   **Acquisition Trend Chart:** Introduced a new line chart showing the monthly growth trend of new vs. repeat customers over the year.
*   **Customer Detail Modal:** Implemented an interactive "View Details" action on the customer table. Clicking this opens a rich pop-up modal that fetches (via lazy-loading) and displays the customer's complete transaction history, top 5 favorite collections, and lifetime spend metrics, ensuring the initial page load remains fast.
