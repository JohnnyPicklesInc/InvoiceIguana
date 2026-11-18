/**
 * Bill splitter — "who owes what" for a shared bill, as a link (doc type "s").
 *
 * A split is the bill's inputs (people, items and who had them, tax, tip, who
 * paid, how to pay them); every share is *computed* from those by splitShares()
 * on both the generator and the viewer, so a link can never carry a wrong share.
 *
 *   parseSplit(raw)          -> { split, errors, warnings }   (raw = upload/readable/connector fields)
 *   splitShares(split)       -> { subtotalMinor, taxMinor, tipMinor, totalMinor, shares: [...] }
 *   payLinks(split, minor)   -> [{ label, href }]  for one person's amount
 *   encodeSplit / decodeSplit  "1s" + base64url(deflate-raw(compact JSON))
 *
 * Money is integer minor units throughout (see wire.js).
 */
import {
  VERSION, BadPayload, encoder, decoder, b64u, unb64u, deflateRaw, inflateRaw,
  isMinor, isHttpsUrl, payloadHeader, toMinor, fromMinor, currencyExponent,
} from './wire.js';

export const DOC_SPLIT = 's';
const DEFAULT_CURRENCY = 'USD';
const MAX_PEOPLE = 30;
const MAX_ITEMS = 100;
const HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;

// ---- parsing (raw fields -> normalized split) ----------------------------------

const str = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const handle = (v) => {
  const h = str(v, 41)?.replace(/^[@$]/, '');
  return h && HANDLE_RE.test(h) ? h : null;
};

/**
 * raw: { title, date, currency, people, paidby, items: [{name, price, who}],
 *        amount, tax, taxrate, tip, tippercent, paypal, cashapp, venmo,
 *        paymenturl, note }
 * `people` and an item's `who` may be arrays or comma-separated strings; an
 * item with no `who` is shared by everyone. Give either items or amount.
 */
export function parseSplit(raw) {
  const errors = [];
  const warnings = [];
  const currency = (str(raw.currency, 3) || DEFAULT_CURRENCY).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push(`"currency" must be a 3-letter code (got "${raw.currency}")`);

  const people = [];
  const seen = new Map();
  for (const name of list(raw.people)) {
    const n = name.slice(0, 40);
    if (seen.has(n.toLowerCase())) continue;
    seen.set(n.toLowerCase(), people.length);
    people.push(n);
  }
  if (people.length < 2) errors.push('At least two people are needed ("people")');
  if (people.length > MAX_PEOPLE) errors.push(`At most ${MAX_PEOPLE} people`);
  const indexOf = (name) => seen.get(String(name).trim().toLowerCase());

  let payer = null;
  if (raw.paidby != null && String(raw.paidby).trim()) {
    payer = indexOf(raw.paidby);
    if (payer == null) errors.push(`"paidby" (${raw.paidby}) isn't one of the people`);
  }

  const safeMinor = (v, what) => {
    const n = num(v);
    if (n == null) return null;
    if (Number.isNaN(n) || n < 0) { errors.push(`${what} must be a non-negative number (got "${v}")`); return null; }
    try { return toMinor(n, currency); } catch { errors.push(`${what} is out of range`); return null; }
  };

  const items = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length > MAX_ITEMS) errors.push(`At most ${MAX_ITEMS} items`);
  rawItems.slice(0, MAX_ITEMS).forEach((it, i) => {
    const name = str(it?.name, 80);
    if (!name) { errors.push(`Item ${i + 1}: a name is required`); return; }
    const priceMinor = safeMinor(it.price, `Item ${i + 1} price`);
    if (priceMinor == null) { if (it.price == null || it.price === '') errors.push(`Item ${i + 1}: a price is required`); return; }
    const who = [];
    for (const w of list(it.who)) {
      if (/^(everyone|all|everybody)$/i.test(w)) { who.length = 0; break; }
      const idx = indexOf(w);
      if (idx == null) errors.push(`Item ${i + 1} (${name}): "${w}" isn't one of the people`);
      else if (!who.includes(idx)) who.push(idx);
    }
    items.push({ name, priceMinor, who: who.sort((a, b) => a - b) });
  });

  const amountMinor = items.length ? null : safeMinor(raw.amount, '"amount"');
  if (!items.length && amountMinor == null && !errors.length) errors.push('Give either "items" or a total "amount" to split');
  if (items.length && raw.amount != null && raw.amount !== '') warnings.push('"amount" is ignored when items are given');

  const subtotalMinor = items.length ? items.reduce((s, it) => s + it.priceMinor, 0) : (amountMinor ?? 0);
  const fromRate = (rate, what) => {
    const r = num(rate);
    if (r == null) return null;
    if (Number.isNaN(r) || r < 0 || r > 100) { errors.push(`${what} must be a percent between 0 and 100`); return null; }
    return Math.round(subtotalMinor * r / 100);
  };
  // A flat amount wins over a rate; "18%" in the amount field means a rate.
  const pctIn = (v) => typeof v === 'string' && /%\s*$/.test(v);
  const taxMinor = pctIn(raw.tax) ? fromRate(raw.tax, '"tax"')
    : (safeMinor(raw.tax, '"tax"') ?? fromRate(raw.taxrate, '"taxrate"'));
  const tipMinor = pctIn(raw.tip) ? fromRate(raw.tip, '"tip"')
    : (safeMinor(raw.tip, '"tip"') ?? fromRate(raw.tippercent, '"tippercent"'));

  const paymentUrl = raw.paymenturl == null || raw.paymenturl === '' ? null
    : (isHttpsUrl(String(raw.paymenturl).trim()) ? String(raw.paymenturl).trim() : (errors.push('"paymenturl" must be an https link'), null));
  const pay = { paypal: handle(raw.paypal), cashapp: handle(raw.cashapp), venmo: handle(raw.venmo), url: paymentUrl };
  for (const k of ['paypal', 'cashapp', 'venmo']) {
    if (raw[k] && !pay[k]) errors.push(`"${k}" doesn't look like a ${k} username (got "${raw[k]}")`);
  }

  const split = {
    title: str(raw.title, 80),
    date: str(raw.date, 40),
    currency,
    people,
    payer,
    items,
    amountMinor,
    taxMinor: taxMinor || null,
    tipMinor: tipMinor || null,
    pay,
    note: str(raw.note, 300),
  };
  return { split: errors.length ? null : split, errors, warnings };
}

