/**
 * Utilitas Normalisasi & Pencocokan Nomor Telepon / WhatsApp Indonesia (08 / +628 / 628)
 */

/**
 * Mengubah format nomor HP/WhatsApp (awalan 08, +628, 00628, 6208, JID @s.whatsapp.net)
 * menjadi format kanonik internasional Indonesia `628...`.
 * Tetap mempertahankan ID Telegram berawalan `TG-`.
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // Pertahankan identifier Telegram
  if (trimmed.toUpperCase().startsWith('TG-')) {
    return trimmed;
  }

  // Buang suffix JID WhatsApp (@s.whatsapp.net, @c.us) & device suffix (:12)
  const cleanJid = trimmed.split('@')[0].split(':')[0];

  // Ambil digit saja (menghapus +, spasi, tanda hubung '-', kurung)
  let digits = cleanJid.replace(/[^0-9]/g, '');
  if (!digits) return '';

  // Normalisasi prefix internasional 0062... -> 62...
  if (digits.startsWith('0062')) {
    digits = '62' + digits.slice(4);
  }

  // Tangani salah ketik +6208... / 6208... -> 628...
  if (digits.startsWith('6208')) {
    digits = '628' + digits.slice(4);
  } else if (digits.startsWith('620')) {
    digits = '62' + digits.slice(3);
  }

  // Ubah awalan 08... -> 628..., 0... -> 62..., 8... -> 628...
  if (digits.startsWith('08')) {
    digits = '628' + digits.slice(2);
  } else if (digits.startsWith('0') && digits.length >= 9) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8') && digits.length >= 8) {
    digits = '628' + digits.slice(1);
  }

  return digits;
}

/**
 * Menghasilkan kedua format utama Indonesia (`628...` dan `08...`) serta variasi umum
 * untuk pencocokan query Supabase / pencarian kontak lokal.
 */
export function getPhoneVariants(raw) {
  const intl = normalizePhone(raw);
  if (!intl || intl.toUpperCase().startsWith('TG-')) {
    return {
      intl,
      local: '',
      plusIntl: '',
      bare: '',
      last8: '',
      last9: '',
      variants: intl ? [intl] : [],
    };
  }

  const local = intl.startsWith('62') ? '0' + intl.slice(2) : intl;
  const plusIntl = '+' + intl;
  const bare = intl.startsWith('62') ? intl.slice(2) : intl;
  const last8 = bare.length >= 8 ? bare.slice(-8) : intl.slice(-8);
  const last9 = bare.length >= 9 ? bare.slice(-9) : intl.slice(-9);
  const dashedLocal =
    local.length >= 10 ? `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}` : '';

  const variants = Array.from(
    new Set([intl, local, plusIntl, bare, dashedLocal].filter(Boolean))
  );

  return { intl, local, plusIntl, bare, last8, last9, variants };
}

/**
 * Mengecek apakah dua nomor telepon menunjuk ke nomor WA Indonesia yang sama
 * (mis. `08813576012`, `+628813576012`, dan `628813576012`).
 */
export function isSamePhone(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  if (na.toUpperCase().startsWith('TG-') || nb.toUpperCase().startsWith('TG-')) {
    return na.toUpperCase() === nb.toUpperCase();
  }

  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 8) {
    return na.slice(-8) === nb.slice(-8);
  }
  return false;
}

const MALE_TITLE_REGEX = /(?:^|\s)(?:bpk\.?|bapak|pak|ust\.?|ustadz|kh\.?|dr\.?\s*h\.?|ir\.?\s*h\.?|drs\.?|h\.)(?:\s|$)/i;
const FEMALE_TITLE_REGEX = /(?:^|\s)(?:ibu|bu|hj\.?|hajjah|usth\.?|ustadzah|nyai)(?:\s|$)/i;

