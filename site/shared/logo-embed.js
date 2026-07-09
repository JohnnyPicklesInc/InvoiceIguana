/**
 * Compresses a user-picked image file to a tiny embeddable logo: 64x64,
 * contain-fit over a white background, JPEG at ~70% quality. The result is
 * small enough to ride directly in the link (see wire.js's MAX_LOGO_B64 and
 * codec.js/invoice-codec.js's "l" compact key) instead of only supporting an
 * externally-hosted logo URL — nothing is ever contacted for this option.
 * Browser-only module (canvas, createImageBitmap) — not imported by the Node
 * selftest, same as export-png.js.
 */
import { MAX_LOGO_B64 } from './wire.js';

export { MAX_LOGO_B64 };

const SIZE = 64;
const QUALITY = 0.7;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Returns { dataB64 } on success, or { error } with a user-facing message. */
export async function compressLogoImage(file) {
  if (!file.type.startsWith('image/')) {
    return { error: 'That file doesn\'t look like an image.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That image file is too large to process (max 20 MB).' };
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: "Couldn't read that image file — try a different one." };
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const scale = Math.min(SIZE / bitmap.width, SIZE / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (SIZE - w) / 2, (SIZE - h) / 2, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY);
  });
  const dataB64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

  if (dataB64.length > MAX_LOGO_B64) {
    return { error: 'That image is still too large even at low resolution — try a simpler image, or use the logo URL option instead.' };
  }
  return { dataB64 };
}
