import osisReportsHandler from '../../server/handlers/osisReportsHandler.js';
import aiLogsHandler from '../../server/handlers/aiLogsHandler.js';
import mongoHealthHandler from '../../server/handlers/mongoHealthHandler.js';

export default async function handler(req, res) {
  const rawEntity = String(req.query?.entity || req.params?.entity || '').toLowerCase();
  const urlPath = String(req.url || '').toLowerCase().split('?')[0];

  if (rawEntity === 'health' || urlPath.endsWith('/health')) {
    return mongoHealthHandler(req, res);
  }

  if (rawEntity === 'ai-logs' || rawEntity === 'logs' || urlPath.endsWith('/ai-logs') || urlPath.endsWith('/ai/logs')) {
    return aiLogsHandler(req, res);
  }

  if (rawEntity === 'osis-reports' || rawEntity === 'reports' || urlPath.endsWith('/osis-reports') || urlPath.endsWith('/osis/reports')) {
    return osisReportsHandler(req, res);
  }

  return res.status(404).json({
    success: false,
    message: `Endpoint Mongo entity '${rawEntity || urlPath}' tidak ditemukan.`
  });
}

