/**
 * InvoiceIguana codec — mirrors shared/codec.js's structure for the invoice
 * document shape. Built on the generic payload framing, compression,
 * base64url, and money helpers in shared/wire.js (the same primitives the
 * receipt codec uses).
 *
 * encodeInvoice(normalized) -> "1i" + base64url(deflateRaw(utf8(compactJSON)))
 * decodeInvoice(payload)    -> normalized invoice object
 *
 * Normalized invoice shape (all money in integer minor units, e.g. cents):
 *   { seller: {name, address, contact}, buyer: {name, address, contact},
 *     invoiceNumber, issueDate, dueDate, currency,
 *     items: [{name, qty, priceMinor, discount}], subtotalMinor, discountMinor,
 *     (item.discount is {kind:'pct'|'amt', value} | null — a per-line discount)
 *     taxMinor, taxLabel, totalMinor, paymentInstructions, notes,
 *     template, brandingOff, accent, emoji, logoUrl, logoData, qr }
 * total = subtotal - discount + tax (no tip on an invoice). taxLabel is
 * purely descriptive — it never affects the math.
 * Optional fields are null when absent; subtotal/total are always present.
 * Style fields (logoUrl, logoData) are validated leniently, same as the
 * receipt codec — they can't corrupt the financial record, so bad values
 * fall back to defaults/null instead of throwing. logoData is a small
 * base64 JPEG embedded directly in the link (see shared/logo-embed.js) —
 * takes priority over logoUrl when both are set.
 *
 * Compact key registry (own namespace from the receipt codec's — payloads
 * are dispatched by docType before either is parsed, so there's no risk of
 * cross-reading, but shared concepts intentionally reuse the same letters
 * for readability): m sellerName, a sellerAddress, o sellerContact,
 * n buyerName, j buyerAddress, v buyerContact, r invoiceNumber,
 * d issueDate, z dueDate, c currency, i items, s subtotal, g discount,
 * x tax, h taxLabel, t total, y paymentInstructions, f notes,
 * w template, b brandingOff, k accent, e emoji, u logoUrl, l logoData, q qr,
 * cf customFormat { f font, t totalsLayout, b tableStyle, d density,
 * h headerLayout } — only present for the "custom" template's non-default
 * knobs; every value is validated against a fixed allow-list on the way in.
 */
import {
  VERSION, BadPayload, encoder, decoder,
  b64u, unb64u, deflateRaw, inflateRaw, isMinor,
  ACCENT_RE, isHttpsUrl, asLogoData, payloadHeader,
} from './wire.js';

export const DOC_INVOICE = 'i';

const DEFAULT_CURRENCY = 'USD';

// Custom-formatting knobs (only meaningful for the "custom" template). Each
// entry is [normalized field, compact key, allow-list, default]. The default
// is the first allow-list value; anything off-list decodes back to it.
const CUSTOM_FORMAT = [
  ['font', 'f', ['sans', 'serif', 'mono']],
  ['totalsLayout', 't', ['wide', 'compact']],
  ['tableStyle', 'b', ['lines', 'zebra', 'plain']],
  ['density', 'd', ['comfortable', 'compact']],
  ['headerLayout', 'h', ['default', 'center', 'swap']],
];