const MALE_FIRST_NAMES = new Set([
  'ahmad', 'muhammad', 'mohammad', 'moh', 'muh', 'ali', 'umar', 'utsman', 'usman', 'hasan', 'husain',
  'husein', 'hendra', 'bambang', 'subroto', 'syamsudin', 'syamsuddin', 'fajar', 'rayhan', 'zaidan',
  'subhan', 'ridwan', 'mulyono', 'slamet', 'agus', 'budi', 'dedi', 'eko', 'rudi', 'yusuf', 'ibrahim',
  'ismail', 'mustofa', 'syukron', 'hasyim', 'hakim', 'fauzi', 'ilham', 'farhan', 'danial', 'habib',
  'wahyu', 'andi', 'dedy', 'heri', 'irfan', 'rizki', 'rizky', 'arif', 'arief', 'taufik', 'taufiq',
  'imam', 'lukman', 'luqman', 'salman', 'sulaiman', 'dawud', 'daud', 'zakaria', 'yahya', 'ilyas',
  'harun', 'musa', 'isa', 'adam', 'nuh', 'khalid', 'tariq', 'bilal', 'hamzah', 'abbas', 'jafar',
  'jaafar', 'abdullah', 'ubaidillah', 'habibullah', 'fadillah', 'hidayatullah', 'amanullah', 'amrullah',
  'putra', 'indra', 'bima', 'darma', 'arya', 'bagas', 'dimas', 'bayu', 'teguh', 'santoso', 'susanto',
  'wijaya', 'gunawan', 'sugianto', 'prasetyo', 'setiawan', 'hartono', 'suharto', 'supriadi', 'supriyadi',
  'suparno', 'sukarno', 'sudarsono', 'suprapto', 'rahmat', 'hidayat', 'kurniawan', 'pratama', 'nugroho',
  'surya', 'aditya', 'fachri', 'fahri', 'fikri', 'hanif', 'iqbal', 'reza', 'yoga', 'yogi', 'angga',
  'adi', 'ari', 'bayu', 'cahyo', 'doni', 'donny', 'edi', 'eddy', 'fendi', 'hendri', 'henry', 'joko',
  'kusuma', 'maulana', 'novan', 'okky', 'pandu', 'rendy', 'riko', 'sigit', 'toni', 'wahid', 'yanto',
]);

const FEMALE_FIRST_NAMES = new Set([
  'arbainah', 'arosinah', 'siti', 'aisyah', 'khadijah', 'aminah', 'halimah', 'fatimah', 'mariam', 'maryam',
  'zainab', 'nuraini', 'nur', 'dewi', 'sri', 'putri', 'rina', 'yuni', 'wati', 'fitri', 'fitriyah',
  'fitria', 'rahma', 'rahmawati', 'laila', 'layla', 'ratna', 'sari', 'anisa', 'annisa', 'nisa',
  'zahirah', 'zahra', 'hafsah', 'ruqayyah', 'ummu', 'sumayyah', 'salma', 'nadia', 'nadya', 'indah',
  'ayu', 'kartika', 'kartini', 'lestari', 'sulastri', 'sumarni', 'susilowati', 'yanti', 'santi',
  'wulandari', 'wulan', 'maya', 'meli', 'melati', 'mawar', 'anggun', 'intan', 'mutiara', 'permata',
  'safitri', 'saputri', 'puspita', 'utami', 'kusumawati', 'setyawati', 'widiyawati', 'widya', 'nia',
  'lia', 'ria', 'ika', 'eka', 'dina', 'diana', 'linda', 'rina', 'tina', 'mina', 'nina', 'hana',
  'salimah', 'karimah', 'latifah', 'hasanah', 'khazanah', 'mardiyah', 'sholihah', 'solehah', 'muslimah',
  'azizah', 'rohmah', 'rahmah', 'hikmah', 'nikmah', 'barokah', 'saadah', 'sakinah', 'fauziah',
  'nurul', 'nurhaliza', 'ummah', 'afifah', 'alifah', 'amalia', 'amanda', 'anggi', 'ani', 'asih',
  'astuti', 'atika', 'aulia', 'aziza', 'bella', 'citra', 'desy', 'desi', 'dian', 'dwi', 'elis', 'elly',
  'endah', 'endang', 'erna', 'eva', 'farah', 'febri', 'fira', 'gina', 'hani', 'hesti', 'ida', 'iin',
  'irma', 'ita', 'juli', 'komariah', 'qomariah', 'kurnia', 'lasmi', 'leni', 'murni', 'nani', 'neneng',
  'neti', 'novi', 'novita', 'nunu', 'nunung', 'oktaviani', 'puji', 'reni', 'resti', 'retno', 'risma',
  'rosida', 'rosyidah', 'rozi', 'rusmi', 'sifa', 'syifa', 'suci', 'sumiati', 'suryani', 'susanti',
  'tri', 'tutik', 'tuti', 'ulfa', 'ulfah', 'umi', 'ummi', 'vera', 'vina', 'vita', 'wiwik', 'yati',
  'yeni', 'yenny', 'yulia', 'yuliana', 'yulianti', 'yuniar', 'yunita', 'zulfah',
]);

