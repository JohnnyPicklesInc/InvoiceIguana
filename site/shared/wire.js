/**
 * Generic wire-format primitives shared by every document type in the
 * link-native family (receipts, invoices, and whatever comes next). None of
 * this is receipt-specific — it's the payload framing, compression,
 * base64url, money, and validation plumbing that `shared/codec.js` (receipts)
 * and `shared/invoice-codec.js` (invoices) both build on.
 *
 * Standards-only (Web Streams + TextEncoder + btoa/atob), so it runs in the
 * browser and under Node 18+ for selftests.
 */

export const VERSION = '1';

export class BadVersion extends Error {
  constructor(got) {
    super(`Unsupported payload version "${got}"`);
    this.name = 'BadVersion';
  }
}

export class BadPayload extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'BadPayload';
  }
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

// ---- base64url (ported from WhisperFox public/crypto.js) -------------------

export function b64u(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- deflate-raw via native streams ----------------------------------------

async function pump(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export function deflateRaw(bytes) {
  return pump(bytes, new CompressionStream('deflate-raw'));
}

export function inflateRaw(bytes) {
  return pump(bytes, new DecompressionStream('deflate-raw'));
}

// ---- money helpers ----------------------------------------------------------

/** Currencies whose minor unit is not 2 decimal places. */
const CURRENCY_EXPONENTS = {
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
};

export function currencyExponent(currency) {
  const e = CURRENCY_EXPONENTS[String(currency).toUpperCase()];
  return e === undefined ? 2 : e;
}

/** "3.50" or 3.5 -> 350 (for exponent 2). Throws on non-numeric input. */
export function toMinor(value, currency) {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new BadPayload(`Not a number: ${value}`);
  const minor = Math.round(n * 10 ** currencyExponent(currency));
  if (!Number.isSafeInteger(minor)) throw new BadPayload(`Amount out of range: ${value}`);
  return minor;
}

export function fromMinor(minor, currency) {
  return minor / 10 ** currencyExponent(currency);
}

export function isMinor(v) {
  return Number.isSafeInteger(v);
}

// ---- style-field validation (shared by every doc type's lenient decoding) ----

export const ACCENT_RE = /^[0-9a-f]{3}$|^[0-9a-f]{6}$/;

/** https:-only, length-capped. Never throws — callers treat a bad value as absent. */
export function isHttpsUrl(str) {
  if (typeof str !== 'string' || str.length > 500) return false;
  try {
    return new URL(str).protocol === 'https:';
  } catch {
    return false;
  }
}

// ---- upload-parsing validation helpers (shared by every doc type's parser) ----

export function asOptionalString(raw, key, errors, maxLen = 200) {
  const v = raw[key];
  if (v == null || v === '') return null;
  if (typeof v !== 'string' && typeof v !== 'number') {
    errors.push(`"${key}" must be text`);
    return null;
  }
  const s = String(v).trim();
  if (s.length > maxLen) {
    errors.push(`"${key}" is too long (max ${maxLen} characters)`);
    return null;
  }
  return s || null;
}

export function asOptionalMoney(raw, key, currency, errors) {
  const v = raw[key];
  if (v == null || v === '') return null;
  try {
    return toMinor(v, currency);
  } catch {
    errors.push(`"${key}" is not a number: ${v}`);
    return null;
  }
}

/** https:-only, with a clear error message (unlike isHttpsUrl's silent lenient check). */
export function asOptionalHttpsUrl(raw, key, errors) {
  const v = raw[key];
  if (v == null || v === '') return null;
  if (typeof v !== 'string') { errors.push(`"${key}" must be text`); return null; }
  const s = v.trim();
  if (s.length > 500) { errors.push(`"${key}" is too long (max 500 characters)`); return null; }
  let url;
  try {
    url = new URL(s);
  } catch {
    errors.push(`"${key}" is not a valid URL`);
    return null;
  }
  if (url.protocol !== 'https:') {
    errors.push(`"${key}" must be an https:// URL`);
    return null;
  }
  return s;
}

// ---- payload framing ----------------------------------------------------------

/**
 * Splits a raw hash payload into { version, docType, body } without decoding
 * the document-specific compact form. Every doc-type codec's decode function
 * calls this first and checks its own expected docType.
 */
export function payloadHeader(payload) {
  const p = String(payload || '');
  if (p.length < 3) throw new BadPayload('Empty payload');
  if (p[0] !== VERSION) throw new BadVersion(p[0]);
  return { version: p[0], docType: p[1], body: p.slice(2) };
}
