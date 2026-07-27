// Generates the "[trade] invoice template" SEO landing pages + a hub page, and
// rewrites site/sitemap.xml. Pure Node stdlib, no build step — run before commit:
//   node scripts/make-landing.mjs   (or: npm run landing)
//
// Data comes from scripts/trades.mjs. Each page mirrors index.html's marketing
// layout (theme.css + landing.css only) and respects the strict CSP: no inline
// styles or JS, only same-origin assets + inline application/ld+json.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trades, SITE } from './trades.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = join(ROOT, 'site');

// --- helpers ---------------------------------------------------------------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Fixed-point money, no ICU dependency: 1200 -> "$1,200.00"
const money = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  const [i, d] = s.split('.');
  return '$' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
};

// JSON-LD, safe to embed in <script>: escape the "<" so "</script>" can't appear.
const ld = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const slugUrl = (t) => `/${t.slug}-invoice-template`;
const canonical = (t) => `${SITE}${slugUrl(t)}`;

function relatedFor(trade) {
  const same = trades.filter((t) => t.slug !== trade.slug && t.cat === trade.cat);
  const others = trades.filter((t) => t.slug !== trade.slug && t.cat !== trade.cat);
  return [...same, ...others].slice(0, 4);
}

// --- shared markup ---------------------------------------------------------
const header = (extraNavCurrent = '') => `  <header class="site-header">
    <a class="wordmark" href="/"><span class="lizard">🦎</span><span class="name">InvoiceIguana</span></a>
    <nav>
      <a href="/free-invoice-generator">Invoice</a>
      <a href="/receipt">Receipt</a>
      <a href="/invoice-templates"${extraNavCurrent === 'templates' ? ' aria-current="page"' : ''}>Templates</a>
      <a href="privacy.html">Privacy</a>
    </nav>
  </header>`;

const footer = `  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <a class="wordmark" href="/"><span class="lizard">🦎</span><span class="name">InvoiceIguana</span></a>
        <p>The free invoice &amp; receipt maker. Everything is saved in your browser or shared as a link — no signup, no server, no expiry.</p>
      </div>
      <div class="footer-col">
        <h4>Create</h4>
        <a href="/free-invoice-generator">Invoice generator</a>
        <a href="/receipt">Receipt generator</a>
        <a href="/invoice-templates">Invoice templates</a>
      </div>
      <div class="footer-col">
        <h4>About</h4>
        <a href="/#how-it-works">How it works</a>
        <a href="/#faq">FAQ</a>
        <a href="privacy.html">Privacy</a>
      </div>
    </div>
    <p class="footer-legal">Saved invoices live in your browser, not on any server. Share via link or download as PDF — no signup, ever.</p>
  </footer>
  <script type="module" src="ads.js"></script>`;

// Standard <head> boilerplate shared by every generated page.
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
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN"}'></script>
  <link rel="stylesheet" href="theme.css">
  <link rel="stylesheet" href="landing.css">`;

// --- example invoice block -------------------------------------------------
function exampleInvoice(trade) {
  const subtotal = trade.items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = subtotal * (trade.taxrate / 100);
  const total = subtotal + tax;
  const rows = trade.items.map((it) => {
    const qtyLabel = it.unit ? `${it.qty} ${esc(it.unit)}` : String(it.qty);
    return `        <tr><td>${esc(it.name)}</td><td class="ei-num">${qtyLabel}</td><td class="ei-num">${money(it.price)}</td><td class="ei-num">${money(it.qty * it.price)}</td></tr>`;
  }).join('\n');
  const taxRow = trade.taxrate > 0
    ? `        <tr><td>Tax (${trade.taxrate}%)</td><td class="ei-num">${money(tax)}</td></tr>\n`
    : '';
  return `      <div class="example-invoice" aria-label="Example ${esc(trade.name)} invoice">
    <div class="ei-head">
      <div><span class="ei-doc">INVOICE</span><br><span class="ei-muted">#INV-1042</span></div>
      <div class="ei-biz">Your ${esc(trade.name)} Business<br><span class="ei-muted">you@example.com</span></div>
    </div>
    <table class="ei-table">
      <thead><tr><th>Description</th><th class="ei-num">Qty</th><th class="ei-num">Rate</th><th class="ei-num">Amount</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <table class="ei-totals">
      <tbody>
        <tr><td>Subtotal</td><td class="ei-num">${money(subtotal)}</td></tr>
