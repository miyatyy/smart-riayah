import React, { useEffect, useState } from 'react';
import {
  generateLocalQrDataUrl,
  generateLocalCode128DataUrl
} from '../../utils/barcodeUtils';

export function LocalQrImage({
  value,
  size = 320,
  alt = 'QR Code Gate Pass',
  className = '',
  fallbackSrc = ''
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    const text = String(value || '').trim();
    if (!text) {
      setSrc('');
      return () => { active = false; };
    }

    generateLocalQrDataUrl(text, size)
      .then((dataUrl) => {
        if (active && dataUrl) setSrc(dataUrl);
      })
      .catch(() => {
        if (active && fallbackSrc) setSrc(fallbackSrc);
      });

    return () => {
      active = false;
    };
  }, [value, size, fallbackSrc]);

  if (!src && !fallbackSrc) return null;

  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      loading="eager"
    />
  );
}

export function LocalCode128Image({
  value,
  width = 360,
  height = 84,
  includeText = true,
  alt = 'Barcode 128 Gate Pass',
  className = '',
  fallbackSrc = ''
}) {
  const [src, setSrc] = useState(() =>
    value ? generateLocalCode128DataUrl(value, width, height, includeText) : ''
  );

  useEffect(() => {
    const text = String(value || '').trim();
    if (!text) {
      setSrc('');
      return;
    }
    const localUrl = generateLocalCode128DataUrl(text, width, height, includeText);
    setSrc(localUrl || fallbackSrc || '');
  }, [value, width, height, includeText, fallbackSrc]);

  if (!src && !fallbackSrc) return null;

  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      loading="eager"
    />
  );
}

