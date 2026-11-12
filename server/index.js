import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import whatsappGatewayRouter from './whatsapp-gateway/whatsappGatewayRouter.js';
import osisReportsHandler from './handlers/osisReportsHandler.js';
import aiLogsHandler from './handlers/aiLogsHandler.js';
import mongoHealthHandler from './handlers/mongoHealthHandler.js';
import mongoRouterHandler from '../api/mongo.js';
import aiParseBookingHandler from '../api/visits/ai-parse-booking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// -------------------------------------------------------------------------------------
// VALIDASI ENV BACKEND SAAT BOOT (TANPA PREFIX VITE_)
// -------------------------------------------------------------------------------------
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'COUPON_TOKEN_PEPPER',
  'ALLOWED_ORIGIN',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter(
  (key) => typeof process.env[key] !== 'string' || process.env[key].trim() === ''
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `[Smart Riayah Backend] Missing required environment variable(s): ${missingEnvVars.join(', ')}. Configure them in backend .env (without VITE_ prefix).`
  );
}

const allowedOrigins = process.env.ALLOWED_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  throw new Error('[Smart Riayah Backend] ALLOWED_ORIGIN must contain at least one valid origin.');
}

const rawDefaultTtl = process.env.COUPON_DEFAULT_TTL_SECONDS?.trim();
const parsedDefaultTtl = rawDefaultTtl ? Number(rawDefaultTtl) : 900;
if (!Number.isInteger(parsedDefaultTtl) || parsedDefaultTtl < 60 || parsedDefaultTtl > 86400) {
  throw new Error('[Smart Riayah Backend] COUPON_DEFAULT_TTL_SECONDS must be an integer between 60 and 86400.');
}
const COUPON_DEFAULT_TTL_SECONDS = parsedDefaultTtl;

const SUPABASE_URL = process.env.SUPABASE_URL.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const COUPON_TOKEN_PEPPER = process.env.COUPON_TOKEN_PEPPER;

// Client Supabase Admin khusus backend (tidak pernah diekspos ke client)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 5000;

// -------------------------------------------------------------------------------------
// MIDDLEWARE KEAMANAN GLOBAL (SEBELUM SEMUA ROUTE)
// -------------------------------------------------------------------------------------
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use(globalLimiter);

// -------------------------------------------------------------------------------------
// HELPER TOKEN, AUTH & RBAC MODUL VISITOR E-COUPON
// -------------------------------------------------------------------------------------
const ROLE_MATRIX = {
  issue: ['superadmin', 'admin_riayah', 'mudir'],
  scan: ['satpam', 'superadmin', 'admin_riayah'],
  revoke: ['superadmin', 'admin_riayah'],
};

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32,64}$/;

const generateToken = () => crypto.randomBytes(32).toString('base64url');

const hashToken = (token) =>
  crypto.createHmac('sha256', COUPON_TOKEN_PEPPER).update(`coupon:${token}`).digest('hex');

const tokenPrefix = (raw) => {
  if (typeof raw !== 'string') return 'invalid';
  const cleaned = raw.trim().replace(/^SR1:/, '').slice(0, 8);
  return cleaned || 'invalid';
};

function normalizeScanned(raw) {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (value.startsWith('SR1:')) {
    value = value.slice(4).trim();
  }
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed.t !== 'string') return null;
      value = parsed.t.trim();
      if (value.startsWith('SR1:')) {
        value = value.slice(4).trim();
      }
    } catch {
      return null;
    }
  }
  if (!TOKEN_REGEX.test(value)) {
    return null;
  }
  return value;
}