${taxRow}        <tr class="ei-total"><td>Total</td><td class="ei-num">${money(total)}</td></tr>
      </tbody>
    </table>
    <p class="ei-note">Example only — make your own with your details in seconds.</p>
  </div>`;
}

// --- a single trade page ---------------------------------------------------
function tradePage(trade) {
  const url = canonical(trade);
  const title = `Free ${trade.name} Invoice Template — No Signup | InvoiceIguana`;
  const ogTitle = `Free ${trade.name} Invoice Template — No Signup`;
  const desc = `Free ${trade.name.toLowerCase()} invoice template with a real example. Itemize labor and materials, add tax, then download a PDF or share a link — no signup, no watermark.`;
  const cta = `/free-invoice-generator?prompt=${encodeURIComponent(trade.aiPrompt)}`;

  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: trade.faqs.map((f) => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const appLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: `${trade.name} Invoice Generator`, url,
    applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    description: desc, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const faqHtml = trade.faqs.map((f) =>
    `        <details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');
  const related = relatedFor(trade).map((r) =>
    `        <a href="${slugUrl(r)}">${esc(r.name)} invoice template</a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${headMeta({ title, desc, url, ogTitle })}
  <script type="application/ld+json">
${ld(appLd)}
  </script>
  <script type="application/ld+json">
${ld(faqLd)}
  </script>
</head>
<body>
${header()}

  <section class="hero">
    <h1>Free <span class="grad">${esc(trade.name)}</span> Invoice Template</h1>
    <p class="tagline">${esc(trade.intro)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${cta}">Make your ${esc(trade.name)} invoice with AI</a>
      <a class="btn btn-lg" href="/free-invoice-generator">Open the free generator</a>
    </div>
    <p class="reassure"><b>Free forever</b> · No account · Download PDF or share a link · Nothing uploaded</p>
  </section>

  <main class="page">
    <section>
      <h2>${esc(trade.name)} invoice example</h2>
      <p class="lede">Here's what a finished invoice looks like. Start from this, describe your job to the AI, or fill the form yourself — the totals and tax are calculated for you.</p>
${exampleInvoice(trade)}
      <p class="section-cta">
        <a class="btn btn-primary btn-lg" href="${cta}">Make your ${esc(trade.name)} invoice →</a>
      </p>
    </section>

    <div class="ad-slot"></div>

    <section id="faq">
      <h2>${esc(trade.name)} invoice FAQ</h2>
      <div class="faq">
${faqHtml}
      </div>
    </section>

    <section class="related">
      <h2>More invoice templates</h2>
      <nav class="related-links">
${related}
        <a href="/invoice-templates">See all invoice templates →</a>
      </nav>
    </section>
  </main>

${footer}
</body>
</html>
`;
}

// --- hub page --------------------------------------------------------------
function hubPage() {
  const url = `${SITE}/invoice-templates`;
  const title = 'Free Invoice Templates by Trade — No Signup | InvoiceIguana';
  const ogTitle = 'Free Invoice Templates by Trade — No Signup';
  const desc = 'Free, ready-to-use invoice templates for electricians, plumbers, photographers, consultants and more. Real examples, correct tax math, download a PDF or share a link — no signup.';
  const cards = trades.map((t) =>
    `        <a class="trade-card" href="${slugUrl(t)}"><span class="tc-name">${esc(t.name)}</span><span class="tc-sub">invoice template</span></a>`).join('\n');
  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: trades.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: `${t.name} invoice template`, url: canonical(t),
    })),
  };
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
    <h1>Free <span class="grad">invoice templates</span> by trade</h1>
    <p class="tagline">Pick your trade for a ready-made example, then make your own in the browser — correct tax math, download a PDF or share a link, no signup and no watermark.</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="/free-invoice-generator">Open the free generator</a>
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
  const staticUrls = [
    { loc: `${SITE}/`, freq: 'monthly', pri: '1.0' },
    { loc: `${SITE}/receipt`, freq: 'monthly', pri: '0.9' },
    { loc: `${SITE}/free-invoice-generator`, freq: 'monthly', pri: '0.9' },
    { loc: `${SITE}/quote`, freq: 'monthly', pri: '0.8' },
    { loc: `${SITE}/invoice-templates`, freq: 'monthly', pri: '0.8' },
    { loc: `${SITE}/privacy`, freq: 'yearly', pri: '0.3' },
  ];
  const tradeUrls = trades.map((t) => ({ loc: canonical(t), freq: 'monthly', pri: '0.7' }));
  const urls = [...staticUrls, ...tradeUrls]
    .map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// --- run -------------------------------------------------------------------
let count = 0;
for (const trade of trades) {
  const file = join(SITE_DIR, `${trade.slug}-invoice-template.html`);
  await writeFile(file, tradePage(trade), 'utf8');
  count++;
}
await writeFile(join(SITE_DIR, 'invoice-templates.html'), hubPage(), 'utf8');
await writeFile(join(SITE_DIR, 'sitemap.xml'), sitemap(), 'utf8');

console.log(`Generated ${count} trade pages + hub + sitemap.xml (${trades.length + 6} sitemap URLs).`);
