/**
 * Smart Ri'ayah - Robust CSV Parser & Generator Utility
 * Sesuai RFC 4180: Mendukung tanda kutip ganda, multiline text, koma dalam nilai, dan BOM UTF-8 untuk Excel
 */

/**
 * Mem-parsing string CSV menjadi array objek
 * @param {string} csvText - Isi file CSV mentah
 * @returns {{ headers: string[], rows: Record<string, string>[], totalRows: number, errors: string[] }}
 */
export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], totalRows: 0, errors: ['File CSV kosong atau format tidak valid'] };
  }

  // Hapus UTF-8 BOM jika ada
  let text = csvText.replace(/^\uFEFF/, '');

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  const errors = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote ("")
        currentField += '"';
        i++; // lewati quote berikutnya
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Akhir kolom
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // Akhir baris
      if (char === '\r' && nextChar === '\n') {
        i++; // lewati \n pada format \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Tambahkan field terakhir jika belum masuk
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ['Tidak ada data yang terbaca dari file CSV'] };
  }

  // Header baris pertama
  const rawHeaders = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const originalHeaders = rows[0].map(h => h.trim());
  const parsedRows = [];

  for (let r = 1; r < rows.length; r++) {
    const rowArray = rows[r];
    // Lewati baris kosong
    if (!rowArray || rowArray.every(c => !c)) continue;

    const rowObj = {};
    for (let c = 0; c < originalHeaders.length; c++) {
      const key = originalHeaders[c] || `kolom_${c + 1}`;
      rowObj[key] = rowArray[c] !== undefined ? rowArray[c] : '';
    }
    parsedRows.push(rowObj);
  }

  return {
    headers: originalHeaders,
    normalizedHeaders: rawHeaders,
    rows: parsedRows,
    totalRows: parsedRows.length,
    errors
  };
}

/**
 * Escape nilai untuk ditulis ke CSV
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Menghasilkan teks CSV dari array objek
 */
