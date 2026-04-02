# Bvlgari Retail Super App Architecture

Berikut adalah skema arsitektur ekosistem **"Super App"** Bvlgari Retail yang saling terhubung antara **Main Dashboard**, **CRM App**, dan **Advisor App**. Skema ini dirancang berdasarkan pembagian folder (front-end/UI) dan pemisahan wewenang fungsi di tiap aplikasinya.

## 1. Topologi Arsitektur Super App

```mermaid
graph TD
    %% Define Styles
    classDef mainApp fill:#1F2937,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef crmApp fill:#065F46,stroke:#10B981,stroke-width:2px,color:#fff;
    classDef advisorApp fill:#7C2D12,stroke:#F59E0B,stroke-width:2px,color:#fff;
    classDef db fill:#4B5563,stroke:#9CA3AF,stroke-width:2px,color:#fff;
    classDef users fill:#F3F4F6,stroke:#D1D5DB,stroke-width:2px,color:#111827;

    %% Data Sources (Backend)
    subgraph Data_Layer ["🗄️ Centralized Database Layer (Master Data)"]
        GS[(Google Sheets / Supabase)]
    end
    
    subgraph API_Layer ["API & Endpoints (Logic)"]
        API_Sales[API Sales Data]
        API_Traffic[API Traffic/Footfall]
        API_Profile[API Customer Profiling]
    end
    
    GS --- API_Sales
    GS --- API_Traffic
    GS --- API_Profile

    %% Application Layers (Frontend)
    subgraph App_Layer ["🌐 Super App Ecosystem (Front-End Interfaces)"]
        
        Dashboard("📈 MAIN DASHBOARD<br/>(Master View)"):::mainApp
        CRM("👥 CRM APP<br/>(Data Management)"):::crmApp
        Advisor("📱 ADVISOR APP<br/>(Mobile Performance)"):::advisorApp
        
    end

    %% User Personas
    subgraph Users ["👨‍💼 Pengguna Sistem"]
        StoreManager("Store Manager / Executive"):::users
        Admin("Store Admin / Operations"):::users
        ClientAdvisor("Client Advisor (CA)"):::users
    end

    %% Connections Users -> Apps
    StoreManager -.->|Melihat seluruh Metrik & KPI| Dashboard
    Admin -.->|Input & Kelola Data Harian| CRM
    ClientAdvisor -.->|Tracking Target Pribadi| Advisor

    %% Connections Apps -> Data
    Dashboard <==>|Read: Konsolidasi Semua Data| API_Sales
    Dashboard <==>|Read: Konsolidasi Semua Data| API_Traffic
    
    CRM ==>|Write/Update/Read: Data Lalin, Penjualan, Profil| API_Profile
    CRM ==>|Write/Update| API_Traffic
    CRM ==>|Write/Update| API_Sales

    Advisor <==>|Read: Kinerja Individu| API_Sales
    Advisor <==>|Read: Daftar Klien (Profiling)| API_Profile
```

## 2. Penjelasan Komponen "Super App"

Modul-modul ini bekerja seperti ekosistem terpadu di mana data diinput di satu tempat (CRM) lalu dikonsumsi dan ditampilkan secara berbeda berdasarkan peran penggunanya (Dashboard & Advisor App).

### A. 📈 Main Dashboard (`d:\Bvlgari Dashboard\`) - "The Command Center"
**Pengguna:** Store/Boutique Manager, Area Manager, Executives.
**Fungsi Utama:**
Dashboard ini beroperasi hanya untuk **Membaca Data (Read-Only/Analytics)** secara level tinggi (macro). 
- Menarik semua data Penjualan dari berbagai dimensi.
- Menganalisis korelasi antara *Footfall* (Trafik) dengan *Sales* (Capture Rate / Conversion).
- Tidak ada form input yang berat di sini, performa diutamakan agar load chart cepat.

### B. 👥 CRM App (`\CRM-APP`) - "The Engine & Data Entry"
**Pengguna:** Store Admin, CRM Specialist, Operations.
**Fungsi Utama:**
Ini adalah mesin penggerak data Super App. Aplikasi ini bertugas **Memasukkan dan Mengelola Data (Read/Write)** tingkat operasional sehari-hari (micro):
- **Kelola Traffic:** Memasukkan data pengunjung toko harian.
- **Kelola Profiling:** Menambah atau memperbaiki data kustomer / Customer Master.
- **Kelola Penjualan:** Data entry penjualan harian per transaksi atau per karyawan.
Ketika sebuah data diperbarui di aplikasi CRM, itu akan terekam secara real-time ke database terpusat yang nanti ditarik oleh Main Dashboard.

### C. 📱 Advisor App (`\ADVISOR-APP`) - "The Personal Tracker"
**Pengguna:** Client Advisor (Karyawan Penjualan Lapangan).
**Fungsi Utama:**
Sebagai aplikasi pendamping bergaya mobile untuk CA, agar mereka dapat mandiri mengawasi KPI pribadi:
- **Pencapaian Pribadi:** CA bisa mengecek berapa total sales mereka hari ini vs Target (tanpa melihat target orang lain).
- **Aksi Cepat:** Mungkin bisa diarahkan untuk melihat daftar pelanggan mereka dan profil pembeli untuk follow-up (contohnya data Ulang Tahun/Birthday).

## 3. Keuntungan Desain Terdistribusi (Micro-Frontends)
1. **Pemisahan Otorisasi Akses (Security):** CA tidak bisa menghapus/mengedit raw data (itu tugas admin di CRM App), dan CA tidak terdistraksi melihat menu manajemen kompleks milik Main Dashboard.
2. **Performa Lebih Baik:** File JavaScript/CSS tidak menumpuk menjadi satu file raksasa. *Advisor App* bisa dibangun sangat ringan khusus untuk *Mobile device*, sedangkan *Main Dashboard* bisa lebih kaya fitur dengan chart kompleks khusus desktop.
3. **Sentralisasi Data API:** Apapun yang di-input melalui CRM-App, *Single Source of Truth* tetap di backend (Google Sheets/Supabase). Ketiga aplikasi akan membaca data ke database / endpoint yang sama, sehingga selalu sinkron tanpa ada data ganda.