// ---- the math --------------------------------------------------------------------

/** Round exact (fractional) amounts to whole minor units that sum to `total`,
 *  giving the leftover units to the largest remainders (ties: list order). */
function allocate(exact, total) {
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k][1]]++;
  return floors;
}

export function splitShares(s) {
  const n = s.people.length;
  const everyone = [...Array(n).keys()];
  const base = Array(n).fill(0);
  const lines = Array.from({ length: n }, () => []);
  if (s.items.length) {
    for (const it of s.items) {
      const who = it.who.length ? it.who : everyone;
      for (const i of who) {
        base[i] += it.priceMinor / who.length;
        lines[i].push({ name: it.name, shared: who.length, minor: it.priceMinor / who.length });
      }
    }
  } else {
    for (const i of everyone) base[i] = s.amountMinor / n;
  }
  const subtotalMinor = s.items.length ? s.items.reduce((a, it) => a + it.priceMinor, 0) : s.amountMinor;
  const extras = (s.taxMinor ?? 0) + (s.tipMinor ?? 0);
  const totalMinor = subtotalMinor + extras;
  // Tax and tip follow each person's share of the subtotal.
  const exact = base.map((b) => (subtotalMinor > 0 ? b + extras * (b / subtotalMinor) : extras / n));
  const owed = allocate(exact, totalMinor);
  return {
    subtotalMinor, taxMinor: s.taxMinor ?? 0, tipMinor: s.tipMinor ?? 0, totalMinor,
    shares: s.people.map((name, i) => ({ name, minor: owed[i], isPayer: s.payer === i, lines: lines[i] })),
  };
}

