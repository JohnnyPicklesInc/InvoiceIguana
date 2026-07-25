/* First-party ad slot. Privacy-first: no third-party ad JS, no CSP loosening —
 * the markup and (for now) the content are all same-origin. It renders into any
 * `<div class="ad-slot">` and is placed ONLY on marketing pages, never over an
 * editor or the client-facing viewer (r.html).
 *
 * v1 shows a rotating house ad (self-promo). The render path is structured so a
 * real ad can later come from a Cloudflare Pages Function without markup or CSP
 * changes: swap the HOUSE_ADS pick for `const ad = await (await fetch('/api/ad',
 * { headers: { accept: 'application/json' } })).json();` and allow-list nothing
 * else (creatives would still be first-party or already-allowed https images). */

const HOUSE_ADS = [
  { text: 'Need a receipt too? The receipt maker works exactly the same way.', href: '/receipt', cta: 'Make a receipt' },
  { text: 'Install InvoiceIguana — it works offline, straight from your home screen.', href: '/free-invoice-generator', cta: 'Open the app' },
  { text: 'Quotes and estimates, the same link-native way.', href: '/quote', cta: 'Make a quote' },
];

function pickAd() {
  // Rotate deterministically-ish per pageview; Math.random is fine in the browser.
  return HOUSE_ADS[Math.floor(Math.random() * HOUSE_ADS.length)];
}

export function renderAd(slot) {
  if (!slot) return;
  const ad = pickAd();
  if (!ad) return; // a real /api/ad returning null → leave the slot empty (hidden via :empty)

  const link = document.createElement('a');
  link.className = 'ad';
  link.href = ad.href;
  if (ad.external) { link.target = '_blank'; link.rel = 'noopener noreferrer nofollow'; }

  const label = document.createElement('span');
  label.className = 'ad-label';
  label.textContent = 'Sponsored';

  const text = document.createElement('span');
  text.className = 'ad-text';
  text.textContent = ad.text;

  const cta = document.createElement('span');
  cta.className = 'ad-cta';
  cta.textContent = `${ad.cta} →`;

  link.append(label, text, cta);
  slot.replaceChildren(link);
}

// Auto-fill every ad slot on the page (module scripts run after the DOM parses).
for (const slot of document.querySelectorAll('.ad-slot')) renderAd(slot);
