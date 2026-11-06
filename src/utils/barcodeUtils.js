/**
 * BARCODE & QR CODE GATE PASS GENERATOR UTILITY
 * Menghasilkan token resmi Gate Pass serta URL gambar QR Code & Barcode Code 128
 * yang 100% nyata dan dapat dipindai oleh scanner barcode USB / kamera smartphone.
 */

export function generateBarcodeToken(santriName = 'SANTRI') {
  const cleanName = (santriName || 'SANTRI').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase() || 'SANTRI';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `GP-DU-${cleanName}-${randomSuffix}`;
}

export function getBarcodeImageUrl(token, type = 'qr') {
  if (!token) return '';
  const encoded = encodeURIComponent(String(token).trim());
  if (type === '128' || type === 'barcode' || type === 'linear') {
    return `https://quickchart.io/barcode?type=code128&text=${encoded}&includeText=true&height=75`;
  }
  // Default: 2D QR Code
  return `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encoded}&format=png`;
}

export function getVisitGatePassUrls(token) {
  if (!token) {
    return {
      qrCodeUrl: '',
      linearBarcodeUrl: ''
    };
  }
  const encoded = encodeURIComponent(String(token).trim());
  return {
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encoded}&format=png`,
    linearBarcodeUrl: `https://quickchart.io/barcode?type=code128&text=${encoded}&includeText=true&height=75`
  };
}

/**
 * Download file gambar barcode / QR Code secara lokal ke perangkat user
 */
export async function downloadBarcodeImage(imageUrl, filename = 'Barcode_Gate_Pass.png') {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    // Fallback: buka di tab baru jika CORS membatasi fetch
    window.open(imageUrl, '_blank');
    return false;
  }
}