/** Pay buttons for one person's share, from the payer's handles. */
export function payLinks(s, minor) {
  const amt = fromMinor(minor, s.currency).toFixed(currencyExponent(s.currency));
  const out = [];
  if (s.pay.paypal) out.push({ label: 'PayPal', href: `https://paypal.me/${encodeURIComponent(s.pay.paypal)}/${amt}${s.currency !== 'USD' ? s.currency : ''}` });
  if (s.pay.cashapp && s.currency === 'USD') out.push({ label: 'Cash App', href: `https://cash.app/$${encodeURIComponent(s.pay.cashapp)}/${amt}` });
  if (s.pay.venmo && s.currency === 'USD') out.push({ label: 'Venmo', href: `https://venmo.com/u/${encodeURIComponent(s.pay.venmo)}` });
  if (s.pay.url) out.push({ label: 'Pay', href: s.pay.url });
  return out;
}

// ---- codec -----------------------------------------------------------------------

function toCompact(s) {
  const c = { p: s.people };
  if (s.title) c.t = s.title;
  if (s.date) c.d = s.date;
  if (s.currency !== DEFAULT_CURRENCY) c.c = s.currency;
  if (s.payer != null) c.b = s.payer;
  if (s.items.length) c.i = s.items.map((it) => (it.who.length ? [it.name, it.priceMinor, it.who] : [it.name, it.priceMinor]));
  else c.a = s.amountMinor;
  if (s.taxMinor) c.x = s.taxMinor;
  if (s.tipMinor) c.g = s.tipMinor;
  if (s.pay.paypal) c.pp = s.pay.paypal;
  if (s.pay.cashapp) c.ca = s.pay.cashapp;
  if (s.pay.venmo) c.vm = s.pay.venmo;
  if (s.pay.url) c.u = s.pay.url;
  if (s.note) c.n = s.note;
  return c;
}

function fromCompact(c) {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) throw new BadPayload('Payload is not a split');
  if (!Array.isArray(c.p) || c.p.length < 2 || c.p.length > MAX_PEOPLE || !c.p.every((x) => typeof x === 'string' && x)) {
    throw new BadPayload('Bad people');
  }
  const n = c.p.length;
  const items = (Array.isArray(c.i) ? c.i : []).map((it, k) => {
    if (!Array.isArray(it) || it.length < 2 || it.length > 3) throw new BadPayload(`Bad item ${k + 1}`);
    const [name, priceMinor, who = []] = it;
    if (typeof name !== 'string' || !name || !isMinor(priceMinor) || priceMinor < 0) throw new BadPayload(`Bad item ${k + 1}`);
    if (!Array.isArray(who) || !who.every((i) => Number.isInteger(i) && i >= 0 && i < n)) throw new BadPayload(`Bad item ${k + 1}`);
    return { name, priceMinor, who };
  });
  if (!items.length && !(isMinor(c.a) && c.a >= 0)) throw new BadPayload('Bad amount');
  for (const k of ['x', 'g']) if (c[k] != null && !(isMinor(c[k]) && c[k] >= 0)) throw new BadPayload(`Bad ${k}`);
  if (c.b != null && !(Number.isInteger(c.b) && c.b >= 0 && c.b < n)) throw new BadPayload('Bad payer');
  for (const k of ['t', 'd', 'c', 'n']) if (c[k] != null && typeof c[k] !== 'string') throw new BadPayload(`Bad field "${k}"`);
  const h = (v) => (typeof v === 'string' && HANDLE_RE.test(v) ? v : null);
  return {
    title: c.t ?? null,
    date: c.d ?? null,
    currency: c.c ?? DEFAULT_CURRENCY,
    people: c.p,
    payer: c.b ?? null,
    items,
    amountMinor: items.length ? null : c.a,
    taxMinor: c.x ?? null,
    tipMinor: c.g ?? null,
    pay: { paypal: h(c.pp), cashapp: h(c.ca), venmo: h(c.vm), url: isHttpsUrl(c.u) ? c.u : null },
    note: c.n ?? null,
  };
}

export async function encodeSplit(s) {
  return VERSION + DOC_SPLIT + b64u(await deflateRaw(encoder.encode(JSON.stringify(toCompact(s)))));
}

export async function decodeSplit(payload) {
  const { docType, body } = payloadHeader(payload);
  if (docType !== DOC_SPLIT) throw new BadPayload(`Not a split payload (doc type "${docType}")`);
  let compact;
  try {
    compact = JSON.parse(decoder.decode(await inflateRaw(unb64u(body))));
  } catch {
    throw new BadPayload('Payload is corrupted or truncated');
  }
  return fromCompact(compact);
}
