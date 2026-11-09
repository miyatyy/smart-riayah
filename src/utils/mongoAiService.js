/**
 * Client-side helper untuk menyimpan, membaca, memperbarui, dan menghapus
 * data hasil AI (DeepSeek Evaluations, AI Chat Agent Logs, AI Booking Parser Logs)
 * ke MongoDB melalui endpoint /api/ai/logs dan /api/mongodb/health.
 *
 * Seluruh pemanggilan memakai timeout singkat & graceful fallback agar tidak pernah
 * membuat UI loading lama meskipun MongoDB belum dikonfigurasi.
 */

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function saveAiToMongo(collection = 'ai_logs', document = {}) {
  try {
    const id = document.id || `AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payload = {
      collection,
      data: {
        ...document,
        id,
        savedAtClient: new Date().toISOString()
      }
    };

    const res = await fetchWithTimeout('/api/mongo?entity=ai-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 4500);

    if (!res.ok) return { success: false, savedToMongo: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { success: false, savedToMongo: false };
    return await res.json();
  } catch (err) {
    return { success: false, savedToMongo: false, error: err.message };
  }
}

export async function fetchAiLogsFromMongo({ collection = 'ALL', santriId = '', limit = 100 } = {}) {
  try {
    const params = new URLSearchParams();
    if (collection) params.set('collection', collection);
    if (santriId) params.set('santriId', santriId);
    if (limit) params.set('limit', String(limit));

    const res = await fetchWithTimeout(`/api/mongo?entity=ai-logs&${params.toString()}`, {}, 4500);
    if (!res.ok) return { success: false, mongoConnected: false, data: [], counts: {} };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { success: false, mongoConnected: false, data: [], counts: {} };
    return await res.json();
  } catch (err) {
    return { success: false, mongoConnected: false, error: err.message, data: [], counts: {} };
  }
}

export async function updateAiLogInMongo(id, collection = 'ai_logs', updates = {}) {
  try {
    const res = await fetchWithTimeout('/api/mongo?entity=ai-logs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, collection, ...updates })
    }, 4500);

    if (!res.ok) return { success: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { success: false };
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteAiLogFromMongo(id, collection = 'ALL') {
  try {
    const params = new URLSearchParams({ id: String(id) });
    if (collection) params.set('collection', collection);

    const res = await fetchWithTimeout(`/api/mongo?entity=ai-logs&${params.toString()}`, {
      method: 'DELETE'
    }, 4500);

    if (!res.ok) return { success: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { success: false };
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function checkMongoHealth() {
  try {
    const res = await fetchWithTimeout('/api/mongo?entity=health', {}, 4500);
    if (!res.ok) {
      return { success: false, connected: false, configured: false, mode: 'UNREACHABLE', counts: {} };
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { success: false, connected: false, configured: false, mode: 'HTML_FALLBACK', counts: {} };
    }
    return await res.json();
  } catch (err) {
    return { success: false, connected: false, configured: false, mode: 'ERROR', error: err.message, counts: {} };
  }
}

