/**
 * Readable links — a document format a person or an AI assistant can write by
 * hand, no compression needed (split links: see readableSplitRaw):
 *
 *   /r#doc=invoice&seller=Joe's Plumbing&buyer=Ann Lee&item=Fix sink|2|120&taxrate=8
 *
 * The fragment is form-encoded (URLSearchParams rules: `+` or %20 for spaces,
 * %26 for a literal &). `doc` is invoice | quote | receipt. Each `item` is
 * `name|qty|price` (also `name|price`, or `name|qty|price|unit|discount%`).
 * Every other key is a field from the JSON upload format (README "File
 * formats"), plus `taxrate` (percent of subtotal - discount), `template` and
 * `accent`. Totals are always computed, never read from the link.
 *
 * The viewer converts a readable link into the normal compact payload on
 * arrival (history.replaceState), so what gets shared onward is the short,
 * robust link. Also used by the LinkLynx MCP connector (../../LinkLynx), which
 * is why the tax-rate and style helpers live here rather than in the viewer.
 */
import { parseInvoice } from './invoice-parse.js';
import { parseReceipt } from './parse.js';
import { encodeInvoice } from './invoice-codec.js';
import { encodeQuote } from './quote-codec.js';
import { encodeReceipt, fromMinor } from './codec.js';
import { ACCENT_RE } from './wire.js';
import { parseSplit, encodeSplit } from './split.js';

export const INVOICE_TEMPLATES = ['classic', 'modern', 'minimal', 'bold', 'corp', 'compact', 'creative'];
export const RECEIPT_TEMPLATES = ['classic', 'inv', 'min', 'ele'];

const DOC_KINDS = ['invoice', 'quote', 'receipt', 'split'];

