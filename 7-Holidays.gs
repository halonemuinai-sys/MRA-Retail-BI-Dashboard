/**
 * File: 7-Holidays.gs
 * Description: Menyimpan daftar hari libur nasional dan cuti bersama Indonesia.
 * Format Tanggal: YYYY-MM-DD
 */

const ID_HOLIDAYS = {
    // === TAHUN 2026 ===
    "2026-01-01": "Tahun Baru 2026 Masehi",
    "2026-02-14": "Isra Mikraj Nabi Muhammad SAW",
    "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
    "2026-03-19": "Hari Suci Nyepi Tahun Baru Saka 1948",
    "2026-03-20": "Cuti Bersama Hari Suci Nyepi",
    "2026-03-21": "Hari Paskah",
    "2026-04-03": "Wafat Isa Al Masih",
    "2026-04-10": "Cuti Bersama Idul Fitri 1447 Hijriah",
    "2026-04-13": "Cuti Bersama Idul Fitri 1447 Hijriah",
    "2026-04-14": "Hari Raya Idul Fitri 1447 Hijriah",
    "2026-04-15": "Hari Raya Idul Fitri 1447 Hijriah",
    "2026-04-16": "Cuti Bersama Idul Fitri 1447 Hijriah",
    "2026-04-17": "Cuti Bersama Idul Fitri 1447 Hijriah",
    "2026-05-01": "Hari Buruh Internasional",
    "2026-05-14": "Kenaikan Isa Al Masih",
    "2026-05-31": "Hari Raya Waisak 2570 BE",
    "2026-06-01": "Hari Lahir Pancasila",
    "2026-06-21": "Hari Raya Idul Adha 1447 Hijriah",
    "2026-06-22": "Cuti Bersama Idul Adha",
    "2026-07-11": "Tahun Baru Islam 1448 Hijriah",
    "2026-08-17": "Hari Kemerdekaan Republik Indonesia",
    "2026-09-19": "Maulid Nabi Muhammad SAW",
    "2026-12-24": "Cuti Bersama Hari Raya Natal",
    "2026-12-25": "Hari Raya Natal",

    // Tambahan Tahun (opsional, bisa ditambah kedepannya)
    "2024-04-10": "Hari Raya Idul Fitri 1445 Hijriah",
    "2024-04-11": "Hari Raya Idul Fitri 1445 Hijriah",
    "2025-03-31": "Hari Raya Idul Fitri 1446 Hijriah",
    "2025-04-01": "Hari Raya Idul Fitri 1446 Hijriah"
};

/**
 * Mendapatkan nama hari libur berdasarkan tanggal
 * @param {string} dateStr Format YYYY-MM-DD
 * @returns {string|null} Nama libur atau null jika tidak ada
 */
function getIndonesianHoliday(dateStr) {
    return ID_HOLIDAYS[dateStr] || null;
}
