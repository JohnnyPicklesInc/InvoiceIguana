/**
 * Receipt codec — the whole receipt lives in the link.
 *
 * encodeReceipt(normalized) -> "1r" + base64url(deflateRaw(utf8(compactJSON)))
 * decodeReceipt(payload)    -> normalized receipt object
 *
 * The payload prefix is <version><docType>. The doc-type char reserves one
 * payload space for the whole link-native family ('r' receipt, 'i' invoice,
 * 'q' quote, 'c' card, 'p' recipe) so a single viewer can dispatch them all.
 * Generic framing/compression/money/validation primitives live in
 * `shared/wire.js` and are re-exported here for backward compatibility —
 * `shared/invoice-codec.js` builds on the same primitives.
 *
 * Standards-only (Web Streams + TextEncoder + btoa/atob), so the same module
 * runs in the browser (generator + viewer) and under Node 18+ for selftests.
 *
 * Normalized receipt shape (all money in integer minor units, e.g. cents):
 *   { merchant, address, contact, date, reference, currency,
 *     items: [{name, qty, priceMinor, discount}], subtotalMinor, discountMinor,
 *     (item.discount is {kind:'pct'|'amt', value} | null — a per-line discount)
 *     taxMinor, taxLabel, tipMinor, totalMinor, payment, footer,
 *     template, brandingOff, accent, emoji, logoUrl, logoData, qr }
 * total = subtotal - discount + tax + tip. taxLabel is purely descriptive
 * (e.g. "NY Sales Tax (8.875%)") — it never affects the math.
 * Optional fields are null when absent; subtotal/total are always present.
 * Style fields (logoUrl, logoData) are validated leniently — they can't
 * corrupt the financial record, so bad values fall back to defaults/null
 * instead of throwing. logoUrl is restricted to https: — an http: image
 * would be mixed-content-blocked on this site anyway, and it keeps the
 * validation simple (no scheme-confusion tricks like javascript:/data:).
 * logoData is a small base64 JPEG embedded directly in the link (see
 * shared/logo-embed.js) — takes priority over logoUrl when both are set,
 * since it's guaranteed to render and never contacts a third party.
 *
 * Compact key registry (single source of truth — check here before adding
 * a new one): m merchant, a address, o contact, d date, r reference,
 * c currency, i items, s subtotal, g discount, x tax, h taxLabel, p tip,
 * t total, y payment, f footer, w template, b brandingOff, k accent,
 * e emoji, u logoUrl, l logoData, q qr.
 */
import {
  VERSION, BadVersion, BadPayload, encoder, decoder,
  b64u, unb64u, deflateRaw, inflateRaw,
  currencyExponent, toMinor, fromMinor, isMinor,
  ACCENT_RE, isHttpsUrl, asLogoData, payloadHeader,
} from './wire.js';

export {
  BadVersion, BadPayload, b64u, unb64u, deflateRaw, inflateRaw,
  currencyExponent, toMinor, fromMinor, isHttpsUrl, payloadHeader,
};

export const DOC_RECEIPT = 'r';

// ---- compact wire form -------------------------------------------------------

const DEFAULT_CURRENCY = 'USD';

function toCompact(r) {
  // Item tuple is [name, qty, priceMinor] with an optional 4th element
  // [kind, value] for a per-line discount (kind 0 = percent, 1 = flat minor).
  // Old 3-element links (no line discount) still decode unchanged.
  const c = {
    m: r.merchant,
    i: r.items.map((it) => {
      const t = [it.name, it.qty, it.priceMinor];
      if (it.discount) t.push([it.discount.kind === 'pct' ? 0 : 1, it.discount.value]);
      return t;
    }),
  };
  if (r.address) c.a = r.address;
  if (r.contact) c.o = r.contact;
  if (r.date) c.d = r.date;
  if (r.reference) c.r = r.reference;
  if (r.currency && r.currency !== DEFAULT_CURRENCY) c.c = r.currency;
  c.s = r.subtotalMinor;
  if (r.discountMinor != null) c.g = r.discountMinor;
  if (r.taxMinor != null) c.x = r.taxMinor;
  if (r.taxLabel) c.h = r.taxLabel;
  if (r.tipMinor != null) c.p = r.tipMinor;
  c.t = r.totalMinor;
  if (r.payment) c.y = r.payment;
  if (r.footer) c.f = r.footer;
  // Style keys ride only when non-default, so plain receipts don't grow a byte.
  if (r.template && r.template !== 'classic') c.w = r.template;
  if (r.brandingOff) c.b = 1;
  if (r.accent) c.k = r.accent;
  if (r.emoji) c.e = r.emoji;
  if (r.logoUrl) c.u = r.logoUrl;
  if (r.logoData) c.l = r.logoData;
  if (r.qr) c.q = 1;
  return c;
}

