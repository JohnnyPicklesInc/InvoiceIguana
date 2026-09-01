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
        <a href="/ai-invoice-generator">AI invoice generator</a>
        <a href="/invoice-generator-no-signup">Invoice generator, no signup</a>
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
    noun: 'bill of sale', display: 'Bill of Sale', hubBy: 'Type & State',
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
    <p class="reassure"><b>Free forever</b> · No account · Download PDF or share a link · Nothing stored</p>
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
${STANDALONE.map((t) => `        <a href="/${t.slug}">${esc(t.linkLabel)}</a>`).join('\n')}
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
  const word = { quote: 'quote & estimate', billofsale: 'bill of sale' }[kindKey] || kindKey;
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
    <h1>Free <span class="grad">${esc(word)} templates</span></h1>
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

// --- standalone angle pages ------------------------------------------------
// Not trade variants: one page per thing only this app can claim. These target
// queries the template pages can't win ("no signup", "AI invoice generator")
// and are written to be accurate about the one path that does leave the browser.
const featureCard = (ico, h, p) =>
  `        <div class="feature">
          <div class="ico">${ico}</div>
          <h3>${h}</h3>
          <p>${p}</p>
        </div>`;

const STANDALONE = [
  {
    slug: 'invoice-generator-no-signup',
    linkLabel: 'Invoice generator with no signup',
    title: 'Invoice Generator With No Signup — No Account, No Email',
    desc: 'Make and send an invoice with no signup, no account and no email address. The whole invoice is encoded in the link itself, so there is nothing to log into. Free, no watermark, no expiry.',
    h1: 'An invoice generator with <span class="grad">no signup</span>',
    tagline: 'No account, no email address, no "start your free trial". Open the generator, type the invoice, send the link. There is no login screen because there is nothing to log in to.',
    reassure: 'No account · No email required · No watermark · Nothing stored on a server',
    ctaPrompt: 'Invoice from Riverside Joinery to Ana Fields for 12 hours of finish carpentry at $65/hr plus $180 of materials, due in 14 days',
    ctaLabel: 'Make an invoice now',
    appName: 'Invoice Generator (No Signup)',
    sections: [
      { h2: 'Why there is no signup', lede: 'Most invoice tools need an account because your invoice lives in their database. This one does not have a database.',
        body: `      <p>When you finish an invoice, the whole document — your business, the client, every line
         item, the tax, your accent colour and logo — is normalised, compressed with the browser's
         own <code>deflate-raw</code>, and encoded into the part of the link after the
         <code>#</code>. That fragment is <b>never sent to a web server</b>; browsers do not
         transmit it. The link <em>is</em> the invoice.</p>
      <p>So there is no record to protect behind a password, no row to look up, and nothing to
         make you register for. A typical invoice comes out at a few hundred characters, and
         around 100 line items still fits inside the ~2,000-character budget that chat apps and
         email clients handle safely.</p>` },
      { h2: 'What "no signup" actually gets you', grid: [
        ['🚫', 'No account, ever', 'No email, no password, no verification step, no trial that expires into a paywall. The generator opens straight into a working form.'],
        ['🔗', 'Your client signs up for nothing either', 'They open the link and see the invoice. No portal, no "create an account to view this document" wall in front of the person who owes you money.'],
        ['💾', 'Saved on your device, not ours', 'Invoices you keep are stored in this browser (IndexedDB). There is a one-click JSON backup so your records are not hostage to a browser profile.'],
        ['✈️', 'Works with no connection', 'A service worker precaches the whole app, so the generator and the viewer both work offline. Useful on a job site with no signal.'],
        ['🖊️', 'No watermark, no invoice cap', 'Nothing is stamped on your PDF and there is no "3 free invoices per month". It is the same tool at the first invoice and the thousandth.'],
        ['⏳', 'Links do not expire', 'The link is not a lookup into an account that could lapse — it carries the document itself. It still opens years later, whatever happens to this site.'],
      ] },
    ],
    honest: {
      h: 'The one thing that does leave your browser',
      p: `The optional <b>Ask AI</b> box is the single exception. When you click it — and only then —
          the text you typed is sent to our gateway so a model can draft or edit the invoice, and
          the result comes back. Nothing about it is stored. Everything else on this site
          (editing, saving, sharing, PDF export, the viewer) runs entirely in your browser and
          contacts no server at all. If you never touch the AI box, nothing you type ever leaves
          the machine.`,
    },
    faqs: [
      { q: 'Do I need an account to make an invoice?', a: 'No. There is no signup, no email address and no password anywhere in the app. Open the generator and start typing — the first invoice takes about a minute.' },
      { q: 'How can you send an invoice without an account?', a: 'The invoice is compressed and encoded into the link itself rather than saved on a server, so sending the link sends the document. Your client opens it in any browser with nothing to install and nothing to sign up for.' },
      { q: 'Where is my invoice stored if there is no server?', a: 'In two places you control: the link you copied, and this browser if you chose to save it. Saved invoices live in IndexedDB on your own device, with a one-click JSON export for backup. Nothing is uploaded.' },
      { q: 'Is there a watermark or a limit on free invoices?', a: 'Neither. There is no watermark on the PDF, no cap on how many invoices you make, and no feature held back for a paid tier.' },
      { q: 'Does the link expire?', a: 'No. Because the link carries the document rather than pointing at a database row, there is nothing to expire or delete. It keeps working as long as the recipient has the link.' },
      { q: 'Can I still get paid through it?', a: 'Yes — add your payment instructions, or a payment link (Stripe, PayPal, Wise) that shows up as a Pay button on the invoice your client opens. The money never routes through us; the link goes straight to your processor.' },
    ],
  },
  {
    slug: 'ai-invoice-generator',
    linkLabel: 'AI invoice generator',
    title: 'AI Invoice Generator — Describe the Job, Get an Invoice',
    desc: 'Describe a job in plain English and get a finished invoice, or describe a change and it edits the one you have. The model never does the arithmetic — the app computes every total and tax. Free, no signup.',
    h1: 'Free <span class="grad">AI invoice generator</span>',
    tagline: 'Type "8 hours of drywall repair at $55 an hour plus $120 of materials for Marisol Vega, net 15" and get a finished invoice. Or describe a change to one you already have, and it edits it.',
    reassure: 'Free · No account · Undo any AI change · The app does the maths, not the model',
    ctaPrompt: '8 hours of drywall repair at $55/hr plus $120 of materials for Marisol Vega, net 15',
    ctaLabel: 'Try it with this example',
    appName: 'AI Invoice Generator',
    sections: [
      { h2: 'One box that writes or rewrites', lede: 'The same box does both jobs, and it works out which one you meant from whether the form already has anything in it.',
        body: `      <p><b>On an empty form</b> it drafts the whole invoice: your business, the client, itemised
         lines with quantities and rates, the tax rate, and the terms you described. Nothing needs
         to be filled in first.</p>
      <p><b>On an invoice you already have</b> it edits in place. "Add two more hours to the second
         line", "change the due date to net 30", "drop the discount and add 8.25% sales tax" — it
         changes what you asked about and leaves the rest alone.</p>` },
      { h2: 'Why the numbers are trustworthy', lede: 'The usual objection to an AI invoice is that language models are bad at arithmetic. That objection does not apply here, by design.',
        body: `      <p><b>The model is never allowed to do the maths.</b> It returns a tax
         <em>rate</em> — never a tax amount, never a subtotal, never a total. Every figure on the
         finished invoice is computed by the app from the line items, in integer minor units, the
         same code path as an invoice you typed by hand. A model that is bad at multiplication
         cannot produce a wrong total here, because it is never asked for one.</p>
      <p>You also get a plain-language summary of exactly what changed — "Added a line item",
         "Changed the due date" — generated by diffing the invoice before and after, not by asking
         the model what it says it did. And an <b>Undo</b> button that restores the previous
         version exactly, including the styling.</p>` },
    ],
    honest: {
      h: 'What gets sent, and when',
      p: `Only the text you type in the AI box, and only at the moment you click <b>Ask AI</b>. It
          goes to our gateway, a model drafts or edits the invoice, and the result comes straight
          back — none of it is stored. The rest of the app never contacts a server: editing,
          saving, sharing, PDF export and the client's view of the invoice all happen in the
          browser. The AI is entirely optional, and the form works exactly the same without it.`,
    },
    faqs: [
      { q: 'Can the AI get my totals wrong?', a: 'It cannot produce the totals at all. The model returns line items and a tax rate; the app computes every subtotal, discount, tax amount and total itself in integer minor units. Arithmetic never passes through the model.' },
      { q: 'Do I need an account to use the AI invoice generator?', a: 'No. There is no signup and no email address for any part of the app, the AI included. It is free and there is no cap on how many invoices you draft.' },
      { q: 'Is my invoice sent to a server when I use AI?', a: 'The text you type in the AI box is sent when you click Ask AI, and only then, so a model can draft or edit the invoice. Nothing is stored. If you do not use the AI box, nothing you type ever leaves your browser.' },
      { q: 'Can it edit an invoice I already started?', a: 'Yes. Describe the change in the same box — "add two hours to the second line", "make it net 30" — and it edits that invoice rather than starting over. A summary shows what changed and Undo restores the previous version.' },
      { q: 'What should I type to get a good invoice?', a: 'Plain English works. Say who it is for, what the work was, the quantities and rates, and the terms: "12 hours of finish carpentry at $65/hr plus $180 of materials for Ana Fields, due in 14 days". Missing details you can just fill in on the form afterwards.' },
      { q: 'Does the AI work for receipts, quotes and bills of sale too?', a: 'Yes — the receipt, quote and bill of sale generators each have the same box, with the same rules about the app doing the arithmetic and Undo restoring the previous version.' },
    ],
  },
];