function detectGenderFromSelfText(text) {
  const s = String(text || '').toLowerCase();
  if (!s) return null;

  const explicitMale =
    /\b(?:saya|aku|ana|sy|panggil(?:\s+saya)?|sebut(?:\s+saya)?|ini)\s+(?:pak|bapak|ayah|abi|abah|papa|om|mas)\b/i.test(s) ||
    /\b(?:ayahnya|bapaknya|abinya|walinya\s+(?:pak|bapak))\b/i.test(s) ||
    /\b(?:panggil|pangil)\s+pak\b/i.test(s);

  const explicitFemale =
    /\b(?:saya|aku|ana|sy|panggil(?:\s+saya)?|sebut(?:\s+saya)?|ini)\s+(?:bu|ibu|umi|ummi|mama|bunda|emak|mbak|tante)\b/i.test(s) ||
    /\b(?:ibunya|umminya|uminya|bundanya|mamanya|walinya\s+(?:bu|ibu))\b/i.test(s) ||
    /\b(?:panggil|pangil)\s+(?:bu|ibu)\b/i.test(s);

  if (explicitFemale && !explicitMale) return 'female';
  if (explicitMale && !explicitFemale) return 'male';
  return null;
}

function detectGenderFromWaliName(rawName, relationship = '') {
  const rel = String(relationship || '').toLowerCase();
  if (/\b(ibu|bunda|mama|umi|ummi)\b/i.test(rel)) return 'female';
  if (/\b(ayah|bapak|abi|abah|papa)\b/i.test(rel)) return 'male';

  const name = String(rawName || '').trim();
  if (!name || /^(?:wali\s+santri|bapak\/ibu(?:\s+wali(?:\s+santri)?)?|pengguna|user)$/i.test(name)) {
    return null;
  }

  // Cek gelar perempuan lebih dulu (Hj. harus dicek sebelum H.)
  if (FEMALE_TITLE_REGEX.test(name)) return 'female';
  if (MALE_TITLE_REGEX.test(name)) return 'male';

  // Bersihkan tanda baca dan pecah token nama
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const tok of tokens) {
    if (FEMALE_FIRST_NAMES.has(tok)) return 'female';
    if (MALE_FIRST_NAMES.has(tok)) return 'male';
  }

  const first = tokens[0] || '';
  if (first.length >= 4) {
    if (/(?:wati|ningsih|ningrum|yanti|santi|inah|imah|iyah|iyyah|ayah|idah|anah|unah)$/.test(first)) {
      return 'female';
    }
    if (/(?:udin|uddin|anto|ono|iman|arman|awan|iawan|ullah|illah)$/.test(first)) {
      return 'male';
    }
  }

  return null;
}

