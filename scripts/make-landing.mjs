// Generates the "[trade] invoice template", "[trade] quote/estimate template",
// and "[type] receipt template" SEO landing pages + a hub per doc type, and
// rewrites site/sitemap.xml. Pure Node stdlib, no build step — run before commit:
//   node scripts/make-landing.mjs   (or: npm run landing)
//
// Data: scripts/trades.mjs (invoice), scripts/quotes.mjs, scripts/receipts.mjs.
// Each page mirrors index.html's marketing layout (theme.css + landing.css only)
// and respects the strict CSP: no inline styles/JS, only same-origin assets +
// inline application/ld+json. Deep-links pre-fill each generator's AI box via ?prompt=.

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trades, SITE } from './trades.mjs';
import { quotes } from './quotes.mjs';
import { receipts } from './receipts.mjs';
import { billsOfSale } from './bill-of-sale.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = join(ROOT, 'site');

// --- helpers ---------------------------------------------------------------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const money = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  const [i, d] = s.split('.');
  return '$' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
};
const ld = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const HUBS = [
  { slug: 'invoice-templates', label: 'Invoice templates' },
  { slug: 'quote-templates', label: 'Quote templates' },
  { slug: 'receipt-templates', label: 'Receipt templates' },
  { slug: 'bill-of-sale-templates', label: 'Bill of sale templates' },
];

// --- shared markup ---------------------------------------------------------
const header = (current = '') => `  <header class="site-header">
    <a class="wordmark" href="/"><span class="lizard">🦎</span><span class="name">InvoiceIguana</span></a>
    <nav>
      <a href="/free-invoice-generator">Invoice</a>
      <a href="/receipt">Receipt</a>
      <a href="/quote">Quote</a>
      <a href="/invoice-templates"${current === 'templates' ? ' aria-current="page"' : ''}>Templates</a>
    </nav>
  </header>`;

const footer = `  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <a class="wordmark" href="/"><span class="lizard">🦎</span><span class="name">InvoiceIguana</span></a>
        <p>The free invoice, quote &amp; receipt maker. Everything is saved in your browser or shared as a link — no signup, no server, no expiry.</p>
      </div>
      <div class="footer-col">
        <h4>Create</h4>
        <a href="/free-invoice-generator">Invoice generator</a>
        <a href="/receipt">Receipt generator</a>
        <a href="/quote">Quote generator</a>
      </div>
      <div class="footer-col">
        <h4>Templates</h4>
        <a href="/invoice-templates">Invoice templates</a>
        <a href="/quote-templates">Quote templates</a>
        <a href="/receipt-templates">Receipt templates</a>
        <a href="/bill-of-sale-templates">Bill of sale templates</a>
      </div>
      <div class="footer-col">
        <h4>About</h4>
        <a href="/#how-it-works">How it works</a>
        <a href="/#faq">FAQ</a>
        <a href="privacy.html">Privacy</a>
      </div>
    </div>
    <p class="footer-legal">Saved documents live in your browser, not on any server. Share via link or download as PDF — no signup, ever.</p>
  </footer>
  <script type="module" src="ads.js"></script>`;

const headMeta = ({ title, desc, url, ogTitle }) => `  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="InvoiceIguana">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${SITE}/og-image.png">
  <meta name="theme-color" content="#12a06a">
  <link rel="icon" href="icons/icon48.png">
  <link rel="apple-touch-icon" href="icons/icon192.png">
  <link rel="manifest" href="manifest.webmanifest">
  <script type="module" src="register-sw.js"></script>
  <link rel="stylesheet" href="theme.css">
  <link rel="stylesheet" href="landing.css">`;