export function generateCsv(headers, rows) {
  const headerLine = headers.map(h => escapeCsvValue(h)).join(',');
  const rowLines = rows.map(row => {
    return headers.map(h => escapeCsvValue(row[h] !== undefined ? row[h] : '')).join(',');
  });

  // Tambahkan BOM \uFEFF agar Microsoft Excel membaca format UTF-8 dengan baik
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Memicu download file CSV di browser pengguna
 */
export function downloadCsvFile(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Template CSV standar untuk 4 entitas Smart Riayah
 */
export function getTemplateCsv(type) {
  switch (type) {
    case 'knowledge': {
      const headers = ['priority', 'topic_group', 'kategori', 'judul', 'konten', 'quality', 'status', 'security'];
      const sampleRows = [
        {
          priority: '10',
          topic_group: 'Booking Flow',
          kategori: 'booking',
          judul: 'Jadwal Kunjungan Aktif & Jam Operasional Pondok',
          konten: 'Jumat-Minggu 08.30-11.30 & 13.30-16.30 WITA (Auto-Approve). Senin-Kamis 14.00-16.30 WITA (Wajib Approval Admin). Durasi max 90 menit.',
          quality: '98/100',
          status: 'Active',
          security: 'Security Approved'
        },
        {
          priority: '20',
          topic_group: 'Policy & Boundaries',
          kategori: 'policy',
          judul: 'Aturan Titipan Barang Makanan & Batas Berat Maksimal (5 Kg)',
          konten: 'Wajib ditimbang Satpam di gerbang utama, batas maksimal 5 Kg per santri. Makanan basah wajib dihabiskan di hari yang sama.',
          quality: '95/100',
          status: 'Active',
          security: 'Security Approved'
        },
        {
          priority: '25',
          topic_group: 'Policy & Boundaries',
          kategori: 'policy',
          judul: 'Daftar Barang Terlarang (Prohibited Items)',
          konten: 'Dilarang membawa HP, gadget elektronik, rokok, vape, pakaian jeans/ketat, dan alat masak pemanas listrik.',
          quality: '97/100',
          status: 'Active',
          security: 'Security Approved'
        }
      ];
      return generateCsv(headers, sampleRows);
    }

    case 'santri': {
      const headers = [
        'nis',
        'nama_santri',
        'kategori_asrama',
        'kelas',
        'kamar_asrama',
        'asal_daerah',
        'nama_wali',
        'status_wali',
        'no_wa_wali',
        'rfid_uid',
        'status_kartu',
        'poin_disiplin'
      ];
      const sampleRows = [
        {
          nis: '125601',
          nama_santri: 'Muhammad Rayhan Al-Fatih',
          kategori_asrama: 'PUTRA',
          kelas: '10-A (Putra)',
          kamar_asrama: 'Asrama Putra Umar bin Khattab - Kamar 204',
          asal_daerah: 'Surabaya',
          nama_wali: 'H. Bambang Sudarsono',
          status_wali: 'Orang Tua Kandung',
          no_wa_wali: '081234567895',
          rfid_uid: '04:A1:2B:9C',
          status_kartu: 'ACTIVE',
          poin_disiplin: '100'
        },
        {
          nis: '126146',
          nama_santri: 'Nurmiyaty',
          kategori_asrama: 'PUTRI',
          kelas: '10-B Putri',
          kamar_asrama: 'Asrama Putri Khadijah - Kamar 105',
          asal_daerah: 'Surabaya',
          nama_wali: 'Arbainah',
          status_wali: 'Orang Tua Kandung',
          no_wa_wali: '628813576012',
          rfid_uid: '53:57:98:0F',
          status_kartu: 'ACTIVE',
          poin_disiplin: '100'
        },
        {
          nis: '125603',
          nama_santri: 'Faris Maulana Malik',
          kategori_asrama: 'PUTRA',
          kelas: '11-IPA (Putra)',
          kamar_asrama: 'Asrama Putra Abu Bakar - Kamar 102',
          asal_daerah: 'Sidoarjo',
          nama_wali: 'Bpk. Ahmad Ridwan',
          status_wali: 'Orang Tua Kandung',
          no_wa_wali: '085712348899',
          rfid_uid: '64:98:C1:2A',
          status_kartu: 'ACTIVE',
          poin_disiplin: '95'
        }
      ];
      return generateCsv(headers, sampleRows);
    }

    case 'rfid': {
      const headers = ['nis', 'nama_santri', 'kelas', 'kamar_asrama', 'rfid_uid', 'status_kartu'];
      const sampleRows = [
        {
          nis: '125601',
          nama_santri: 'Muhammad Rayhan Al-Fatih',
          kelas: '10-A (Putra)',
          kamar_asrama: 'Kamar 204',
          rfid_uid: '04:A1:2B:9C',
          status_kartu: 'ACTIVE'
        },
        {
          nis: '125602',
          nama_santri: 'Aisyah Putri Azzahra',
          kelas: '10-B (Putri)',
          kamar_asrama: 'Kamar 105',
          rfid_uid: '53:57:98:8F',
          status_kartu: 'ACTIVE'
        },
        {
          nis: '125603',
          nama_santri: 'Faris Maulana Malik',
          kelas: '11-IPA (Putra)',
          kamar_asrama: 'Kamar 102',
          rfid_uid: '64:98:C1:2A',
          status_kartu: 'ACTIVE'
        }
      ];
      return generateCsv(headers, sampleRows);
    }

    case 'customers': {
      const headers = ['nama_wali', 'no_wa_wali', 'nama_santri', 'kelas', 'kamar_asrama', 'status_wali'];
      const sampleRows = [
        {
          nama_wali: 'H. Bambang Sudarsono',
          no_wa_wali: '081234567895',
          nama_santri: 'Muhammad Rayhan Al-Fatih',
          kelas: '10-A (Putra)',
          kamar_asrama: 'Kamar 204',
          status_wali: 'Orang Tua Kandung'
        },
        {
          nama_wali: 'Arbainah',
          no_wa_wali: '628813576012',
          nama_santri: 'Nurmiyaty',
          kelas: '10-B Putri',
          kamar_asrama: 'Kamar 105',
          status_wali: 'Orang Tua Kandung'
        },
        {
          nama_wali: 'Bpk. Ahmad Ridwan',
          no_wa_wali: '085712348899',
          nama_santri: 'Faris Maulana Malik',
          kelas: '11-IPA (Putra)',
          kamar_asrama: 'Kamar 102',
          status_wali: 'Orang Tua Kandung'
        }
      ];
      return generateCsv(headers, sampleRows);
    }

    default:
      return '';
  }
}

