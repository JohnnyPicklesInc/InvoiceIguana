/**
 * InvoiceIguana selftest — round-trips the real browser modules under Node 18+.
 * No dependencies, no network. Run: node scripts/selftest.mjs
 *
 * `node scripts/selftest.mjs --print-sample-url [base]` additionally prints a
 * ready-to-open viewer URL for the sample receipt (default base
 * http://localhost:8788).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual, ok, strictEqual } from 'node:assert';

import {
  encodeReceipt, decodeReceipt, payloadHeader, deflateRaw, inflateRaw,
  b64u, unb64u, isHttpsUrl, BadVersion, BadPayload,
} from '../site/shared/codec.js';
import { parseReceipt, splitCsvLine } from '../site/shared/parse.js';
import { TEMPLATES } from '../site/shared/templates.js';
import { TEMPLATES as INVOICE_TEMPLATES } from '../site/shared/invoice-templates.js';
import { encodeInvoice, decodeInvoice, DOC_INVOICE } from '../site/shared/invoice-codec.js';
import { parseInvoice } from '../site/shared/invoice-parse.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

async function expectThrow(promiseOrFn, ErrType) {
  try {
    await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
  } catch (e) {
    ok(e instanceof ErrType, `expected ${ErrType.name}, got ${e.name}: ${e.message}`);
    return;
  }
  throw new Error(`expected ${ErrType.name}, nothing thrown`);
}

const forge = async (obj) =>
  '1r' + b64u(await deflateRaw(new TextEncoder().encode(JSON.stringify(obj))));

const inflateBody = async (payload) =>
  JSON.parse(new TextDecoder().decode(await inflateRaw(unb64u(payload.slice(2)))));

const sampleJson = readFileSync(join(root, 'samples', 'receipt.sample.json'), 'utf8');
const sampleCsv = readFileSync(join(root, 'samples', 'receipt.sample.csv'), 'utf8');

// ---- round-trips ---------------------------------------------------------

let sampleUrlPayload = '';

await test('JSON sample: parse -> encode -> decode round-trips exactly', async () => {
  const { receipt, errors, warnings } = parseReceipt(sampleJson, 'json');
  deepStrictEqual(errors, []);
  deepStrictEqual(warnings, []);
  const payload = await encodeReceipt(receipt);
  sampleUrlPayload = payload;
  ok(payload.startsWith('1r'), `payload prefix: ${payload.slice(0, 2)}`);
  deepStrictEqual(await decodeReceipt(payload), receipt);
});

await test('CSV sample normalizes identically to the JSON sample', () => {
  const a = parseReceipt(sampleJson, 'json');
  const b = parseReceipt(sampleCsv, 'csv');
  deepStrictEqual(b.errors, []);
  deepStrictEqual(b.receipt, a.receipt);
});

await test('fully-styled receipt round-trips exactly', async () => {
  const { receipt } = parseReceipt(sampleJson, 'json');
  Object.assign(receipt, {
    template: 'inv', brandingOff: true, accent: 'c0392b', emoji: '🐀', qr: true,
    logoUrl: 'https://example.com/logo.png',
  });
  deepStrictEqual(await decodeReceipt(await encodeReceipt(receipt)), receipt);
});

await test('default-style payloads carry no style/optional keys (no-growth guard)', async () => {
  const compact = await inflateBody(sampleUrlPayload);
  for (const k of ['w', 'b', 'k', 'e', 'q', 'o', 'r', 'g', 'h', 'u', 'l']) {
    ok(!(k in compact), `unexpected key "${k}" in default payload`);
  }
});

await test('pinned v1 fixture keeps decoding (old-link regression guard)', async () => {
  // Encoded 2026-07-06 from {"merchant":"Fixture Mart","date":"2026-07-06",
  // "items":[{"name":"Widget","qty":2,"price":1.25}],"tax":0.20}. Do not regenerate.
  const fixture = '1rBcExCoAwDEDRq8ifU4iBKuQAbs4O0kFQpINLrVAQ7-57LxfOlFt9ytHNW6kIGV9XlryfR0VMeospCTuOqQ1Bx6ADwo1bVKHhpkLFbdTvBw';
  const r = await decodeReceipt(fixture);
  strictEqual(r.merchant, 'Fixture Mart');
  strictEqual(r.items[0].priceMinor, 125);
  strictEqual(r.totalMinor, 270);
  strictEqual(r.template, 'classic');
  strictEqual(r.brandingOff, false);
  strictEqual(r.qr, false);
});

// ---- contact / reference / discount ------------------------------------------

await test('contact, reference, and discount round-trip through the link', async () => {
  const { receipt, errors } = parseReceipt(JSON.stringify({
    merchant: 'Rat Deli', contact: '555-0142', reference: 'R-2024-0091',
    items: [{ name: 'Coffee', price: 5 }], discount: 1, tax: 0.5,
  }), 'json');
  deepStrictEqual(errors, []);
  strictEqual(receipt.contact, '555-0142');
  strictEqual(receipt.reference, 'R-2024-0091');
  strictEqual(receipt.discountMinor, 100);
  strictEqual(receipt.totalMinor, 450, 'total = subtotal(500) - discount(100) + tax(50)');
  deepStrictEqual(await decodeReceipt(await encodeReceipt(receipt)), receipt);
});

await test('CSV: contact, reference, and discount rows parse like JSON', () => {
  const csv = 'merchant,Rat Deli\ncontact,555-0142\nreference,R-2024-0091\ndiscount,1\ntax,0.5\nitem,Coffee,5';
  const { receipt, errors } = parseReceipt(csv, 'csv');
  deepStrictEqual(errors, []);
  strictEqual(receipt.contact, '555-0142');
  strictEqual(receipt.reference, 'R-2024-0091');
  strictEqual(receipt.discountMinor, 100);
});

await test('decode rejects a corrupted discount value (strict — it is money)', async () => {
  await expectThrow(
    decodeReceipt(await forge({ m: 'M', i: [['a', 1, 100]], s: 100, t: 100, g: 'not-a-number' })),
    BadPayload,
  );
});

await test('taxLabel round-trips and never affects the math', async () => {
  const { receipt, errors } = parseReceipt(JSON.stringify({
    merchant: 'M', items: [{ name: 'a', price: 10 }], tax: 0.89, taxlabel: 'NY Sales Tax (8.875%)',
  }), 'json');
  deepStrictEqual(errors, []);
  strictEqual(receipt.taxLabel, 'NY Sales Tax (8.875%)');
  strictEqual(receipt.totalMinor, 1089);
  deepStrictEqual(await decodeReceipt(await encodeReceipt(receipt)), receipt);
});

// ---- logo URL ----------------------------------------------------------------

await test('isHttpsUrl accepts https:, rejects everything else', () => {
  ok(isHttpsUrl('https://example.com/logo.png'));
  ok(!isHttpsUrl('http://example.com/logo.png'), 'http: rejected (would be mixed-content-blocked anyway)');
  ok(!isHttpsUrl('javascript:alert(1)'));
  ok(!isHttpsUrl('data:image/png;base64,AAAA'));
  ok(!isHttpsUrl(42));
  ok(!isHttpsUrl('https://x.com/' + 'a'.repeat(600)), 'over the length cap');
});

await test('upload validation rejects a non-https logourl with a clear error', () => {
  const { receipt, errors } = parseReceipt(JSON.stringify({
    merchant: 'M', items: [{ name: 'a', price: 1 }], logourl: 'http://example.com/logo.png',
  }), 'json');
  deepStrictEqual(receipt, null);
  ok(errors.some((e) => e.includes('must be an https:// URL')), `got: ${errors}`);
});

await test('logoUrl round-trips through the link', async () => {
  const { receipt, errors } = parseReceipt(JSON.stringify({
    merchant: 'M', items: [{ name: 'a', price: 1 }], logourl: 'https://example.com/logo.png',
  }), 'json');
  deepStrictEqual(errors, []);
  strictEqual(receipt.logoUrl, 'https://example.com/logo.png');
  deepStrictEqual(await decodeReceipt(await encodeReceipt(receipt)), receipt);
});

await test('decode drops a malicious/invalid logo URL leniently, never throws', async () => {
  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  const r1 = await decodeReceipt(await forge({ ...base, u: 'javascript:alert(1)' }));
  strictEqual(r1.logoUrl, null);
  const r2 = await decodeReceipt(await forge({ ...base, u: 'http://example.com/logo.png' }));
  strictEqual(r2.logoUrl, null, 'non-https dropped, not thrown');
});

await test('embedded logoData round-trips through the link', async () => {
  const { receipt, errors } = parseReceipt(JSON.stringify({
    merchant: 'M', items: [{ name: 'a', price: 1 }],
  }), 'json');
  deepStrictEqual(errors, []);
  Object.assign(receipt, { logoData: 'aGVsbG8=' });
  strictEqual((await decodeReceipt(await encodeReceipt(receipt))).logoData, 'aGVsbG8=');
});

await test('decode drops an invalid or oversized logoData leniently, never throws', async () => {
  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  const r1 = await decodeReceipt(await forge({ ...base, l: 'not base64!!' }));
  strictEqual(r1.logoData, null, 'non-base64 characters dropped');
  const r2 = await decodeReceipt(await forge({ ...base, l: 'A'.repeat(7000) }));
  strictEqual(r2.logoData, null, 'over the length cap dropped');
});

// ---- money -------------------------------------------------------------------

await test('money: no float drift ("3.50" x 2 = exactly 700 minor)', () => {
  const { receipt } = parseReceipt('{"merchant":"M","items":[{"name":"a","qty":2,"price":3.50}]}', 'json');
  deepStrictEqual(receipt.items[0].priceMinor, 350);
  deepStrictEqual(receipt.subtotalMinor, 700);
});

await test('money: zero-decimal currency (JPY) round-trips', async () => {
  const { receipt, errors } = parseReceipt(
    '{"merchant":"Ramen Rat","currency":"JPY","items":[{"name":"Shoyu","price":950}],"tax":95}', 'json');
  deepStrictEqual(errors, []);
  deepStrictEqual(receipt.items[0].priceMinor, 950);
  deepStrictEqual(receipt.totalMinor, 1045);
  deepStrictEqual(await decodeReceipt(await encodeReceipt(receipt)), receipt);
});

// ---- validation ------------------------------------------------------------

await test('warning when provided total disagrees with computed', () => {
  const { receipt, warnings } = parseReceipt(
    '{"merchant":"M","items":[{"name":"a","price":1}],"total":9.99}', 'json');
  ok(receipt, 'receipt should still parse');
  ok(warnings.length === 1 && warnings[0].includes("doesn't match"), `got: ${warnings}`);
  deepStrictEqual(receipt.totalMinor, 999, 'provided total wins');
});

await test('errors: missing merchant, empty items, bad price, bad qty', () => {
  const { receipt, errors } = parseReceipt(
    '{"items":[{"name":"a","price":"abc"},{"name":"b","qty":-2,"price":1}]}', 'json');
  deepStrictEqual(receipt, null);
  ok(errors.some((e) => e.includes('"merchant" is required')), `merchant: ${errors}`);
  ok(errors.some((e) => e.includes('price is not a number')), `price: ${errors}`);
  ok(errors.some((e) => e.includes('quantity must be a positive')), `qty: ${errors}`);
});

await test('CSV: quoted fields, "" escapes, qty-optional item rows', () => {
  deepStrictEqual(splitCsvLine('item,"Bagel, plain",2,3.50'), ['item', 'Bagel, plain', '2', '3.50']);
  deepStrictEqual(splitCsvLine('footer,"He said ""hi"""'), ['footer', 'He said "hi"']);
  const { receipt, errors } = parseReceipt('merchant,M\nitem,Solo,4.20', 'csv');
  deepStrictEqual(errors, []);
  deepStrictEqual(receipt.items[0], { name: 'Solo', qty: 1, priceMinor: 420 });
});

await test('CSV: unknown row type reports its line number', () => {
  const { errors } = parseReceipt('merchant,M\nbogus,42', 'csv');
  ok(errors[0].startsWith('Line 2:'), `got: ${errors}`);
});

// ---- fail-closed decoding ------------------------------------------------

await test('decode fails closed on bad input', async () => {
  await expectThrow(decodeReceipt(''), BadPayload);
  await expectThrow(decodeReceipt('9' + sampleUrlPayload.slice(1)), BadVersion);
  await expectThrow(decodeReceipt('1z' + sampleUrlPayload.slice(2)), BadPayload); // wrong doc type
  await expectThrow(decodeReceipt(sampleUrlPayload.slice(0, 12)), BadPayload); // truncated
  await expectThrow(decodeReceipt('1r!!!not-base64url!!!'), BadPayload);
});

await test('payloadHeader splits version/docType and rejects garbage', () => {
  const h = payloadHeader(sampleUrlPayload);
  strictEqual(h.version, '1');
  strictEqual(h.docType, 'r');
  ok(h.body.length > 0);
  for (const bad of ['', '1', '1r']) {
    let threw = false;
    try { payloadHeader(bad); } catch { threw = true; }
    ok(threw, `payloadHeader('${bad}') should throw`);
  }
});

await test('decode rejects structurally-wrong receipts (non-array items)', async () => {
  await expectThrow(decodeReceipt(await forge({ m: 'M', i: 'nope', s: 1, t: 1 })), BadPayload);
  await expectThrow(decodeReceipt(await forge({ m: 'M', i: [['a', 0, 100]], s: 1, t: 1 })), BadPayload); // qty 0
  await expectThrow(decodeReceipt(await forge([1, 2, 3])), BadPayload);
});

await test('style keys decode leniently — bad values become defaults, never errors', async () => {
  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  const r1 = await decodeReceipt(await forge({ ...base, k: 'red;}', w: 'XY!Z', e: 'x'.repeat(40) }));
  strictEqual(r1.accent, null, 'CSS-injection accent dropped');
  strictEqual(r1.template, 'classic', 'malformed template id falls back');
  strictEqual(r1.emoji, null, 'oversized emoji dropped');
  const r2 = await decodeReceipt(await forge({ ...base, w: 'future', b: 1, q: 1, k: 'C0392B' }));
  strictEqual(r2.template, 'future', 'well-formed unknown ids pass through (renderer falls back)');
  strictEqual(r2.brandingOff, true);
  strictEqual(r2.qr, true);
  strictEqual(r2.accent, 'c0392b', 'accent normalized to lowercase');
});

// ---- template registry sanity ----------------------------------------------

await test('every non-classic template has CSS in templates.css', () => {
  const css = readFileSync(join(root, 'site', 'shared', 'templates.css'), 'utf8');
  for (const [id, tpl] of Object.entries(TEMPLATES)) {
    if (!tpl.className) continue;
    ok(css.includes(`.receipt.${tpl.className}`), `missing CSS for template "${id}" (.receipt.${tpl.className})`);
  }
});

await test('every non-classic invoice template has CSS in invoice.css', () => {
  const css = readFileSync(join(root, 'site', 'shared', 'invoice.css'), 'utf8');
  for (const [id, tpl] of Object.entries(INVOICE_TEMPLATES)) {
    if (!tpl.className) continue;
    ok(css.includes(`.invoice.${tpl.className}`), `missing CSS for template "${id}" (.invoice.${tpl.className})`);
  }
});

// ---- size budget ------------------------------------------------------------

await test('URL size: 5-item sample < 500 chars, 40-item styled receipt < 2000', async () => {
  const base = 'https://receiptrat.pages.dev/r#';
  const five = base + sampleUrlPayload;
  ok(five.length < 500, `5-item URL is ${five.length} chars`);
  const items = Array.from({ length: 40 }, (_, i) =>
    ({ name: `Menu item number ${i + 1}`, qty: (i % 3) + 1, price: 4.5 + i * 0.25 }));
  const { receipt } = parseReceipt(JSON.stringify({ merchant: "Rat's Deli", items, tax: 12.34 }), 'json');
  Object.assign(receipt, { template: 'ele', accent: 'c0392b', emoji: '🐀', qr: true });
  const forty = base + await encodeReceipt(receipt);
  ok(forty.length < 2000, `40-item styled URL is ${forty.length} chars`);
  console.log(`      (5-item URL: ${five.length} chars, 40-item styled URL: ${forty.length} chars)`);
});

// ---- InvoiceIguana ------------------------------------------------------------

const forgeInvoice = async (obj) =>
  '1i' + b64u(await deflateRaw(new TextEncoder().encode(JSON.stringify(obj))));

const invoiceRaw = {
  seller: 'Acme Consulting', selleraddress: '1 Main St', sellercontact: 'billing@acme.com',
  buyer: 'Client Co', buyeraddress: '2 Oak Ave', buyercontact: 'ap@client.com',
  invoicenumber: 'INV-2026-001', issuedate: '2026-07-01', duedate: '2026-07-31',
  items: [{ name: 'Consulting hours', qty: 10, price: 150 }],
  discount: 50, tax: 80, taxlabel: 'Sales Tax (8%)', paymentinstructions: 'Wire to Acme Bank',
};

await test('invoice: JSON round-trips exactly, prefix is "1i"', async () => {
  const { invoice, errors } = parseInvoice(JSON.stringify(invoiceRaw), 'json');
  deepStrictEqual(errors, []);
  const payload = await encodeInvoice(invoice);
  ok(payload.startsWith('1i'), `payload prefix: ${payload.slice(0, 2)}`);
  deepStrictEqual(await decodeInvoice(payload), invoice);
});

await test('invoice: CSV normalizes identically to the JSON equivalent', () => {
  const csv = Object.entries(invoiceRaw)
    .filter(([k]) => k !== 'items')
    .map(([k, v]) => `${k},${v}`)
    .concat(invoiceRaw.items.map((it) => `item,${it.name},${it.qty},${it.price}`))
    .join('\n');
  const a = parseInvoice(JSON.stringify(invoiceRaw), 'json');
  const b = parseInvoice(csv, 'csv');
  deepStrictEqual(b.errors, []);
  deepStrictEqual(b.invoice, a.invoice);
});

await test('invoice: total = subtotal - discount + tax (no tip)', () => {
  const { invoice } = parseInvoice(JSON.stringify(invoiceRaw), 'json');
  strictEqual(invoice.subtotalMinor, 150000);
  strictEqual(invoice.discountMinor, 5000);
  strictEqual(invoice.taxMinor, 8000);
  strictEqual(invoice.totalMinor, 153000);
});

await test('invoice: lenient mode requires nothing and coerces partial items', () => {
  // Empty form: no seller, no items — strict fails, lenient still renders.
  strictEqual(parseInvoice('{}', 'json').invoice, null);
  const empty = parseInvoice('{}', 'json', { lenient: true });
  deepStrictEqual(empty.errors, [], 'lenient never reports blocking errors');
  ok(empty.invoice, 'lenient yields an invoice with no input');
  strictEqual(empty.invoice.seller.name, null);
  strictEqual(empty.invoice.items.length, 0);
  strictEqual(empty.invoice.totalMinor, 0);

  // Half-typed item (name only, no price/qty) is shown with neutral defaults.
  const partial = parseInvoice(
    JSON.stringify({ items: [{ name: 'Design work' }, { name: '', price: 'oops' }] }),
    'json', { lenient: true },
  ).invoice;
  strictEqual(partial.items.length, 2);
  deepStrictEqual(partial.items[0], { name: 'Design work', qty: 1, priceMinor: 0 });
  strictEqual(partial.items[1].name, 'Item');
  strictEqual(partial.items[1].priceMinor, 0);

  // Lenient must never weaken the strict path used for encoding.
  strictEqual(parseInvoice(JSON.stringify({ items: [{ name: 'x' }] }), 'json').invoice, null);
});

await test('invoice: money strictness — corrupted tax/discount throw (they are money)', async () => {
  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  await expectThrow(decodeInvoice(await forgeInvoice({ ...base, g: 'nope' })), BadPayload);
  await expectThrow(decodeInvoice(await forgeInvoice({ ...base, x: 'nope' })), BadPayload);
  await expectThrow(decodeInvoice(await forgeInvoice({ ...base, i: 'not-an-array' })), BadPayload);
});

await test('invoice: seller name and items are optional — a barely-started invoice round-trips', async () => {
  // A lenient parse of a seller-only form must produce an encodable invoice
  // (no line items) whose link decodes back to the same thing.
  const sellerOnly = parseInvoice(JSON.stringify({ seller: 'Acme' }), 'json', { lenient: true }).invoice;
  strictEqual(sellerOnly.items.length, 0);
  const back = await decodeInvoice(await encodeInvoice(sellerOnly));
  strictEqual(back.seller.name, 'Acme');
  strictEqual(back.items.length, 0);
  strictEqual(back.totalMinor, 0);

  // And an items-only invoice (no seller name) survives the round-trip too.
  const itemsOnly = parseInvoice(JSON.stringify({ items: [{ name: 'Design', price: '10' }] }), 'json', { lenient: true }).invoice;
  const back2 = await decodeInvoice(await encodeInvoice(itemsOnly));
  strictEqual(back2.seller.name, null);
  strictEqual(back2.items[0].name, 'Design');

  // A present-but-wrong-type seller name is still corruption and fails closed.
  await expectThrow(decodeInvoice(await forgeInvoice({ m: 42, i: [], s: 0, t: 0 })), BadPayload);
});

await test('invoice: style/logo fields decode leniently, never throw', async () => {
  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  const r1 = await decodeInvoice(await forgeInvoice({ ...base, u: 'javascript:alert(1)', k: 'red;}', e: 'x'.repeat(40) }));
  strictEqual(r1.logoUrl, null);
  strictEqual(r1.accent, null);
  strictEqual(r1.emoji, null);
});

await test('invoice: embedded logoData round-trips, invalid/oversized dropped leniently', async () => {
  const { invoice, errors } = parseInvoice(JSON.stringify({
    seller: 'S', items: [{ name: 'a', price: 1 }],
  }), 'json');
  deepStrictEqual(errors, []);
  Object.assign(invoice, { logoData: 'aGVsbG8=' });
  strictEqual((await decodeInvoice(await encodeInvoice(invoice))).logoData, 'aGVsbG8=');

  const base = { m: 'M', i: [['a', 1, 100]], s: 100, t: 100 };
  const bad = await decodeInvoice(await forgeInvoice({ ...base, l: 'A'.repeat(7000) }));
  strictEqual(bad.logoData, null, 'over the length cap dropped, not thrown');
});

await test('invoice: default-style payload carries no optional keys (no-growth guard)', async () => {
  const { invoice } = parseInvoice(JSON.stringify({ seller: 'S', items: [{ name: 'a', price: 1 }] }), 'json');
  const payload = await encodeInvoice(invoice);
  const compact = JSON.parse(new TextDecoder().decode(await inflateRaw(unb64u(payload.slice(2)))));
  for (const k of ['n', 'j', 'v', 'r', 'z', 'g', 'x', 'h', 'y', 'f', 'w', 'b', 'k', 'e', 'u', 'l', 'q', 'cf']) {
    ok(!(k in compact), `unexpected key "${k}" in default invoice payload`);
  }
});

await test('invoice: custom-template formatting knobs round-trip; presets carry none', async () => {
  const { invoice } = parseInvoice(JSON.stringify({ seller: 'S', items: [{ name: 'a', price: 1 }] }), 'json');
  strictEqual(invoice.totalsLayout, 'wide', 'totals default to full-width for every template');

  // A non-custom template must never encode a cf block, even if knobs are set.
  Object.assign(invoice, { template: 'modern', totalsLayout: 'compact', font: 'serif' });
  const modernCompact = JSON.parse(new TextDecoder().decode(await inflateRaw(unb64u((await encodeInvoice(invoice)).slice(2)))));
  ok(!('cf' in modernCompact), 'preset template drops custom knobs');

  // The custom template round-trips every non-default knob and validates the rest.
  Object.assign(invoice, {
    template: 'custom', font: 'mono', totalsLayout: 'compact',
    tableStyle: 'zebra', density: 'compact', headerLayout: 'center',
  });
  const decoded = await decodeInvoice(await encodeInvoice(invoice));
  strictEqual(decoded.template, 'custom');
  strictEqual(decoded.font, 'mono');
  strictEqual(decoded.totalsLayout, 'compact');
  strictEqual(decoded.tableStyle, 'zebra');
  strictEqual(decoded.density, 'compact');
  strictEqual(decoded.headerLayout, 'center');

  // Off-list junk decodes back to the neutral default, never throws.
  const forged = await forgeInvoice({ m: 'M', i: [['a', 1, 100]], s: 100, t: 100, w: 'custom', cf: { f: 'comic-sans', t: 5 } });
  const safe = await decodeInvoice(forged);
  strictEqual(safe.font, 'sans');
  strictEqual(safe.totalsLayout, 'wide');
});

await test('invoice: pinned v1 fixture keeps decoding (old-link regression guard)', async () => {
  // Encoded 2026-07-07 from {"seller":"Fixture Consulting","issuedate":"2026-07-07",
  // "items":[{"name":"Widget setup","qty":2,"price":75}],"tax":12}. Do not regenerate.
  const fixture = '1iFcY7CsMwEAXAq5hXr-BpwRZsa8gVUhh3FkYQf4hWIAi5e8hU88EBw6N0b-88zNdZ28vLuUNQYMuCZ9n27EPN3m6IShrJdRVsMCh1CkyBCYIKiyNJQYdF_cdhcVLy-wM';
  const r = await decodeInvoice(fixture);
  strictEqual(r.seller.name, 'Fixture Consulting');
  strictEqual(r.items[0].priceMinor, 7500);
  strictEqual(r.totalMinor, 16200);
});

await test('invoice/receipt payloads are mutually rejected (cross-type safety)', async () => {
  const { receipt } = parseReceipt(sampleJson, 'json');
  const receiptPayload = await encodeReceipt(receipt);
  const { invoice } = parseInvoice(JSON.stringify(invoiceRaw), 'json');
  const invoicePayload = await encodeInvoice(invoice);
  strictEqual(payloadHeader(invoicePayload).docType, DOC_INVOICE);
  await expectThrow(decodeInvoice(receiptPayload), BadPayload);
  await expectThrow(decodeReceipt(invoicePayload), BadPayload);
});

// ---- summary ------------------------------------------------------------------

if (process.exitCode) {
  console.error('\nselftest: FAILURES above');
} else {
  console.log(`\nselftest: all ${passed} tests passed`);
}

if (process.argv.includes('--print-sample-url')) {
  const flagIdx = process.argv.indexOf('--print-sample-url');
  const base = process.argv[flagIdx + 1] || 'http://localhost:8788';
  console.log(`\nSample viewer URL:\n${base}/r#${sampleUrlPayload}`);
}
