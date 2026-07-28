/* First-party ad slot. Privacy-first: no third-party ad JS, no CSP loosening —
 * the markup and (for now) the content are all same-origin. It renders into any
 * `<div class="ad-slot">` and is placed ONLY on marketing/landing pages, never
 * over an editor or the client-facing viewer (r.html).
 *
 * Rotates HOUSE_ADS (self-promo) plus any ACTIVATED affiliate slots. Affiliates
 * are the main monetization on the SEO landing pages; they stay OUT of rotation
 * until you paste a real tracking link (see AFFILIATE_ADS below), so nothing
 * fake or mislabeled ever renders. */

const HOUSE_ADS = [
  { text: 'Need a receipt too? The receipt maker works exactly the same way.', href: '/receipt', cta: 'Make a receipt' },
  { text: 'Quotes and estimates, the same link-native way.', href: '/quote', cta: 'Make a quote' },
  { text: 'Browse free invoice templates by trade.', href: '/invoice-templates', cta: 'See templates' },
];

/* AFFILIATE slots — ready to earn the moment you have real links.
 * TO ACTIVATE one: replace its `href` with your affiliate/tracking link from the
 * program (e.g. Impact, PartnerStack, ShareASale, or the vendor's own program).
 * Until then it's filtered out (isActive) so it never shows. Once live it's
 * disclosed as "Sponsored" — an affiliate link is an FTC "material connection".
 * These are chosen for genuine relevance to someone making an invoice. */
const AFFILIATE_ADS = [
  { text: 'Get paid faster — add a card payment link (Stripe, PayPal, Wise) to your invoice.', href: 'REPLACE_WITH_YOUR_AFFILIATE_LINK', cta: 'Set up payments', external: true, sponsored: true },
  { text: 'Track income & expenses free with Wave accounting.', href: 'REPLACE_WITH_YOUR_AFFILIATE_LINK', cta: 'Try Wave free', external: true, sponsored: true },
  { text: 'Just starting out? Form your LLC online in minutes.', href: 'REPLACE_WITH_YOUR_AFFILIATE_LINK', cta: 'Start your LLC', external: true, sponsored: true },
];

const isActive = (a) => a.href && !/^REPLACE_WITH/.test(a.href);

function pool() {
  return [...HOUSE_ADS, ...AFFILIATE_ADS.filter(isActive)];
}

function pickAd() {
  const p = pool();
  if (!p.length) return null;
  // Rotate deterministically-ish per pageview; Math.random is fine in the browser.
  return p[Math.floor(Math.random() * p.length)];
}

export function renderAd(slot) {
  if (!slot) return;
  const ad = pickAd();
  if (!ad) return; // nothing to show → leave the slot empty (hidden via :empty)

  const link = document.createElement('a');
  link.className = 'ad';
  link.href = ad.href;
  if (ad.external) { link.target = '_blank'; link.rel = 'sponsored noopener noreferrer'; }

  const label = document.createElement('span');
  label.className = 'ad-label';
  // Honest labeling: affiliate/external = "Sponsored" (FTC); own tools = "More from us".
  label.textContent = ad.sponsored ? 'Sponsored' : 'More from InvoiceIguana';

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