async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const jwt = match?.[1]?.trim();
    if (!jwt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('roles(nama_role)')
      .eq('auth_user_id', data.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ [Coupon auth role lookup error]:', profileError.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const roleObj = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles;
    const roleName = typeof roleObj?.nama_role === 'string' ? roleObj.nama_role.trim() : null;

    req.authUser = {
      id: data.user.id,
      role: roleName,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.authUser?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.authUser.role || !allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

const issueCouponSchema = z.object({
  permit_id: z.string().trim().min(1).max(100),
  visitor_name: z.string().trim().min(2).max(120),
  visitor_phone: z.string().trim().min(8).max(20).nullish(),
  gate_id: z.string().trim().min(1).max(64).nullish(),
  ttl_seconds: z.number().int().min(60).max(86400).nullish(),
  max_uses: z.number().int().min(1).max(10).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const scanCouponSchema = z.object({
  token: z.string().trim().min(10).max(200),
  gate_id: z.string().trim().min(1).max(64).nullish(),
});

const revokeCouponSchema = z.object({
  coupon_id: z.uuid(),
  reason: z.string().trim().min(3).max(200).nullish(),
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, message: 'Terlalu banyak percobaan scan, coba lagi nanti' },
  keyGenerator: (req) => {
    const clientIp = ipKeyGenerator(req.ip || '0.0.0.0');
    const normalized = normalizeScanned(req.body?.token);
    const prefix = normalized ? normalized.slice(0, 8) : tokenPrefix(req.body?.token);
    return `${clientIp}|${prefix}`;
  },
});

// WhatsApp Real-Time Gateway (Redis Message Broker & Soketi Broadcaster)
app.use('/api/whatsapp', whatsappGatewayRouter);

// MongoDB & PostgreSQL OSIS Reports CRUD + AI Logs + Health
app.all('/api/mongo', mongoRouterHandler);
app.all('/api/mongo/osis-reports', osisReportsHandler);
app.all('/api/mongo/ai-logs', aiLogsHandler);
app.all('/api/mongo/health', mongoHealthHandler);
app.all('/api/osis/reports', osisReportsHandler);
app.all('/api/ai/logs', aiLogsHandler);
app.all('/api/mongodb/health', mongoHealthHandler);
app.all('/api/visits/ai-parse-booking', aiParseBookingHandler);

// -------------------------------------------------------------------------------------
// HEALTH CHECK ENDPOINT
// -------------------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'smart-riayah-coupon-api',
  });
});

// -------------------------------------------------------------------------------------
// VISITOR E-COUPON ROUTES (QR ONE-TIME VIA SUPABASE ADMIN + RPC CONSUME_COUPON)
// -------------------------------------------------------------------------------------
app.post(
  '/api/coupons/issue',
  authenticateUser,
  requireRole(ROLE_MATRIX.issue),
  async (req, res, next) => {
    try {
      const parsed = issueCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request' });
      }

      const {
        permit_id,
        visitor_name,
        visitor_phone,
        gate_id,
        ttl_seconds,
        max_uses,
        metadata,
      } = parsed.data;

      // (1) Verifikasi permit di Supabase
      const { data: permit, error: permitError } = await supabaseAdmin
        .from('permits')
        .select('id,santri_id,santri_name,status')
        .eq('id', permit_id)
        .single();

      if (permitError?.code === 'PGRST116' || !permit) {
        return res.status(404).json({ error: 'permit_not_found' });
      }
      if (permitError) {
        console.error('❌ [Coupon issue permit lookup error]:', permitError.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (permit.status !== 'APPROVED') {
        return res.status(400).json({ error: 'permit_not_approved' });
      }

      // (2) Lazy-expire kupon lama milik permit tersebut jika melewati expires_at
      const nowIso = new Date().toISOString();
      const { error: expireError } = await supabaseAdmin
        .from('visitor_coupons')
        .update({ status: 'expired' })
        .eq('permit_id', permit_id)
        .eq('status', 'issued')
        .lt('expires_at', nowIso);

      if (expireError) {
        console.error('❌ [Coupon issue lazy-expire error]:', expireError.message);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // (3) Generate token acak & HMAC hash (tanpa menyimpan token plaintext di DB)
      const ttlSeconds = ttl_seconds ?? COUPON_DEFAULT_TTL_SECONDS;
      const maxUses = max_uses ?? 1;
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      // (4) Simpan kupon baru (unique partial index mencegah duplikat kupon aktif)
      const { data: insertedCoupon, error: insertError } = await supabaseAdmin
        .from('visitor_coupons')
        .insert([
          {
            permit_id: permit.id,
            santri_id: permit.santri_id,
            visitor_name,
            visitor_phone_hash: visitor_phone ? hashToken(`phone:${visitor_phone}`) : null,
            token_hash: tokenHash,
            expires_at: expiresAt,
            max_uses: maxUses,
            metadata: {
              ...(metadata || {}),
              issued_by: req.authUser.id,
              issued_by_role: req.authUser.role,
              gate_id: gate_id || null,
            },
          },
        ])
        .select('id,expires_at,max_uses')
        .single();

      if (insertError?.code === '23505') {
        return res.status(409).json({ error: 'active_coupon_already_exists' });
      }
      if (insertError || !insertedCoupon) {
        console.error('❌ [Coupon issue insert error]:', insertError?.message || 'Insert failed');
        return res.status(500).json({ error: 'Internal server error' });
      }

      // (5) Generate QR payload TANPA PII
      const qrText = `SR1:${token}`;
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
      });

      return res.status(201).json({
        coupon_id: insertedCoupon.id,
        expires_at: insertedCoupon.expires_at ?? expiresAt,
        max_uses: insertedCoupon.max_uses ?? maxUses,
        qr_text: qrText,
        qr_data_url: qrDataUrl,
      });
    } catch (err) {
      return next(err);
    }
  }
);

