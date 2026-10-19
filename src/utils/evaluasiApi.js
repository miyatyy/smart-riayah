/**
 * Smart Riayah - Client API Service untuk PostgreSQL Backend
 * Menghubungkan antarmuka React dengan REST API Endpoint evaluasi santri
 */

const API_BASE_URL = '/api';

/**
 * Cek status kesehatan backend dan koneksi database PostgreSQL
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    return {
      status: 'error',
      database: { success: false, error: error.message }
    };
  }
}

/**
 * Ambil daftar seluruh santri dari PostgreSQL
 */
export async function fetchSantriList() {
  const res = await fetch(`${API_BASE_URL}/santri`);
  if (!res.ok) throw new Error('Gagal mengambil data santri dari database');
  const json = await res.json();
  return json.data || [];
}

/**
 * Ambil daftar evaluasi harian (opsional filter tanggal / santri_id)
 * @param {Object} [filters]
 * @param {string} [filters.santri_id] - Contoh: 'S-101'
 * @param {string} [filters.tanggal] - Format: 'YYYY-MM-DD'
 * @param {number} [filters.limit=50]
 */
export async function fetchEvaluasiList(filters = {}) {
  const params = new URLSearchParams();
  if (filters.santri_id) params.append('santri_id', filters.santri_id);
  if (filters.tanggal) params.append('tanggal', filters.tanggal);
  if (filters.limit) params.append('limit', filters.limit);

  const url = `${API_BASE_URL}/evaluasi?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengambil data evaluasi');
  const json = await res.json();
  return json.data || [];
}

/**
 * Ambil riwayat evaluasi spesifik santri tertentu
 * @param {string} santriId - Contoh: 'S-101'
 */
export async function fetchEvaluasiBySantri(santriId) {
  const res = await fetch(`${API_BASE_URL}/evaluasi/${santriId}`);
  if (!res.ok) throw new Error(`Gagal mengambil evaluasi santri ${santriId}`);
  const json = await res.json();
  return json.data || [];
}

/**
 * Simpan atau perbarui (upsert) data evaluasi santri ke PostgreSQL
 * @param {Object} data - Payload evaluasi santri
 */
export async function saveEvaluasi(data) {
  const res = await fetch(`${API_BASE_URL}/evaluasi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Gagal menyimpan evaluasi');
  }
  return json;
}

/**
 * Hapus data evaluasi berdasarkan ID
 * @param {number} id
 */
export async function deleteEvaluasi(id) {
  const res = await fetch(`${API_BASE_URL}/evaluasi/${id}`, {
    method: 'DELETE'
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Gagal menghapus evaluasi');
  }
  return json;
}

export default {
  checkBackendHealth,
  fetchSantriList,
  fetchEvaluasiList,
  fetchEvaluasiBySantri,
  saveEvaluasi,
  deleteEvaluasi
};
