import React, { useEffect, useState, memo } from 'react';
import {
  generateLocalQrDataUrl,
  generateLocalCode128DataUrl
} from '../../utils/barcodeUtils';

const qrCache = new Map();
const code128Cache = new Map();

export const LocalQrImage = memo(function LocalQrImage({
  value,
  size = 320,
  alt = 'QR Code Gate Pass',
  className = '',
  fallbackSrc = ''
}) {
  const text = String(value || '').trim();
  const cacheKey = `${text}_${size}`;
  const [src, setSrc] = useState(() => (text && qrCache.has(cacheKey) ? qrCache.get(cacheKey) : ''));

  useEffect(() => {
    let active = true;
    if (!text) {
      setSrc('');
      return () => { active = false; };
    }

    if (qrCache.has(cacheKey)) {
      setSrc(qrCache.get(cacheKey));
      return () => { active = false; };
    }

    generateLocalQrDataUrl(text, size)
      .then((dataUrl) => {
        if (active && dataUrl) {
          qrCache.set(cacheKey, dataUrl);
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (active && fallbackSrc) setSrc(fallbackSrc);
      });

    return () => {
      active = false;
    };
  }, [text, size, cacheKey, fallbackSrc]);

  if (!src && !fallbackSrc) {
    return (
      <div 
        className={`inline-block bg-slate-100/60 rounded border border-slate-200/50 ${className}`} 
        style={{ minWidth: 28, minHeight: 28 }}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      loading="eager"
    />
  );
});

export const LocalCode128Image = memo(function LocalCode128Image({
  value,
  width = 360,
  height = 84,
  includeText = true,
  alt = 'Barcode 128 Gate Pass',
  className = '',
  fallbackSrc = ''
}) {
  const text = String(value || '').trim();
  const cacheKey = `${text}_${width}_${height}_${includeText}`;
  const [src, setSrc] = useState(() => {
    if (!text) return '';
    if (code128Cache.has(cacheKey)) return code128Cache.get(cacheKey);
    const generated = generateLocalCode128DataUrl(text, width, height, includeText);
    if (generated) code128Cache.set(cacheKey, generated);
    return generated || '';
  });

  useEffect(() => {
    if (!text) {
      setSrc('');
      return;
    }
    if (code128Cache.has(cacheKey)) {
      setSrc(code128Cache.get(cacheKey));
      return;
    }
    const localUrl = generateLocalCode128DataUrl(text, width, height, includeText);
    if (localUrl) code128Cache.set(cacheKey, localUrl);
    setSrc(localUrl || fallbackSrc || '');
  }, [text, width, height, includeText, cacheKey, fallbackSrc]);

  if (!src && !fallbackSrc) {
    return (
      <div 
        className={`inline-block bg-slate-100/60 rounded border border-slate-200/50 ${className}`} 
        style={{ minWidth: 60, minHeight: 28 }}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={className}
      loading="eager"
    />
  );
});