function extractCleanShortName(rawName) {
  let clean = String(rawName || '').trim();
  if (!clean) return '';
  if (/^(?:wali\s+santri|bapak\/ibu(?:\s+wali(?:\s+santri)?)?|pengguna|user)$/i.test(clean)) {
    return '';
  }
  // Buang awalan honorifik agar tidak dobel seperti "Bu Ibu Siti" atau "Pak Bpk. Hendra"
  clean = clean.replace(
    /^(?:(?:bpk\.?|bapak|pak|ibu|bu)\s+)+/i,
    ''
  ).trim();
  if (!clean) return '';
  // Ambil kata pertama yang representatif (atau gelar agama jika ada)
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^(?:h\.|hj\.|ust\.?|usth\.?|kh\.?|dr\.?|drs\.?|ir\.?)$/i.test(words[0])) {
    return `${words[0]} ${words[1]}`;
  }
  return words[0] || clean;
}

/**
 * Menentukan sapaan tepat ('Pak' vs 'Bu' vs 'Bapak/Ibu') dari percakapan, profil wali, dan nama terdaftar.
 */
export function resolveWaliAddressing(waliName = '', incomingText = '', recentHistory = [], santriData = null) {
  let detectedGender = null;

  // 1. Prioritas tertinggi: pesan terbaru / koreksi user di chat
  detectedGender = detectGenderFromSelfText(incomingText);

  if (!detectedGender && Array.isArray(recentHistory) && recentHistory.length > 0) {
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const entry = recentHistory[i];
      if (!entry || entry.role === 'assistant') continue;
      const g = detectGenderFromSelfText(entry.content || entry.message_text || entry.text || '');
      if (g) {
        detectedGender = g;
        break;
      }
    }
  }

  // 2. Nama wali terdaftar & hubungan di database
  const rel = santriData?.wali?.hubungan || santriData?.hubungan || '';
  if (!detectedGender) {
    detectedGender = detectGenderFromWaliName(waliName, rel);
  }

  const shortName = extractCleanShortName(waliName);

  if (detectedGender === 'male') {
    const panggilan = shortName ? `Pak ${shortName}` : 'Pak';
    return {
      gender: 'male',
      sapaan: 'Pak',
      formal: 'Bapak',
      panggilan,
      shortName,
    };
  }

  if (detectedGender === 'female') {
    const panggilan = shortName ? `Bu ${shortName}` : 'Bu';
    return {
      gender: 'female',
      sapaan: 'Bu',
      formal: 'Ibu',
      panggilan,
      shortName,
    };
  }

  return {
    gender: 'neutral',
    sapaan: 'Bapak/Ibu',
    formal: 'Bapak/Ibu',
    panggilan: shortName ? `Bapak/Ibu ${shortName}` : 'Bapak/Ibu',
    shortName,
  };
}

/**
 * Mengganti sisa frasa "Bapak/Ibu" pada teks balasan sesuai gender wali jika sudah teridentifikasi Pak/Bu.
 */
export function applySapaanToText(text, addr) {
  let out = String(text || '');
  if (!out || !addr || addr.gender === 'neutral') return out;

  const sapaan = addr.sapaan; // 'Pak' atau 'Bu'
  out = out
    .replace(/\bBapak\s*\/\s*Ibu\b/gi, sapaan)
    .replace(/\bBpk\.?\s*\/\s*Ibu\b/gi, sapaan)
    .replace(/\bBpk\.?\s*\/\s*Bu\b/gi, sapaan)
    .replace(/\bPak\s*\/\s*Bu\b/gi, sapaan);

  if (addr.gender === 'female') {
    out = out
      .replace(/\bBu\s+(?:Ibu|Bu)\b/gi, 'Bu')
      .replace(/\bIbu\s+(?:Ibu|Bu)\b/gi, 'Ibu');
  } else if (addr.gender === 'male') {
    out = out
      .replace(/\bPak\s+(?:Bpk\.?|Bapak|Pak)\b/gi, 'Pak')
      .replace(/\bBapak\s+(?:Bpk\.?|Bapak|Pak)\b/gi, 'Bapak');
  }

  return out;
}

