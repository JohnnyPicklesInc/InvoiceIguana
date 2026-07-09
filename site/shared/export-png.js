/**
 * PNG export — draws the receipt onto a canvas from the normalized data
 * (deterministic, no DOM screenshot) and returns a Blob. Uses the classic
 * thermal layout regardless of the on-screen template (per-template canvas
 * layouts are future work); honors accent color, emoji/image logo, QR,
 * branding. An externally-hosted logo image is drawn when the host allows
 * CORS; if it doesn't (canvas gets tainted), the export silently redraws
 * without the logo rather than failing the whole download.
 * Browser-only module (canvas) — not imported by the Node selftest.
 */
import { money } from './render.js';
import { drawQrOnCanvas } from './qr.js';

const W = 380;
const PAD = 26;
const CW = W - PAD * 2;
const SCALE = 2;

const MONO = 'Consolas, "Courier New", monospace';
const INK = '#222';
const FAINT = '#777';

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Loads an (often cross-origin) logo image for canvas use. `crossOrigin`
 * gives it a *chance* of not tainting the canvas if the host sends CORS
 * headers; there's no way to know that in advance, so callers must still
 * handle a tainted-canvas failure at export time.
 */
function loadLogoImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 5000); // don't hang the export forever
  });
}

function renderToBlob(r, qrText, logoImg) {
  // Measure pass on a throwaway context, then draw at the computed height.
  const measure = document.createElement('canvas').getContext('2d');
  const height = paint(measure, r, qrText, true, logoImg);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = Math.ceil(height) * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, W, height);
  paint(ctx, r, qrText, false, logoImg);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

export async function receiptToPngBlob(r, { qrText } = {}) {
  // Embedded logo (data:) takes priority over an external URL — same order
  // as shared/style.js — and never taints the canvas, so the CORS/tainted
  // fallback below only matters for the external-URL case.
  const logoSrc = r.logoData ? `data:image/jpeg;base64,${r.logoData}` : r.logoUrl;
  const logoImg = logoSrc ? await loadLogoImage(logoSrc) : null;
  try {
    return await renderToBlob(r, qrText, logoImg);
  } catch (e) {
    // A cross-origin logo without CORS headers taints the canvas, which
    // surfaces here as toBlob() resolving null (not as drawImage throwing).
    // Redraw without the logo rather than fail the whole download.
    if (!logoImg) throw e;
    return renderToBlob(r, qrText, null);
  }
}

/** Walks the layout; draws unless measuring. Returns total height. */
function paint(ctx, r, qrText, measuring, logoImg) {
  let y = PAD + 4;
  const center = (text, font, color, lineH) => {
    ctx.font = font;
    for (const line of wrap(ctx, text, CW)) {
      if (!measuring) {
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(line, W / 2, y);
      }
      y += lineH;
    }
  };
  const tear = () => {
    y += 6;
    if (!measuring) {
      ctx.save();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
      ctx.restore();
    }
    y += 20;
  };

  ctx.textBaseline = 'alphabetic';

  if (logoImg) {
    const w = Math.min(140, logoImg.naturalWidth || 140);
    const h = w * ((logoImg.naturalHeight || w) / (logoImg.naturalWidth || w));
    if (!measuring) ctx.drawImage(logoImg, (W - w) / 2, y, w, h);
    y += h + 8;
  } else if (r.emoji) {
    center(r.emoji, `26px ${MONO}`, INK, 34);
  }
  center(r.merchant.toUpperCase(), `bold 17px ${MONO}`, INK, 22);
  if (r.address) center(r.address, `11.5px ${MONO}`, FAINT, 16);
  if (r.contact) center(r.contact, `11.5px ${MONO}`, FAINT, 16);
  if (r.date) { y += 3; center(r.date, `11.5px ${MONO}`, FAINT, 16); }
  if (r.reference) center(r.reference, `11.5px ${MONO}`, FAINT, 16);

  tear();

  // Line items: wrapped name left, amount right on the first line.
  for (const it of r.items) {
    const label = it.qty > 1 ? `${it.name} ×${it.qty}` : it.name;
    const amount = money(it.qty * it.priceMinor, r.currency);
    ctx.font = `13px ${MONO}`;
    const amountW = ctx.measureText(amount).width;
    const lines = wrap(ctx, label, CW - amountW - 12);
    lines.forEach((line, i) => {
      if (!measuring) {
        ctx.fillStyle = INK;
        ctx.textAlign = 'left';
        ctx.fillText(line, PAD, y);
        if (i === 0) {
          ctx.textAlign = 'right';
          ctx.fillText(amount, W - PAD, y);
        }
      }
      y += 18;
    });
    if (it.qty > 1) {
      if (!measuring) {
        ctx.font = `10.5px ${MONO}`;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'left';
        ctx.fillText(`@ ${money(it.priceMinor, r.currency)}`, PAD, y - 3);
      }
      y += 13;
    }
  }

  tear();

  const row = (label, minor, big, prefix = '') => {
    ctx.font = `${big ? 'bold 15' : '13'}px ${MONO}`;
    if (!measuring) {
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText(label, PAD, y);
      ctx.textAlign = 'right';
      ctx.fillText(prefix + money(minor, r.currency), W - PAD, y);
    }
    y += big ? 22 : 18;
  };
  row('Subtotal', r.subtotalMinor);
  if (r.discountMinor != null) row('Discount', r.discountMinor, false, '-');
  if (r.taxMinor != null) row(r.taxLabel || 'Tax', r.taxMinor);
  if (r.tipMinor != null) row('Tip', r.tipMinor);
  y += 2;
  if (!measuring) {
    ctx.strokeStyle = r.accent ? `#${r.accent}` : INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 12);
    ctx.lineTo(W - PAD, y - 12);
    ctx.stroke();
  }
  y += 6;
  row('Total', r.totalMinor, true);

  if (r.payment) { y += 4; center(r.payment, `11.5px ${MONO}`, FAINT, 16); }

  tear();

  if (r.footer) { center(r.footer, `12px ${MONO}`, INK, 17); y += 4; }

  if (r.qr && qrText) {
    const size = 116;
    if (!measuring) drawQrOnCanvas(ctx, qrText, (W - size) / 2, y, size);
    y += size + 14;
  }

  if (!r.brandingOff) {
    center('made with InvoiceIguana 🦎', `10px ${MONO}`, FAINT, 14);
  }

  return y + PAD - 4;
}

/** Triggers a browser download of the receipt as PNG. */
export async function downloadReceiptPng(r, { qrText } = {}) {
  const blob = await receiptToPngBlob(r, { qrText });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = r.merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'receipt';
  a.download = `receipt-${slug}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
