/**
 * Upload parsing for receipts. Accepts the friendly JSON or CSV formats and
 * normalizes both to the same internal receipt object used by the codec
 * (all money as integer minor units).
 *
 * parseReceipt(text, format) -> { receipt, errors, warnings }
 *   - format: 'json' | 'csv' (pick by file extension)
 *   - errors:   string[] — receipt is null if any
 *   - warnings: string[] — non-blocking (e.g. provided total ≠ computed total)
 *
 * Standards-only: runs in the browser and under Node for selftests.
 */

import { toMinor, currencyExponent } from './codec.js';
import { asOptionalString, asOptionalMoney, asOptionalHttpsUrl } from './wire.js';

const META_KEYS = ['merchant', 'address', 'contact', 'date', 'reference', 'currency',
  'discount', 'tax', 'taxlabel', 'tip', 'subtotal', 'total', 'payment', 'footer', 'logourl'];

export function parseReceipt(text, format) {
  const errors = [];
  const warnings = [];
  let raw;
  try {
    raw = format === 'csv' ? csvToRaw(text) : jsonToRaw(text);
  } catch (e) {
    return { receipt: null, errors: [e.message], warnings };
  }
  const receipt = normalize(raw, errors, warnings);
  return { receipt: errors.length ? null : receipt, errors, warnings };
}

// ---- JSON --------------------------------------------------------------------

function jsonToRaw(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${e.message}`);
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('JSON must be an object like {"merchant": ..., "items": [...]}');
  }
  return obj;
}

// ---- CSV ---------------------------------------------------------------------

/** Split one CSV line into fields, honoring "quoted, fields" and "" escapes. */
export function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function csvToRaw(text) {
  const raw = { items: [] };
  const lines = String(text).split(/\r\n|\r|\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);
    const key = fields[0].toLowerCase();
    if (key === 'item') {
      if (fields.length < 3 || fields.length > 4) {
        throw new Error(`Line ${n + 1}: item rows are "item,<name>,<qty>,<unit price>" (qty optional)`);
      }
      // 3 fields = item,name,price ; 4 fields = item,name,qty,price
      const [, name, a, b] = fields;
      raw.items.push(fields.length === 3
        ? { name, qty: 1, price: a, line: n + 1 }
        : { name, qty: a, price: b, line: n + 1 });
    } else if (META_KEYS.includes(key)) {
      if (fields.length !== 2) {
        throw new Error(`Line ${n + 1}: "${key}" rows are "${key},<value>"`);
      }
      raw[key] = fields[1];
    } else {
      throw new Error(`Line ${n + 1}: unknown row type "${fields[0]}" (expected ${META_KEYS.join(', ')}, or item)`);
    }
  }
  return raw;
}

// ---- normalization -------------------------------------------------------------

function normalize(raw, errors, warnings) {
  const merchant = asOptionalString(raw, 'merchant', errors);
  if (raw.merchant == null || raw.merchant === '') errors.push('"merchant" is required');

  const address = asOptionalString(raw, 'address', errors);
  const contact = asOptionalString(raw, 'contact', errors, 100);
  const date = asOptionalString(raw, 'date', errors, 60);
  const reference = asOptionalString(raw, 'reference', errors, 60);
  const payment = asOptionalString(raw, 'payment', errors, 60);
  const footer = asOptionalString(raw, 'footer', errors);
  const taxLabel = asOptionalString(raw, 'taxlabel', errors, 40);
  const logoUrl = asOptionalHttpsUrl(raw, 'logourl', errors);

  let currency = asOptionalString(raw, 'currency', errors) || 'USD';
  currency = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push(`"currency" must be a 3-letter code like USD (got "${currency}")`);
    currency = 'USD';
  }

  const items = [];
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    errors.push('At least one line item is required');
  } else {
    raw.items.forEach((it, idx) => {
      const where = it && it.line ? `Line ${it.line}` : `Item ${idx + 1}`;
      if (typeof it !== 'object' || it === null) {
        errors.push(`${where}: not a valid item`);
        return;
      }
      const name = typeof it.name === 'string' ? it.name.trim() : '';
      if (!name) errors.push(`${where}: item name is required`);
      else if (name.length > 100) errors.push(`${where}: item name too long (max 100 characters)`);
      const qty = it.qty == null || it.qty === '' ? 1 : Number(String(it.qty).trim());
      if (!Number.isSafeInteger(qty) || qty <= 0) {
        errors.push(`${where}: quantity must be a positive whole number (got "${it.qty}")`);
      }
      let priceMinor = null;
      try {
        priceMinor = toMinor(it.price, currency);
      } catch {
        errors.push(`${where}: item price is not a number (got "${it.price}")`);
      }
      if (name && priceMinor != null && Number.isSafeInteger(qty) && qty > 0) {
        items.push({ name, qty, priceMinor });
      }
    });
  }

  const discountMinor = asOptionalMoney(raw, 'discount', currency, errors);
  const taxMinor = asOptionalMoney(raw, 'tax', currency, errors);
  const tipMinor = asOptionalMoney(raw, 'tip', currency, errors);
  const givenSubtotal = asOptionalMoney(raw, 'subtotal', currency, errors);
  const givenTotal = asOptionalMoney(raw, 'total', currency, errors);

  if (errors.length) return null;

  const computedSubtotal = items.reduce((sum, it) => sum + it.qty * it.priceMinor, 0);
  const subtotalMinor = givenSubtotal ?? computedSubtotal;
  if (givenSubtotal != null && Math.abs(givenSubtotal - computedSubtotal) > 1) {
    warnings.push(`Subtotal ${fmt(givenSubtotal, currency)} doesn't match the sum of items ${fmt(computedSubtotal, currency)}`);
  }
  const computedTotal = subtotalMinor - (discountMinor ?? 0) + (taxMinor ?? 0) + (tipMinor ?? 0);
  const totalMinor = givenTotal ?? computedTotal;
  if (givenTotal != null && Math.abs(givenTotal - computedTotal) > 1) {
    warnings.push(`Total ${fmt(givenTotal, currency)} doesn't match subtotal - discount + tax + tip ${fmt(computedTotal, currency)}`);
  }

  return {
    merchant,
    address,
    contact,
    date,
    reference,
    currency,
    items,
    subtotalMinor,
    discountMinor,
    taxMinor,
    taxLabel,
    tipMinor,
    totalMinor,
    payment,
    footer,
    // logoUrl is upload-settable (like contact/reference — a business's logo
    // rarely changes per-receipt), unlike the rest of the style block below,
    // which is generator-UI-only, so parsing always yields those defaults.
    logoUrl,
    template: 'classic',
    brandingOff: false,
    accent: null,
    emoji: null,
    qr: false,
  };
}

function fmt(minor, currency) {
  return (minor / 10 ** currencyExponent(currency)).toFixed(currencyExponent(currency));
}
