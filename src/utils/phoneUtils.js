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