/** Lenient style decoding — bad values become defaults, never errors. */
function styleFromCompact(c) {
  const template = typeof c.w === 'string' && /^[a-z]{1,8}$/.test(c.w) ? c.w : 'classic';
  const accent = typeof c.k === 'string' && ACCENT_RE.test(c.k.toLowerCase())
    ? c.k.toLowerCase() : null;
  const emoji = typeof c.e === 'string' && c.e.trim() && c.e.length <= 8
    ? c.e.trim() : null;
  const logoUrl = isHttpsUrl(c.u) ? c.u : null;
  const logoData = asLogoData(c.l);
  return { template, brandingOff: !!c.b, accent, emoji, logoUrl, logoData, qr: !!c.q };
}

function fromCompact(c) {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new BadPayload('Payload is not a receipt object');
  }
  if (typeof c.m !== 'string' || !c.m) throw new BadPayload('Missing merchant');
  if (!Array.isArray(c.i) || c.i.length === 0) throw new BadPayload('Missing line items');
  const items = c.i.map((it, idx) => {
    if (!Array.isArray(it) || it.length < 3 || it.length > 4) throw new BadPayload(`Bad line item ${idx + 1}`);
    const [name, qty, priceMinor, disc] = it;
    if (typeof name !== 'string' || !name) throw new BadPayload(`Bad name in item ${idx + 1}`);
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new BadPayload(`Bad quantity in item ${idx + 1}`);
    if (!isMinor(priceMinor)) throw new BadPayload(`Bad price in item ${idx + 1}`);
    let discount = null;
    if (disc != null) {
      if (!Array.isArray(disc) || disc.length !== 2) throw new BadPayload(`Bad discount in item ${idx + 1}`);
      const [k, v] = disc;
      if ((k !== 0 && k !== 1) || typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw new BadPayload(`Bad discount in item ${idx + 1}`);
      }
      if (k === 1 && !isMinor(v)) throw new BadPayload(`Bad discount in item ${idx + 1}`);
      discount = { kind: k === 0 ? 'pct' : 'amt', value: v };
    }
    return { name, qty, priceMinor, discount };
  });
  if (!isMinor(c.s)) throw new BadPayload('Bad subtotal');
  if (!isMinor(c.t)) throw new BadPayload('Bad total');
  if (c.g != null && !isMinor(c.g)) throw new BadPayload('Bad discount');
  if (c.x != null && !isMinor(c.x)) throw new BadPayload('Bad tax');
  if (c.p != null && !isMinor(c.p)) throw new BadPayload('Bad tip');
  for (const k of ['a', 'o', 'd', 'r', 'c', 'y', 'f', 'h']) {
    if (c[k] != null && typeof c[k] !== 'string') throw new BadPayload(`Bad field "${k}"`);
  }
  return {
    merchant: c.m,
    address: c.a ?? null,
    contact: c.o ?? null,
    date: c.d ?? null,
    reference: c.r ?? null,
    currency: c.c ?? DEFAULT_CURRENCY,
    items,
    subtotalMinor: c.s,
    discountMinor: c.g ?? null,
    taxMinor: c.x ?? null,
    taxLabel: c.h ?? null,
    tipMinor: c.p ?? null,
    totalMinor: c.t,
    payment: c.y ?? null,
    footer: c.f ?? null,
    ...styleFromCompact(c),
  };
}

// ---- public API --------------------------------------------------------------

export async function encodeReceipt(normalized) {
  const json = JSON.stringify(toCompact(normalized));
  const packed = await deflateRaw(encoder.encode(json));
  return VERSION + DOC_RECEIPT + b64u(packed);
}

export async function decodeReceipt(payload) {
  const { docType, body } = payloadHeader(payload);
  if (docType !== DOC_RECEIPT) {
    throw new BadPayload(`Not a receipt payload (doc type "${docType}")`);
  }
  let json;
  try {
    json = decoder.decode(await inflateRaw(unb64u(body)));
  } catch {
    throw new BadPayload('Payload is corrupted or truncated');
  }
  let compact;
  try {
    compact = JSON.parse(json);
  } catch {
    throw new BadPayload('Payload does not contain valid receipt data');
  }
  return fromCompact(compact);
}
