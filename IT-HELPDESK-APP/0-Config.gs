/**
 * IT HELPDESK APP v2
 * Configuration File
 */

const HELPDESK_CONFIG = {
  DB_SHEET_ID: '1HJN4XcdJWmejuBbPZzjnntHSxKL5zYQd31gqc06zwSU',
  SHEETS: {
    USERS:      'USERS',
    TICKETS:    'TICKETS',
    CATEGORIES: 'CATEGORIES',
    IT_STAFF:   'IT_STAFF'
  },
  // Default categories (hanya dipakai saat sheet CATEGORIES belum ada / kosong)
  DEFAULT_CATEGORIES: [
    { code: 'POS_HW',     label: 'POS Hardware',          desc: 'Mesin POS mati, keyboard, monitor rusak' },
    { code: 'POS_SW',     label: 'POS Software',          desc: 'Error aplikasi POS, update fitur POS' },
    { code: 'POS_ACC',    label: 'POS Account',           desc: 'Reset password POS, akun terkunci, user baru' },
    { code: 'PRINTER',    label: 'Printer & Peripheral',  desc: 'Printer struk, label, scanner barcode' },
    { code: 'EMAIL',      label: 'Email & Ms Office',     desc: 'Outlook error, akses email, Word/Excel/PPT' },
    { code: 'NETWORK',    label: 'Network & Internet',    desc: 'WiFi mati, koneksi lambat, VPN' },
    { code: 'INFRA',      label: 'Infrastruktur IT',      desc: 'Server, switch, access point, kabel LAN' },
    { code: 'CCTV',       label: 'CCTV & Security',       desc: 'CCTV offline, NVR, akses rekaman' },
    { code: 'ERP',        label: 'ERP / SAP',             desc: 'Error transaksi SAP, sync data' },
    { code: 'TRAFFIC',    label: 'Traffic Counter',       desc: 'Sensor traffic, data footfall' },
    { code: 'RETAILSOFT', label: 'Retailsoft',            desc: 'Aplikasi Retailsoft, error, update' },
    { code: 'BSC',        label: 'BSC',                   desc: 'Balanced Scorecard system' },
    { code: 'DEVICE_REQ', label: 'Permintaan Perangkat',  desc: 'Request laptop, HP, tablet, perangkat baru' },
    { code: 'OTHER',      label: 'Lainnya',               desc: 'Masalah di luar kategori' }
  ]
};