const faqLd = (faqs) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
const faqHtml = (faqs) => faqs.map((f) =>
  `        <details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');

// --- example blocks --------------------------------------------------------
function itemsBlock(items) {
  return items.map((it) => {
    const qtyLabel = it.unit ? `${it.qty} ${esc(it.unit)}` : String(it.qty);
    return `        <tr><td>${esc(it.name)}</td><td class="ei-num">${qtyLabel}</td><td class="ei-num">${money(it.price)}</td><td class="ei-num">${money(it.qty * it.price)}</td></tr>`;
  }).join('\n');
}

// Invoice + quote share this (label/id differ).
function exampleTrade(entry, label, idPrefix, extraNote) {
  const subtotal = entry.items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = subtotal * (entry.taxrate / 100);
  const total = subtotal + tax;
  const taxRow = entry.taxrate > 0
    ? `        <tr><td>Tax (${entry.taxrate}%)</td><td class="ei-num">${money(tax)}</td></tr>\n` : '';
  return `      <div class="example-invoice" aria-label="Example ${esc(entry.name)} ${label.toLowerCase()}">
    <div class="ei-head">
      <div><span class="ei-doc">${label}</span><br><span class="ei-muted">#${idPrefix}-1042</span></div>
      <div class="ei-biz">Your ${esc(entry.name)} Business<br><span class="ei-muted">you@example.com</span></div>
    </div>
    <table class="ei-table">
      <thead><tr><th>Description</th><th class="ei-num">Qty</th><th class="ei-num">Rate</th><th class="ei-num">Amount</th></tr></thead>
      <tbody>
${itemsBlock(entry.items)}
      </tbody>
    </table>
    <table class="ei-totals">
      <tbody>
        <tr><td>Subtotal</td><td class="ei-num">${money(subtotal)}</td></tr>
${taxRow}        <tr class="ei-total"><td>Total</td><td class="ei-num">${money(total)}</td></tr>
      </tbody>
    </table>
    <p class="ei-note">${extraNote || 'Example only — make your own with your details in seconds.'}</p>
  </div>`;
}

function exampleReceipt(entry) {
  const subtotal = entry.items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = subtotal * (entry.taxrate / 100);
  const tip = entry.tip || 0;
  const total = subtotal + tax + tip;
  const rows = entry.items.map((it) =>
    `        <tr><td>${esc(it.name)}</td><td class="ei-num">${it.qty}</td><td class="ei-num">${money(it.qty * it.price)}</td></tr>`).join('\n');
  let totals = `        <tr><td>Subtotal</td><td class="ei-num">${money(subtotal)}</td></tr>\n`;
  if (entry.taxrate > 0) totals += `        <tr><td>Tax (${entry.taxrate}%)</td><td class="ei-num">${money(tax)}</td></tr>\n`;
  if (tip > 0) totals += `        <tr><td>Tip</td><td class="ei-num">${money(tip)}</td></tr>\n`;
  totals += `        <tr class="ei-total"><td>Total</td><td class="ei-num">${money(total)}</td></tr>`;
  return `      <div class="example-invoice" aria-label="Example ${esc(entry.noun)}">
    <div class="ei-head">
      <div><span class="ei-doc">RECEIPT</span><br><span class="ei-muted">#RCT-1042</span></div>
      <div class="ei-biz">${esc(entry.merchant)}<br><span class="ei-muted">Paid: ${esc(entry.payment)}</span></div>
    </div>
    <table class="ei-table">
      <thead><tr><th>Description</th><th class="ei-num">Qty</th><th class="ei-num">Amount</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <table class="ei-totals">
      <tbody>
${totals}
      </tbody>
    </table>
    <p class="ei-note">${esc(entry.footer)}</p>
  </div>`;
}

function exampleBillOfSale(entry) {
  return `      <div class="example-invoice" aria-label="Example ${esc(entry.name)} bill of sale">
    <p class="bos-ex-title">BILL OF SALE</p>
    <p><strong>Seller:</strong> Jordan Miller &nbsp;·&nbsp; <strong>Buyer:</strong> Priya Shah</p>
    <p>For <strong>${money(entry.price)}</strong>, the seller transfers to the buyer:</p>
    <p class="bos-ex-item">${esc(entry.item)}</p>
    <p class="ei-note">Sold as-is, where-is, with no warranty. Signed &amp; dated by both parties.</p>
  </div>`;
}

// --- doc-type configs ------------------------------------------------------
const KINDS = {
  invoice: {
    data: trades, suffix: 'invoice-template', hub: 'invoice-templates', ctaPath: '/free-invoice-generator',
    noun: 'invoice template', display: 'Invoice', hubBy: 'Trade',
    titleDoc: 'Invoice Template', h1: (n) => `Free ${esc(n)} Invoice Template`,
    desc: (e) => `Free ${e.name.toLowerCase()} invoice template with a real example. Itemize labor and materials, add tax, then download a PDF or share a link — no signup, no watermark.`,
    ctaLabel: (e) => `Make your ${esc(e.name)} invoice with AI`,
    example: (e) => exampleTrade(e, 'INVOICE', 'INV'),
    exampleH2: (e) => `${esc(e.name)} invoice example`,
    faqH2: (e) => `${esc(e.name)} invoice FAQ`,
    appName: (e) => `${e.name} Invoice Generator`,
  },
  quote: {
    data: quotes, suffix: 'quote-template', hub: 'quote-templates', ctaPath: '/quote',
    noun: 'quote template', display: 'Quote', hubBy: 'Trade',
    titleDoc: 'Quote & Estimate Template', h1: (n) => `Free ${esc(n)} Quote &amp; Estimate Template`,
    desc: (e) => `Free ${e.name.toLowerCase()} quote and estimate template with a real example. Itemize the work, add tax, set a valid-until date, then share a link or download a PDF — no signup.`,
    ctaLabel: (e) => `Make your ${esc(e.name)} quote with AI`,
    example: (e) => exampleTrade(e, 'ESTIMATE', 'EST', 'Example estimate — valid until you set a date. Make your own in seconds.'),
    exampleH2: (e) => `${esc(e.name)} estimate example`,
    faqH2: (e) => `${esc(e.name)} quote &amp; estimate FAQ`,
    appName: (e) => `${e.name} Quote Generator`,
  },
  receipt: {
    data: receipts, suffix: 'receipt-template', hub: 'receipt-templates', ctaPath: '/receipt',
    noun: 'receipt template', display: 'Receipt', hubBy: 'Type',
    titleDoc: 'Receipt Template', h1: (n) => `Free ${esc(n)} Receipt Template`,
    desc: (e) => `Free ${e.name.toLowerCase()} receipt template with a real example. Fill in the details, add tax or a tip, then download a PDF or share a link — no signup, no watermark.`,
    ctaLabel: (e) => `Make your ${esc(e.name)} receipt with AI`,
    example: (e) => exampleReceipt(e),
    exampleH2: (e) => `${esc(e.name)} receipt example`,
    faqH2: (e) => `${esc(e.name)} receipt FAQ`,
    appName: (e) => `${e.name} Receipt Generator`,
  },
  billofsale: {
    data: billsOfSale, suffix: 'bill-of-sale', hub: 'bill-of-sale-templates', ctaPath: '/bill-of-sale',
    noun: 'bill of sale', display: 'Bill of Sale', hubBy: 'Type &amp; state',
    titleDoc: 'Bill of Sale', h1: (n) => `Free ${esc(n)} Bill of Sale`,
    desc: (e) => `Free ${e.name.toLowerCase()} bill of sale template. Describe the sale and AI fills it in, then download a PDF or print — no signup. A general template, not legal advice.`,
    ctaLabel: (e) => `Make a ${esc(e.name)} bill of sale with AI`,
    example: (e) => exampleBillOfSale(e),
    exampleH2: (e) => `${esc(e.name)} bill of sale example`,
    faqH2: (e) => `${esc(e.name)} bill of sale FAQ`,
    appName: (e) => `${e.name} Bill of Sale Generator`,
  },
};

const relatedIn = (kind, entry) => {
  const same = kind.data.filter((e) => e.slug !== entry.slug && e.cat === entry.cat);
  const others = kind.data.filter((e) => e.slug !== entry.slug && e.cat !== entry.cat);
  return [...same, ...others].slice(0, 4);
};

// --- a single landing page -------------------------------------------------
function page(kind, entry) {
  const slug = `${entry.slug}-${kind.suffix}`;
  const url = `${SITE}/${slug}`;
  // Raw "&" — headMeta() escapes it once. (No pre-escaping, or it double-escapes.)
  const title = `Free ${entry.name} ${kind.titleDoc} — No Signup | InvoiceIguana`;
  const ogTitle = `Free ${entry.name} ${kind.titleDoc} — No Signup`;
  const desc = kind.desc(entry);
  const cta = `${kind.ctaPath}?prompt=${encodeURIComponent(entry.aiPrompt)}`;
  const appLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: kind.appName(entry), url,
    applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: desc,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const related = relatedIn(kind, entry).map((r) =>
    `        <a href="/${r.slug}-${kind.suffix}">${esc(r.name)} ${kind.noun}</a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${headMeta({ title, desc, url, ogTitle })}
  <script type="application/ld+json">
${ld(appLd)}
  </script>
  <script type="application/ld+json">
${ld(faqLd(entry.faqs))}
  </script>
</head>
<body>
${header()}

  <section class="hero">
    <h1>${kind.h1(entry.name)}</h1>
    <p class="tagline">${esc(entry.intro)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${cta}">${kind.ctaLabel(entry)}</a>
      <a class="btn btn-lg" href="${kind.ctaPath}">Open the free generator</a>
    </div>
    <p class="reassure"><b>Free forever</b> · No account · Download PDF or share a link · Nothing uploaded</p>
  </section>

  <main class="page">
    <section>
      <h2>${kind.exampleH2(entry)}</h2>
      <p class="lede">Here's what a finished document looks like. Start from this, describe it to the AI, or fill the form yourself — the totals and tax are calculated for you.</p>
${kind.example(entry)}
      <p class="section-cta">
        <a class="btn btn-primary btn-lg" href="${cta}">${kind.ctaLabel(entry)} →</a>
      </p>
    </section>

    <div class="ad-slot"></div>

    <section id="faq">
      <h2>${kind.faqH2(entry)}</h2>
      <div class="faq">
${faqHtml(entry.faqs)}
      </div>
    </section>

    <section class="related">
      <h2>More templates</h2>
      <nav class="related-links">
${related}
        <a href="/${kind.hub}">Browse all templates →</a>
      </nav>
    </section>
  </main>

${footer}
</body>
</html>
`;
}

// --- a hub page ------------------------------------------------------------
function hub(kind, kindKey) {
  const url = `${SITE}/${kind.hub}`;
  const word = { quote: 'quote &amp; estimate', billofsale: 'bill of sale' }[kindKey] || kindKey;
  const title = `Free ${kind.display} Templates by ${kind.hubBy} — No Signup | InvoiceIguana`;
  const ogTitle = title.replace(' | InvoiceIguana', '');
  const desc = `Free, ready-to-use ${word} templates with real examples. Pick yours, then download a PDF or share a link — no signup, no watermark.`;
  const cards = kind.data.map((e) =>
    `        <a class="trade-card" href="/${e.slug}-${kind.suffix}"><span class="tc-name">${esc(e.name)}</span><span class="tc-sub">${kind.noun}</span></a>`).join('\n');
  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: kind.data.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: `${e.name} ${kind.noun}`, url: `${SITE}/${e.slug}-${kind.suffix}` })),
  };
  const hubNav = HUBS.map((h) => `<a href="/${h.slug}"${h.slug === kind.hub ? ' aria-current="page"' : ''}>${h.label}</a>`).join(' · ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headMeta({ title, desc, url, ogTitle })}
  <script type="application/ld+json">
${ld(itemListLd)}
  </script>
</head>
<body>
${header('templates')}

  <section class="hero">
    <h1>Free <span class="grad">${word} templates</span></h1>
    <p class="tagline">Pick one for a ready-made example, then make your own in the browser — correct math, download a PDF or share a link, no signup and no watermark.</p>
    <p class="reassure">${hubNav}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${kind.ctaPath}">Open the free generator</a>
    </div>
  </section>

  <main class="page">
    <section>
      <div class="trade-hub-grid">
${cards}
      </div>
    </section>
    <div class="ad-slot"></div>
  </main>

${footer}
</body>
</html>
`;
}

// --- sitemap ---------------------------------------------------------------
function sitemap() {
  const rows = [];
  const add = (loc, freq, pri) => rows.push(`  <url><loc>${loc}</loc><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`);
  add(`${SITE}/`, 'monthly', '1.0');
  add(`${SITE}/receipt`, 'monthly', '0.9');
  add(`${SITE}/free-invoice-generator`, 'monthly', '0.9');
  add(`${SITE}/quote`, 'monthly', '0.8');
  add(`${SITE}/bill-of-sale`, 'monthly', '0.9');
  add(`${SITE}/privacy`, 'yearly', '0.3');
  for (const h of HUBS) add(`${SITE}/${h.slug}`, 'monthly', '0.8');
  for (const key of Object.keys(KINDS)) {
    for (const e of KINDS[key].data) add(`${SITE}/${e.slug}-${KINDS[key].suffix}`, 'monthly', '0.7');
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

// --- run -------------------------------------------------------------------
let total = 0;
for (const key of Object.keys(KINDS)) {
  const kind = KINDS[key];
  for (const entry of kind.data) {
    await writeFile(join(SITE_DIR, `${entry.slug}-${kind.suffix}.html`), page(kind, entry), 'utf8');
    total++;
  }
  await writeFile(join(SITE_DIR, `${kind.hub}.html`), hub(kind, key), 'utf8');
}
await writeFile(join(SITE_DIR, 'sitemap.xml'), sitemap(), 'utf8');
console.log(`Generated ${total} pages across ${Object.keys(KINDS).length} doc types + ${HUBS.length} hubs + sitemap.xml.`);