app.post(
  '/api/coupons/scan',
  scanLimiter,
  authenticateUser,
  requireRole(ROLE_MATRIX.scan),
  async (req, res, next) => {
    try {
      const parsed = scanCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        console.warn('⚠️ [Coupon scan invalid body] prefix:', tokenPrefix(req.body?.token));
        return res.status(400).json({ error: 'Invalid request' });
      }

      const token = normalizeScanned(parsed.data.token);
      if (!token) {
        console.warn('⚠️ [Coupon scan invalid token format] prefix:', tokenPrefix(parsed.data.token));
        return res.status(400).json({ error: 'Invalid request' });
      }

      const tokenHash = hashToken(token);

      const { data, error } = await supabaseAdmin.rpc('consume_coupon', {
        p_token_hash: tokenHash,
        p_gate_id: parsed.data.gate_id || null,
        p_scanner_user_id: req.authUser.id,
        p_ip: req.ip || null,
        p_user_agent: (req.get('user-agent') || '').slice(0, 256),
      });

      if (error) {
        console.error('❌ [Coupon scan RPC error]:', error.message, 'prefix:', token.slice(0, 8));
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (data?.valid === true) {
        // TODO: Integrasi hardware & notifikasi saat QR valid — HARUS via backend/Edge Function,
        // JANGAN pernah memanggil kunci admin backend (privilege tinggi) dari client/frontend:
        // 1. Trigger buka servo/turnstile gerbang sesuai p_gate_id
        // 2. Kirim notifikasi WhatsApp check-in tamu ke wali/pengasuhan
        // 3. Insert catatan lintasan ke tabel public.gate_logs melalui backend/Edge Function
        return res.status(200).json({
          valid: true,
          message: 'QR valid dan berhasil dipakai',
          coupon_id: data.coupon_id,
          visitor_name: data.visitor_name,
          permit_id: data.permit_id,
          remaining_uses: data.remaining_uses,
          expires_at: data.expires_at,
        });
      }

      return res.status(403).json({
        valid: false,
        message: 'QR tidak valid, sudah dipakai, atau kedaluwarsa',
      });
    } catch (err) {
      return next(err);
    }
  }
);

app.post(
  '/api/coupons/revoke',
  authenticateUser,
  requireRole(ROLE_MATRIX.revoke),
  async (req, res, next) => {
    try {
      const parsed = revokeCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request' });
      }

      const { data: revokedRows, error: revokeError } = await supabaseAdmin
        .from('visitor_coupons')
        .update({ status: 'revoked' })
        .eq('id', parsed.data.coupon_id)
        .in('status', ['issued', 'expired'])
        .select('id,status');

      if (revokeError) {
        console.error('❌ [Coupon revoke error]:', revokeError.message);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!revokedRows || revokedRows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }

      const revoked = revokedRows[0];
      return res.status(200).json({
        success: true,
        coupon_id: revoked.id,
        status: revoked.status,
      });
    } catch (err) {
      return next(err);
    }
  }
);