/** A compact payload is base64url after a 2-char header, so it never has '='. */
export function isReadableFragment(fragment) {
  return /(^|&)doc=/.test(String(fragment || '').replace(/^#?\??/, ''));
}

/** Loose money: "$1,200.50" -> "1200.50". Left as-is if nothing numeric remains. */
function money(v) {
  const s = String(v ?? '').trim();
  const cleaned = s.replace(/[^\d.\-]/g, '');
  return cleaned && cleaned !== '-' && cleaned !== '.' ? cleaned : s;
}

function itemFrom(spec) {
  const f = String(spec).split('|').map((x) => x.trim());
  if (f.length === 1) return { name: f[0], price: '' };
  if (f.length === 2) return { name: f[0], qty: 1, price: money(f[1]) };
  const it = { name: f[0], qty: f[1] === '' ? 1 : f[1], price: money(f[2]) };
  if (f[3]) it.unit = f[3];
  if (f[4]) {
    const d = f[4];
    if (/^\$|amount/i.test(d)) { it.discount = money(d); it.discounttype = 'amount'; }
    else it.discount = money(d);
  }
  return it;
}

const MONEY_KEYS = new Set(['discount', 'tax', 'tip']);
const ALIASES = { from: 'seller', to: 'buyer', client: 'buyer', number: 'invoicenumber', due: 'duedate' };

/** Fragment string -> { kind, raw, taxrate, style } (no validation yet). */
export function readableToRaw(fragment) {
  const params = new URLSearchParams(String(fragment || '').replace(/^#?\??/, ''));
  const kind = String(params.get('doc') || '').trim().toLowerCase();
  const raw = { items: [] };
  let taxrate = null;
  const style = {};
  for (const [k0, v] of params) {
    const k = k0.trim().toLowerCase();
    // Totals are always computed from the items, never taken from the link.
    if (k === 'doc' || k === 'total' || k === 'subtotal') continue;
    if (k === 'item') { raw.items.push(itemFrom(v)); continue; }
    if (k === 'taxrate') { taxrate = money(v); continue; }
    if (k === 'template' || k === 'accent') { style[k] = v.trim(); continue; }
    if (k === 'tax' && /%\s*$/.test(v)) { taxrate = money(v); continue; }
    const key = ALIASES[k] || k;
    raw[key] = MONEY_KEYS.has(key) ? money(v) : v;
  }
  if (kind === 'receipt' && raw.merchant == null && raw.seller != null) {
    raw.merchant = raw.seller; delete raw.seller;
  }
  if (kind !== 'receipt' && raw.issuedate == null && raw.date != null) {
    raw.issuedate = raw.date; delete raw.date;
  }
  return { kind: DOC_KINDS.includes(kind) ? kind : null, raw, taxrate, style };
}

/**
 * Parse with the app's parser; if a tax rate was given (and no flat tax),
 * parse once to learn the subtotal, then again with the computed flat tax so
 * the parser does the rest of the math. Returns the parser's own result shape.
 */
export function parseWithTaxRate(kind, raw, taxrate) {
  const parse = (r) => (kind === 'receipt' ? parseReceipt : parseInvoice)(JSON.stringify(r), 'json');
  const res = parse(raw);
  const doc = res.invoice || res.receipt;
  const rate = Number(taxrate);
  if (!doc || raw.tax != null || !(rate > 0)) return res;
  const taxMinor = Math.round((doc.subtotalMinor - (doc.discountMinor ?? 0)) * rate / 100);
  if (taxMinor <= 0) return res;
  const withTax = { ...raw, tax: fromMinor(taxMinor, doc.currency) };
  if (!withTax.taxlabel) withTax.taxlabel = `Tax (${rate}%)`;
  return parse(withTax);
}

/** Template + accent, validated; anything off-list is ignored. */
export function applyStyle(doc, style, kind) {
  const templates = kind === 'receipt' ? RECEIPT_TEMPLATES : INVOICE_TEMPLATES;
  if (templates.includes(style?.template)) doc.template = style.template;
  const hex = typeof style?.accent === 'string' ? style.accent.replace(/^#/, '').toLowerCase() : '';
  if (ACCENT_RE.test(hex)) doc.accent = hex;
}

export function encodeDoc(kind, doc) {
  if (kind === 'receipt') return encodeReceipt(doc);
  return kind === 'quote' ? encodeQuote(doc) : encodeInvoice(doc);
}

/**
 * Readable fragment -> { payload, kind, doc, warnings } or { errors }.
 * `payload` is the normal compact link payload (what /r# and the generators use).
 */
/** Split links: `item=name|price|who` (who = comma list of people, blank =
 *  everyone); the other keys go straight to parseSplit. */
export function readableSplitRaw(fragment) {
  const params = new URLSearchParams(String(fragment || '').replace(/^#?\??/, ''));
  const raw = { items: [] };
  for (const [k0, v] of params) {
    const k = k0.trim().toLowerCase();
    if (k === 'doc' || k === 'total' || k === 'subtotal') continue;
    if (k === 'item') {
      const [name, price, who] = v.split('|').map((x) => x.trim());
      raw.items.push({ name, price, who: who || '' });
    } else if (k === 'person') {
      raw.people = [...(Array.isArray(raw.people) ? raw.people : []), v];
    } else {
      raw[k] = v;
    }
  }
  return raw;
}

export async function readableToPayload(fragment) {
  const { kind, raw, taxrate, style } = readableToRaw(fragment);
  if (!kind) return { errors: ['"doc" must be invoice, quote, receipt or split'] };
  if (kind === 'split') {
    const res = parseSplit(readableSplitRaw(fragment));
    if (!res.split) return { errors: res.errors };
    return { payload: await encodeSplit(res.split), kind, doc: res.split, warnings: res.warnings };
  }
  const res = parseWithTaxRate(kind, raw, taxrate);
  const doc = res.invoice || res.receipt;
  if (!doc) return { errors: res.errors };
  applyStyle(doc, style, kind);
  return { payload: await encodeDoc(kind, doc), kind, doc, warnings: res.warnings };
}