function standalone(entry) {
  const url = `${SITE}/${entry.slug}`;
  const title = `${entry.title} | InvoiceIguana`;
  const cta = `/free-invoice-generator?prompt=${encodeURIComponent(entry.ctaPrompt)}`;
  const appLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: entry.appName, url,
    applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: entry.desc,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const others = STANDALONE.filter((s) => s.slug !== entry.slug)
    .map((s) => `        <a href="/${s.slug}">${esc(s.linkLabel || s.appName)}</a>`).join('\n');

  const body = entry.sections.map((s) => `    <section>
      <h2>${s.h2}</h2>
${s.lede ? `      <p class="lede">${s.lede}</p>\n` : ''}${s.grid
      ? `      <div class="features">\n${s.grid.map((g) => featureCard(g[0], g[1], g[2])).join('\n')}\n      </div>`
      : s.body}
    </section>`).join('\n\n    <div class="ad-slot"></div>\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${headMeta({ title, desc: entry.desc, url, ogTitle: entry.title })}
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
    <h1>${entry.h1}</h1>
    <p class="tagline">${entry.tagline}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${cta}">${entry.ctaLabel}</a>
      <a class="btn btn-lg" href="/free-invoice-generator">Open the free generator</a>
    </div>
    <p class="reassure">${entry.reassure}</p>
  </section>

  <main class="page">
${body}

    <section class="explainer">
      <h2>${entry.honest.h}</h2>
      <div class="explainer-grid">
        <div class="explainer-card">
          <div class="ico">🔒</div>
          <p>${entry.honest.p}</p>
        </div>
      </div>
    </section>

    <div class="ad-slot"></div>

    <section id="faq">
      <h2>Questions</h2>
      <div class="faq">
${faqHtml(entry.faqs)}
      </div>
    </section>

    <section class="related">
      <h2>More</h2>
      <nav class="related-links">
${others}
        <a href="/invoice-templates">Invoice templates by trade →</a>
        <a href="/receipt">Receipt generator</a>
        <a href="/quote">Quote generator</a>
      </nav>
    </section>
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
  for (const e of STANDALONE) add(`${SITE}/${e.slug}`, 'monthly', '0.8');
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
for (const e of STANDALONE) {
  await writeFile(join(SITE_DIR, `${e.slug}.html`), standalone(e), 'utf8');
}
await writeFile(join(SITE_DIR, 'sitemap.xml'), sitemap(), 'utf8');
console.log(`Generated ${total} pages across ${Object.keys(KINDS).length} doc types + ${HUBS.length} hubs + ${STANDALONE.length} standalone + sitemap.xml.`);