// -------------------------------------------------------------------------------------
// AUTH: LOGIN ENDPOINT (Semua Role & Demo Fallback)
// -------------------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  // Alias mapping untuk kemudahan input user
  const aliasMap = {
    'musyrif': 'musyrif01',
    'wali': 'walisantri01',
    'walisantri': 'walisantri01',
    'admin': 'superadmin',
    'admin_riayah': 'riayah01',
    'riayah': 'riayah01',
    'satpam': 'satpam01',
    'mudir': 'mudir01',
  };
  const targetUser = aliasMap[cleanUser] || cleanUser;

  try {
    // 1. Cek ke tabel users di database
    const result = await query(
      `SELECT u.id, u.username, u.nama_lengkap, u.email, r.nama_role, u.password_hash
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (LOWER(u.username) = $1 OR LOWER(u.username) = $2 OR LOWER(u.email) = $1)
         AND (u.is_active IS NULL OR u.is_active = true)`,
      [cleanUser, targetUser]
    );

    if (result.rowCount > 0) {
      const user = result.rows[0];
      // Cek password: password_hash di DB, atau cocok dengan demo '123' / 'demo'
      const isPassValid =
        user.password_hash === cleanPass ||
        user.password_hash === cleanUser ||
        cleanPass === `${user.username}123` ||
        cleanPass === `${cleanUser}123` ||
        cleanPass === 'demo';

      if (isPassValid) {
        return res.json({
          success: true,
          message: 'Login berhasil',
          data: {
            id: user.id,
            namaLengkap: user.nama_lengkap || user.username,
            username: user.username,
            email: user.email,
            role: user.nama_role || role || 'User',
            token: `SR-${user.id}-${Date.now()}`,
          },
        });
      }
    }
  } catch (dbErr) {
    console.warn('⚠️  DB query error di auth:', dbErr.message);
  }

  // 2. Demo accounts fallback (jika belum ada di DB atau kredensial demo dipakai)
  const demoAccounts = {
    musyrif:     { nama: 'Ust. Ahmad Musyrif',  pass: ['musyrif123', 'musyrif01', 'demo'], role: 'Musyrif' },
    musyrif01:   { nama: 'Ust. Ahmad Musyrif',  pass: ['musyrif01', 'musyrif123', 'demo'], role: 'Musyrif' },
    wali:        { nama: 'Hj. Mardiah (Wali Nurmiyaty)', pass: ['wali123', 'walisantri01', 'demo'], role: 'Wali Santri' },
    walisantri01:{ nama: 'Hj. Mardiah (Wali Nurmiyaty)', pass: ['walisantri01', 'wali123', 'demo'], role: 'Wali Santri' },
    admin:       { nama: 'Admin Sistem',        pass: ['admin123', 'superadmin01', 'demo'],role: 'Admin' },
    superadmin:  { nama: 'Super Admin IT',      pass: ['superadmin01', 'admin123', 'demo'],role: 'Super Admin' },
    riayah01:    { nama: 'Ustdzh. Siti Ri\'ayah',pass: ['riayah01', 'admin123', 'demo'],   role: 'Admin Ri\'ayah' },
    admin_riayah:{ nama: 'Ustdzh. Siti Ri\'ayah',pass: ['riayah01', 'admin123', 'demo'],   role: 'Admin Ri\'ayah' },
    mudir:       { nama: 'KH. M. Mudir Ulum',   pass: ['mudir01', 'mudir123', 'demo'],     role: 'Mudir' },
    mudir01:     { nama: 'KH. M. Mudir Ulum',   pass: ['mudir01', 'mudir123', 'demo'],     role: 'Mudir' },
    satpam:      { nama: 'Pak Joko Satpam Gate', pass: ['satpam01', 'satpam123', 'demo'],   role: 'Satpam' },
    satpam01:    { nama: 'Pak Joko Satpam Gate', pass: ['satpam01', 'satpam123', 'demo'],   role: 'Satpam' },
    nurmiyaty:   { nama: 'Nurmiyaty',           pass: ['nurmiyaty123', 'demo', '123456'],  role: 'Santri' },
    santri:      { nama: 'Nurmiyaty',           pass: ['santri123', 'santri', 'demo', 'nurmiyaty123'], role: 'Santri' },
    demo:        { nama: 'Demo User',           pass: ['demo', '123456'],                  role: role || 'Admin' },
  };

  const acc = demoAccounts[cleanUser] || demoAccounts[targetUser];
  if (acc && (acc.pass.includes(cleanPass) || cleanPass === 'demo')) {
    return res.json({
      success: true,
      message: 'Login berhasil (demo mode)',
      data: {
        namaLengkap: acc.nama,
        username: cleanUser,
        role: acc.role,
        token: `DEMO-${Date.now()}`,
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Username atau password salah. Coba: musyrif / musyrif123 atau musyrif01 / musyrif01',
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logout berhasil' });
});



// -------------------------------------------------------------------------------------
// 1. DATA MASTER: SANTRI
// -------------------------------------------------------------------------------------
app.get('/api/santri', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nis, nama_lengkap, gender, kelas, kamar, rfid_uid, nama_wali, no_wali, saldo_rfid, poin_disiplin, status_asrama FROM santri ORDER BY nama_lengkap ASC'
    );
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 1B. DATA MASTER: ROOMS & KAMAR (Sinkronisasi Otomatis PostgreSQL / pgAdmin)
// -------------------------------------------------------------------------------------
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, skor_kerapian_terakhir, jadwal_piket_hari_ini, catatan_inspeksi, created_at, updated_at FROM rooms ORDER BY id ASC'
    );
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ [GET /api/rooms Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const r = req.body;
    if (!r || !r.id) {
      return res.status(400).json({ success: false, message: 'ID Kamar wajib disertakan' });
    }

    const id = String(r.id);
    const namaGedung = r.namaGedung || r.nama_gedung || 'Asrama Santri';
    const kategoriGedung = r.kategoriGedung || r.kategori_gedung || 'PUTRA';
    const nomorKamar = r.nomorKamar || r.nomor_kamar || id;
    const lantai = parseInt(r.lantai || 1, 10);
    const kapasitas = parseInt(r.kapasitas || 8, 10);
    const terisi = parseInt(r.terisi !== undefined ? r.terisi : 0, 10);
    const ketuaKamar = r.ketuaKamar || r.ketua_kamar || 'Belum Ditentukan';
    const catatanInspeksi = r.catatanInspeksi || r.catatan_inspeksi || 'Kamar siap huni.';
    const skorKerapian = parseInt(r.skorKerapianTerakhir ?? r.skor_kerapian_terakhir ?? 90, 10);
    const jadwalPiket = r.jadwalPiketHariIni || r.jadwal_piket_hari_ini || 'Jadwal Reguler';

    // 1. Upsert tabel rooms di PostgreSQL
    const sqlRooms = `
      INSERT INTO rooms (
        id, nama_gedung, kategori_gedung, nomor_kamar, lantai, kapasitas, terisi, ketua_kamar, skor_kerapian_terakhir, jadwal_piket_hari_ini, catatan_inspeksi, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        nama_gedung = EXCLUDED.nama_gedung,
        kategori_gedung = EXCLUDED.kategori_gedung,
        nomor_kamar = EXCLUDED.nomor_kamar,
        lantai = EXCLUDED.lantai,
        kapasitas = EXCLUDED.kapasitas,
        terisi = EXCLUDED.terisi,
        ketua_kamar = EXCLUDED.ketua_kamar,
        catatan_inspeksi = EXCLUDED.catatan_inspeksi,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const resRooms = await query(sqlRooms, [
      id, namaGedung, kategoriGedung, nomorKamar, lantai, kapasitas, terisi, ketuaKamar, skorKerapian, jadwalPiket, catatanInspeksi
    ]);

    // 2. Sync juga ke tabel kamar di PostgreSQL
    const sqlKamar = `
      UPDATE kamar SET
        nama_kamar = $1,
        asrama = $2,
        lantai = $3,
        kapasitas = $4,
        terisi = $5,
        ketua = $6,
        catatan = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE kamar_id = $8 OR id::text = $8;
    `;
    await query(sqlKamar, [
      nomorKamar, namaGedung, lantai, kapasitas, terisi, ketuaKamar, catatanInspeksi, id
    ]).catch(e => console.warn('Sync kamar table warning:', e.message));

    console.log(`✅ [PostgreSQL] Kamar ${id} (${nomorKamar}) berhasil disimpan otomatis ke pgAdmin & database.`);
    return res.json({
      success: true,
      message: `Kamar ${id} berhasil diperbarui di database PostgreSQL`,
      data: resRooms.rows[0]
    });
  } catch (err) {
    console.error('❌ [POST /api/rooms Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------------------------
// 2. DATA MASTER: USERS (PENGGUNA / EVALUATOR)
// -------------------------------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.nama_lengkap, u.email, r.nama_role, u.is_active 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       ORDER BY u.nama_lengkap ASC`
    );
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data users',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 3. GET /api/evaluasi: MENGAMBIL DAFTAR EVALUASI SANTRI
// Parameter Opsional Query: ?santri_id=S-101 & ?tanggal=2026-10-19 & ?limit=50
// -------------------------------------------------------------------------------------
app.get('/api/evaluasi', async (req, res) => {
  try {
    const { santri_id, tanggal, limit = 50 } = req.query;
    const conditions = [];
    const params = [];

    if (santri_id) {
      params.push(santri_id);
      conditions.push(`e.santri_id = $${params.length}`);
    }

    if (tanggal) {
      params.push(tanggal);
      conditions.push(`e.tanggal = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10));
    const limitClause = `LIMIT $${params.length}`;

    const sql = `
      SELECT 
        e.id,
        e.santri_id,
        s.nis AS santri_nis,
        s.nama_lengkap AS santri_nama,
        s.kelas AS santri_kelas,
        s.kamar AS santri_kamar,
        e.tanggal,
        e.shalat_subuh,
        e.shalat_dzuhur,
        e.shalat_ashar,
        e.shalat_maghrib,
        e.shalat_isya,
        e.tahfidz_surah,
        e.tahfidz_ayat,
        e.tahfidz_nilai,
        e.skor_kedisiplinan,
        e.kebersihan_kamar,
        e.catatan_perilaku,
        e.rekomendasi_ai,
        e.evaluator_id,
        u.nama_lengkap AS evaluator_nama,
        e.created_at,
        e.updated_at
      FROM evaluasi_harian e
      JOIN santri s ON e.santri_id = s.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      ${whereClause}
      ORDER BY e.tanggal DESC, e.created_at DESC
      ${limitClause}
    `;

    const result = await query(sql, params);
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data evaluasi santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 4. GET /api/evaluasi/:santri_id: MENGAMBIL RIWAYAT EVALUASI SANTRI TERTENTU
// -------------------------------------------------------------------------------------
app.get('/api/evaluasi/:santri_id', async (req, res) => {
  try {
    const { santri_id } = req.params;
    const sql = `
      SELECT 
        e.*,
        s.nama_lengkap AS santri_nama,
        s.nis AS santri_nis,
        s.kelas AS santri_kelas,
        s.kamar AS santri_kamar,
        u.nama_lengkap AS evaluator_nama
      FROM evaluasi_harian e
      JOIN santri s ON e.santri_id = s.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      WHERE e.santri_id = $1
      ORDER BY e.tanggal DESC, e.created_at DESC
    `;

    const result = await query(sql, [santri_id]);
    res.json({
      success: true,
      santri_id,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Gagal mengambil riwayat evaluasi santri ${req.params.santri_id}`,
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 5. POST /api/evaluasi: MENYIMPAN / MEMPERBARUI (UPSERT) DATA EVALUASI SANTRI
// -------------------------------------------------------------------------------------
app.post('/api/evaluasi', async (req, res) => {
  try {
    const {
      santri_id,
      tanggal,
      shalat_subuh = 'Berjamaah',
      shalat_dzuhur = 'Berjamaah',
      shalat_ashar = 'Berjamaah',
      shalat_maghrib = 'Berjamaah',
      shalat_isya = 'Berjamaah',
      tahfidz_surah = 'An-Naba',
      tahfidz_ayat = '1-10',
      tahfidz_nilai = 'A',
      skor_kedisiplinan = 90,
      kebersihan_kamar = 90,
      catatan_perilaku = '',
      rekomendasi_ai = '',
      evaluator_id = null
    } = req.body;

    if (!santri_id) {
      return res.status(400).json({
        success: false,
        message: 'Parameter santri_id wajib diisi!'
      });
    }

    const targetDate = tanggal || new Date().toISOString().split('T')[0];

    // Cek keberadaan santri
    const santriCheck = await query('SELECT id FROM santri WHERE id = $1', [santri_id]);
    if (santriCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Santri dengan ID '${santri_id}' tidak ditemukan di database`
      });
    }

    // Query UPSERT (Insert atau Update bila santri & tanggal sudah ada)
    const sql = `
      INSERT INTO evaluasi_harian (
        santri_id, tanggal, 
        shalat_subuh, shalat_dzuhur, shalat_ashar, shalat_maghrib, shalat_isya,
        tahfidz_surah, tahfidz_ayat, tahfidz_nilai,
        skor_kedisiplinan, kebersihan_kamar,
        catatan_perilaku, rekomendasi_ai, evaluator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (santri_id, tanggal) 
      DO UPDATE SET
        shalat_subuh = EXCLUDED.shalat_subuh,
        shalat_dzuhur = EXCLUDED.shalat_dzuhur,
        shalat_ashar = EXCLUDED.shalat_ashar,
        shalat_maghrib = EXCLUDED.shalat_maghrib,
        shalat_isya = EXCLUDED.shalat_isya,
        tahfidz_surah = EXCLUDED.tahfidz_surah,
        tahfidz_ayat = EXCLUDED.tahfidz_ayat,
        tahfidz_nilai = EXCLUDED.tahfidz_nilai,
        skor_kedisiplinan = EXCLUDED.skor_kedisiplinan,
        kebersihan_kamar = EXCLUDED.kebersihan_kamar,
        catatan_perilaku = EXCLUDED.catatan_perilaku,
        rekomendasi_ai = EXCLUDED.rekomendasi_ai,
        evaluator_id = COALESCE(EXCLUDED.evaluator_id, evaluasi_harian.evaluator_id),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      santri_id,
      targetDate,
      shalat_subuh,
      shalat_dzuhur,
      shalat_ashar,
      shalat_maghrib,
      shalat_isya,
      tahfidz_surah,
      tahfidz_ayat,
      tahfidz_nilai,
      parseInt(skor_kedisiplinan, 10) || 90,
      parseInt(kebersihan_kamar, 10) || 90,
      catatan_perilaku,
      rekomendasi_ai,
      evaluator_id ? parseInt(evaluator_id, 10) : null
    ];

    const result = await query(sql, values);

    res.status(201).json({
      success: true,
      message: 'Evaluasi harian santri berhasil disimpan ke PostgreSQL',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan data evaluasi santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 6. DELETE /api/evaluasi/:id: MENGHAPUS REKORD EVALUASI
// -------------------------------------------------------------------------------------
app.delete('/api/evaluasi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM evaluasi_harian WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Evaluasi dengan ID ${id} tidak ditemukan`
      });
    }

    res.json({
      success: true,
      message: `Evaluasi ID ${id} berhasil dihapus`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus evaluasi santri',
      error: err.message
    });
  }
});

// -------------------------------------------------------------------------------------
// 7. REST API MODUL SMART PERMIT (FLUTTER / MOBILE COMPATIBLE)
// -------------------------------------------------------------------------------------
async function resolveDynamicWaliName(santriId) {
  try {
    const { data: profileWali, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('nama_lengkap, roles!inner(nama_role)')
      .eq('roles.nama_role', 'walisantri')
      .limit(1)
      .maybeSingle();

    if (!profileErr && profileWali?.nama_lengkap) {
      return `${profileWali.nama_lengkap} (Wali)`;
    }

    if (santriId) {
      const { data: santriRow, error: santriErr } = await supabaseAdmin
        .from('santri')
        .select('nama_wali')
        .eq('id', santriId)
        .maybeSingle();

      if (!santriErr && santriRow?.nama_wali) {
        return `${santriRow.nama_wali} (Wali)`;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Permits] Gagal mengambil nama wali dinamis dari Supabase:', err?.message || err);
  }
  return 'Wali Santri';
}

let inMemoryPermits = [
  {
    id: 'PRM-001',
    tokenIzin: 'SIP-9021',
    santriId: 'S-101',
    santriNama: 'Ahmad Fauzi',
    kategori: 'Pesiar',
    keperluan: 'Beli kitab kuning dan keperluan asrama di kota',
    penjemput: 'Wali Santri',
    waktuKeluarRencana: new Date().toISOString(),
    batasKembali: new Date(Date.now() + 4 * 3600000).toISOString(),
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  },
  {
    id: 'PRM-002',
    tokenIzin: 'SIP-9022',
    santriId: 'S-102',
    santriNama: 'Muhammad Zaki',
    kategori: 'Keluarga',
    keperluan: 'Acara pernikahan kakak kandung di Surabaya',
    penjemput: 'Bapak H. Ridwan (Ayah)',
    waktuKeluarRencana: new Date().toISOString(),
    batasKembali: new Date(Date.now() + 48 * 3600000).toISOString(),
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  }
];

resolveDynamicWaliName('S-101')
  .then((resolvedName) => {
    if (inMemoryPermits[0]?.id === 'PRM-001' && inMemoryPermits[0]?.penjemput === 'Wali Santri') {
      inMemoryPermits[0].penjemput = resolvedName;
    }
  })
  .catch(() => {});

app.get('/api/permits', async (req, res) => {
  const { status, santriId } = req.query;
  if (inMemoryPermits[0]?.id === 'PRM-001' && inMemoryPermits[0]?.penjemput === 'Wali Santri') {
    inMemoryPermits[0].penjemput = await resolveDynamicWaliName(inMemoryPermits[0].santriId);
  }
  let list = [...inMemoryPermits];
  if (status) list = list.filter(p => p.status === status);
  if (santriId) list = list.filter(p => p.santriId === santriId);
  res.json({ success: true, total: list.length, data: list });
});

app.post('/api/permits', (req, res) => {
  const { santriId, kategori, keperluan, penjemput, batasKembali, waktuKeluarRencana } = req.body;
  if (!santriId || !keperluan) {
    return res.status(400).json({ success: false, message: 'santriId dan keperluan wajib diisi' });
  }

  const newPermit = {
    id: `PRM-${Date.now().toString().slice(-4)}`,
    tokenIzin: `SIP-${Math.floor(1000 + Math.random() * 9000)}`,
    santriId,
    santriNama: req.body.santriNama || 'Santri Terdaftar',
    kategori: kategori || 'Pesiar',
    keperluan,
    penjemput: penjemput || 'Wali Santri',
    waktuKeluarRencana: waktuKeluarRencana || new Date().toISOString(),
    batasKembali: batasKembali || new Date(Date.now() + 4 * 3600000).toISOString(),
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  inMemoryPermits.unshift(newPermit);
  res.status(201).json({ success: true, message: 'Izin berhasil diajukan', data: newPermit });
});

app.post('/api/permits/:id/approve', (req, res) => {
  const { id } = req.params;
  const permit = inMemoryPermits.find(p => p.id === id);
  if (!permit) return res.status(404).json({ success: false, message: 'Izin tidak ditemukan' });

  permit.status = 'APPROVED';
  permit.catatanMusyrif = req.body.catatanMusyrif || 'Disetujui. Harap taati batas waktu.';
  permit.approvedAt = new Date().toISOString();
  res.json({ success: true, message: 'Izin disetujui & disinkronkan ke IoT Gate', data: permit });
});

app.post('/api/permits/:id/reject', (req, res) => {
  const { id } = req.params;
  const permit = inMemoryPermits.find(p => p.id === id);
  if (!permit) return res.status(404).json({ success: false, message: 'Izin tidak ditemukan' });

  permit.status = 'REJECTED';
  permit.alasanPenolakan = req.body.alasanPenolakan || 'Alasan penolakan pengasuhan.';
  res.json({ success: true, message: 'Izin ditolak', data: permit });
});

// -------------------------------------------------------------------------------------
// 8. REST API IOT SMART TURNSTILE GATE (VERIFIKASI RFID RC522)
// -------------------------------------------------------------------------------------
let inMemoryGateLogs = [
  { id: 'GL-1', rfidUid: '04:A1:2B:9C', santriNama: 'Ahmad Fauzi', direction: 'EXIT', status: 'GRANTED', gateId: 'GATE-01', timestamp: new Date().toISOString() }
];

app.post('/api/gate/verify-rfid', (req, res) => {
  const { rfidUid, gateId = 'GATE-01', direction = 'EXIT' } = req.body;
  if (!rfidUid) return res.status(400).json({ success: false, message: 'rfidUid wajib disertakan' });

  // Cari izin aktif
  const hasApprovedPermit = inMemoryPermits.some(p => p.status === 'APPROVED' || p.status === 'ACTIVE');
  const isGranted = rfidUid === '04:A1:2B:9C' || rfidUid === '53:57:98:0F' || hasApprovedPermit;

  const logEntry = {
    id: `GL-${Date.now().toString().slice(-4)}`,
    rfidUid,
    santriNama: rfidUid === '04:A1:2B:9C' ? 'Ahmad Fauzi' : 'Santri Terdaftar',
    direction,
    status: isGranted ? 'GRANTED' : 'DENIED',
    gateId,
    timestamp: new Date().toISOString()
  };
  inMemoryGateLogs.unshift(logEntry);

  res.json({
    accessGranted: isGranted,
    direction,
    rfidUid,
    gateId,
    oledDisplay: {
      line1: isGranted ? 'AKSES DIBERIKAN' : 'AKSES DITOLAK',
      line2: isGranted ? 'SILAKAN MELINTAS' : 'IZIN TIDAK VALID',
      buzzer: isGranted ? 'BEEP_SUCCESS' : 'ALARM_LONG'
    },
    log: logEntry
  });
});

app.get('/api/gate/logs', (req, res) => {
  res.json({ success: true, total: inMemoryGateLogs.length, data: inMemoryGateLogs });
});

app.get('/api/gate/headcount', (req, res) => {
  const totalSantri = 1482;
  const diLuar = inMemoryPermits.filter(p => p.status === 'ACTIVE').length;
  res.json({
    totalSantri,
    diAsrama: totalSantri - diLuar,
    diLuar,
    persentaseAsrama: (((totalSantri - diLuar) / totalSantri) * 100).toFixed(1)
  });
});

// Global Error Handler (generik, tidak membocorkan stack trace ke client)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.error('❌ [Unhandled Error]:', err?.message || 'Unknown error');
  return res.status(500).json({ error: 'Internal server error' });
});

// Jalankan Server Backend
app.listen(PORT, () => {
  console.log(`🚀 [Smart Riayah Backend] Server aktif di: http://localhost:${PORT}`);
  console.log(`🎟️  [API Endpoint] Visitor Coupon: http://localhost:${PORT}/api/coupons`);
  console.log(`📡 [API Endpoint] Evaluasi Santri: http://localhost:${PORT}/api/evaluasi`);
  console.log(`📡 [API Endpoint] Smart Permit: http://localhost:${PORT}/api/permits`);
  console.log(`📡 [API Endpoint] IoT Gate: http://localhost:${PORT}/api/gate/verify-rfid`);
  console.log(`🩺 [API Health] Status DB: http://localhost:${PORT}/api/health`);
});


export default app;