function toCompact(inv) {
  const c = {};
  // Seller name and line items are both optional — a barely-started invoice
  // still encodes so its link exists immediately. Absent seller name simply
  // omits `m`; an empty item list encodes as `i: []`.
  if (inv.seller?.name) c.m = inv.seller.name;
  // Item tuple is [name, qty, priceMinor] with an optional 4th element
  // [kind, value] for a per-line discount (kind 0 = percent, 1 = flat minor).
  // Old 3-element links (no line discount) still decode unchanged.
  c.i = inv.items.map((it) => {
    const t = [it.name, it.qty, it.priceMinor];
    if (it.discount) t.push([it.discount.kind === 'pct' ? 0 : 1, it.discount.value]);
    return t;
  });
  if (inv.seller.address) c.a = inv.seller.address;
  if (inv.seller.contact) c.o = inv.seller.contact;
  if (inv.buyer?.name) c.n = inv.buyer.name;
  if (inv.buyer?.address) c.j = inv.buyer.address;
  if (inv.buyer?.contact) c.v = inv.buyer.contact;
  if (inv.invoiceNumber) c.r = inv.invoiceNumber;
  if (inv.issueDate) c.d = inv.issueDate;
  if (inv.dueDate) c.z = inv.dueDate;
  if (inv.currency && inv.currency !== DEFAULT_CURRENCY) c.c = inv.currency;
  c.s = inv.subtotalMinor;
  if (inv.discountMinor != null) c.g = inv.discountMinor;
  if (inv.taxMinor != null) c.x = inv.taxMinor;
  if (inv.taxLabel) c.h = inv.taxLabel;
  c.t = inv.totalMinor;
  if (inv.paymentInstructions) c.y = inv.paymentInstructions;
  if (inv.notes) c.f = inv.notes;
  if (inv.template && inv.template !== 'classic') c.w = inv.template;
  if (inv.brandingOff) c.b = 1;
  if (inv.accent) c.k = inv.accent;
  if (inv.emoji) c.e = inv.emoji;
  if (inv.logoUrl) c.u = inv.logoUrl;
  if (inv.logoData) c.l = inv.logoData;
  if (inv.qr) c.q = 1;
  // Only the custom template carries formatting knobs, and only their
  // non-default values — presets stay byte-for-byte as before.
  if (inv.template === 'custom') {
    const cf = {};
    for (const [field, key, allowed] of CUSTOM_FORMAT) {
      if (inv[field] && inv[field] !== allowed[0]) cf[key] = inv[field];
    }
    if (Object.keys(cf).length) c.cf = cf;
  }
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
  const cf = c.cf && typeof c.cf === 'object' && !Array.isArray(c.cf) ? c.cf : {};
  const custom = {};
  for (const [field, key, allowed] of CUSTOM_FORMAT) {
    custom[field] = allowed.includes(cf[key]) ? cf[key] : allowed[0];
  }
  return { template, brandingOff: !!c.b, accent, emoji, logoUrl, logoData, qr: !!c.q, ...custom };
}

function fromCompact(c) {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new BadPayload('Payload is not an invoice object');
  }
  // Seller name and items are optional (see toCompact), but a present value of
  // the wrong type is still corruption and fails closed rather than being
  // silently reinterpreted.
  if (c.m != null && typeof c.m !== 'string') throw new BadPayload('Bad seller name');
  if (c.i != null && !Array.isArray(c.i)) throw new BadPayload('Bad line items');
  const items = (Array.isArray(c.i) ? c.i : []).map((it, idx) => {
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
  for (const k of ['a', 'o', 'n', 'j', 'v', 'r', 'd', 'z', 'c', 'y', 'f', 'h']) {
    if (c[k] != null && typeof c[k] !== 'string') throw new BadPayload(`Bad field "${k}"`);
  }
  return {
    seller: { name: c.m ?? null, address: c.a ?? null, contact: c.o ?? null },
    buyer: { name: c.n ?? null, address: c.j ?? null, contact: c.v ?? null },
    invoiceNumber: c.r ?? null,
    issueDate: c.d ?? null,
    dueDate: c.z ?? null,
    currency: c.c ?? DEFAULT_CURRENCY,
    items,
    subtotalMinor: c.s,
    discountMinor: c.g ?? null,
    taxMinor: c.x ?? null,
    taxLabel: c.h ?? null,
    totalMinor: c.t,
    paymentInstructions: c.y ?? null,
    notes: c.f ?? null,
    ...styleFromCompact(c),
  };
}

// ---- public API --------------------------------------------------------------

export async function encodeInvoice(normalized) {
  const json = JSON.stringify(toCompact(normalized));
  const packed = await deflateRaw(encoder.encode(json));
  return VERSION + DOC_INVOICE + b64u(packed);
}

export async function decodeInvoice(payload) {
  const { docType, body } = payloadHeader(payload);
  if (docType !== DOC_INVOICE) {
    throw new BadPayload(`Not an invoice payload (doc type "${docType}")`);
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
    throw new BadPayload('Payload does not contain valid invoice data');
  }
  return fromCompact(compact);
}
