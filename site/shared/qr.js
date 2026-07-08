/**
 * Thin wrapper over the vendored Nayuki qrcodegen (MIT — see
 * qrcodegen.LICENSE). ECC LOW: our URLs stay well inside byte-mode capacity
 * (~2.9k chars), and the coarser grid scans better from screens.
 */
import qrcodegen from './qrcodegen.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function qrMatrix(text) {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.LOW);
  return { size: qr.size, get: (x, y) => qr.getModule(x, y) };
}

/** Renders an SVG QR (crisp at any scale, prints cleanly) into el. */
export function renderQrInto(el, text) {
  const m = qrMatrix(text);
  const quiet = 2;
  const dim = m.size + quiet * 2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${dim} ${dim}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code for this receipt link');
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(dim));
  bg.setAttribute('height', String(dim));
  bg.setAttribute('fill', '#fff');
  let d = '';
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (m.get(x, y)) d += `M${x + quiet},${y + quiet}h1v1h-1z`;
    }
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000');
  svg.append(bg, path);
  el.replaceChildren(svg);
}

/** Draws the QR onto a canvas 2D context at (x, y), sized to `px`. */
export function drawQrOnCanvas(ctx, text, x, y, px) {
  const m = qrMatrix(text);
  const quiet = 2;
  const dim = m.size + quiet * 2;
  const cell = px / dim;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, px, px);
  ctx.fillStyle = '#000';
  for (let my = 0; my < m.size; my++) {
    for (let mx = 0; mx < m.size; mx++) {
      if (m.get(mx, my)) {
        // Snap to whole pixels to avoid hairline gaps between modules.
        const px0 = Math.floor(x + (mx + quiet) * cell);
        const py0 = Math.floor(y + (my + quiet) * cell);
        const px1 = Math.ceil(x + (mx + quiet + 1) * cell);
        const py1 = Math.ceil(y + (my + quiet + 1) * cell);
        ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
      }
    }
  }
}
