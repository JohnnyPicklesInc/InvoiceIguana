/**
 * Upload parsing for InvoiceIguana. Mirrors shared/parse.js's structure for
 * the invoice shape — accepts friendly JSON or CSV, normalizes both to the
 * same internal invoice object used by shared/invoice-codec.js.
 *
 * parseInvoice(text, format, opts) -> { invoice, errors, warnings }
 *   - format: 'json' | 'csv'
 *   - opts.lenient: when true, nothing is required and partial line items are
 *       coerced (missing name/price/qty filled with neutral defaults) so the
 *       generator can render a live preview of a half-filled form. Blocking
 *       errors are suppressed, so `errors` comes back empty — callers that
 *       need real validation must call without this flag (the upload path
 *       always does).
 *   - errors:   string[] — invoice is null if any (always empty when lenient)
 *   - warnings: string[] — non-blocking (e.g. provided total ≠ computed total)
 *
 * Standards-only: runs in the browser and under Node for selftests.
 */

import { toMinor, currencyExponent } from './codec.js';
import { asOptionalString, asOptionalMoney, asOptionalHttpsUrl } from './wire.js';
import { lineNetMinor } from './line-math.js';

const META_KEYS = ['seller', 'selleraddress', 'sellercontact', 'buyer', 'buyeraddress',
  'buyercontact', 'invoicenumber', 'issuedate', 'duedate', 'currency', 'discount', 'tax',
  'taxlabel', 'subtotal', 'total', 'paymentinstructions', 'notes', 'logourl'];

export function parseInvoice(text, format, opts = {}) {
  const errors = [];
  const warnings = [];
  let raw;
  try {
    raw = format === 'csv' ? csvToRaw(text) : jsonToRaw(text);
  } catch (e) {
    if (opts.lenient) return { invoice: null, errors: [], warnings };
    return { invoice: null, errors: [e.message], warnings };
  }
  const invoice = normalize(raw, errors, warnings, opts.lenient === true);
  return { invoice: errors.length ? null : invoice, errors, warnings };
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
    throw new Error('JSON must be an object like {"seller": ..., "items": [...]}');
  }
  return obj;
}

// ---- CSV ---------------------------------------------------------------------

function splitCsvLine(line) {
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

function normalize(raw, errors, warnings, lenient = false) {
  // In lenient mode every blocking check is routed to this throwaway sink
  // instead of `errors`, so partial input still yields a renderable invoice.
  // In strict mode sink === errors, so behavior is unchanged.
  const sink = lenient ? [] : errors;

  const sellerName = asOptionalString(raw, 'seller', sink);
  if (raw.seller == null || raw.seller === '') sink.push('"seller" is required');
  const sellerAddress = asOptionalString(raw, 'selleraddress', sink);
  const sellerContact = asOptionalString(raw, 'sellercontact', sink, 100);

  const buyerName = asOptionalString(raw, 'buyer', sink);
  const buyerAddress = asOptionalString(raw, 'buyeraddress', sink);
  const buyerContact = asOptionalString(raw, 'buyercontact', sink, 100);

  const invoiceNumber = asOptionalString(raw, 'invoicenumber', sink, 60);
  const issueDate = asOptionalString(raw, 'issuedate', sink, 60);
  const dueDate = asOptionalString(raw, 'duedate', sink, 60);
  const paymentInstructions = asOptionalString(raw, 'paymentinstructions', sink, 300);
  const notes = asOptionalString(raw, 'notes', sink);
  const taxLabel = asOptionalString(raw, 'taxlabel', sink, 40);
  const logoUrl = asOptionalHttpsUrl(raw, 'logourl', sink);

  let currency = asOptionalString(raw, 'currency', sink) || 'USD';
  currency = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    sink.push(`"currency" must be a 3-letter code like USD (got "${currency}")`);
    currency = 'USD';
  }

  const items = [];
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    sink.push('At least one line item is required');
  } else {
    raw.items.forEach((it, idx) => {
      const where = it && it.line ? `Line ${it.line}` : `Item ${idx + 1}`;
      if (typeof it !== 'object' || it === null) {
        sink.push(`${where}: not a valid item`);
        return;
      }
      const name = typeof it.name === 'string' ? it.name.trim() : '';
      if (!name) sink.push(`${where}: item name is required`);
      else if (name.length > 100) sink.push(`${where}: item name too long (max 100 characters)`);
      const qty = it.qty == null || it.qty === '' ? 1 : Number(String(it.qty).trim());
      const qtyOk = Number.isSafeInteger(qty) && qty > 0;
      if (!qtyOk) {
        sink.push(`${where}: quantity must be a positive whole number (got "${it.qty}")`);
      }
      let priceMinor = null;
      try {
        priceMinor = toMinor(it.price, currency);
      } catch {
        sink.push(`${where}: item price is not a number (got "${it.price}")`);
      }
      const discount = itemDiscount(it, currency, where, sink);
      if (lenient) {
        // Show the row as it's being typed, filling gaps with neutral defaults.
        items.push({ name: name || 'Item', qty: qtyOk ? qty : 1, priceMinor: priceMinor ?? 0, discount });
      } else if (name && priceMinor != null && qtyOk) {
        items.push({ name, qty, priceMinor, discount });
      }
    });
  }

  // A 0 discount/tax is treated as "none" so it neither renders a $0.00 line
  // nor bloats the link with a g:0 / x:0 key.
  const discountMinor = asOptionalMoney(raw, 'discount', currency, sink) || null;
  const taxMinor = asOptionalMoney(raw, 'tax', currency, sink) || null;
  const givenSubtotal = asOptionalMoney(raw, 'subtotal', currency, sink);
  const givenTotal = asOptionalMoney(raw, 'total', currency, sink);

  if (errors.length) return null;

  const computedSubtotal = items.reduce((sum, it) => sum + lineNetMinor(it), 0);
  const subtotalMinor = givenSubtotal ?? computedSubtotal;
  if (givenSubtotal != null && Math.abs(givenSubtotal - computedSubtotal) > 1) {
    warnings.push(`Subtotal ${fmt(givenSubtotal, currency)} doesn't match the sum of items ${fmt(computedSubtotal, currency)}`);
  }
  const computedTotal = subtotalMinor - (discountMinor ?? 0) + (taxMinor ?? 0);
  const totalMinor = givenTotal ?? computedTotal;
  if (givenTotal != null && Math.abs(givenTotal - computedTotal) > 1) {
    warnings.push(`Total ${fmt(givenTotal, currency)} doesn't match subtotal - discount + tax ${fmt(computedTotal, currency)}`);
  }

  return {
    seller: { name: sellerName, address: sellerAddress, contact: sellerContact },
    buyer: { name: buyerName, address: buyerAddress, contact: buyerContact },
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    items,
    subtotalMinor,
    discountMinor,
    taxMinor,
    // Drop an orphan tax label when there's no tax, so it can't ride in the link.
    taxLabel: taxMinor != null ? taxLabel : null,
    totalMinor,
    paymentInstructions,
    notes,
    // logoUrl is upload-settable (a business's logo rarely changes per-invoice),
    // unlike the style block below, which is generator-UI-only.
    logoUrl,
    template: 'classic',
    brandingOff: false,
    accent: null,
    emoji: null,
    logoData: null,
    qr: false,
    // Custom-template formatting knobs default to their neutral value (must
    // match the codec's decode defaults so a round-trip is exact). They only
    // affect rendering when the "custom" template is selected.
    font: 'sans',
    totalsLayout: 'wide',
    tableStyle: 'lines',
    density: 'comfortable',
    headerLayout: 'default',
  };
}

/** Reads an optional per-line discount from a raw item. `discount` is the
 *  value and `discounttype` picks the unit ('percent' by default, or
 *  'amount'/'amt'/'$' for a flat currency amount). Returns {kind, value} | null;
 *  a bad value is a blocking error in strict mode and simply dropped in lenient
 *  mode (the sink is discarded there). */
function itemDiscount(it, currency, where, sink) {
  const rawVal = it.discount;
  if (rawVal == null || rawVal === '') return null;
  const num = Number(String(rawVal).trim());
  if (!Number.isFinite(num) || num < 0) {
    sink.push(`${where}: discount must be a non-negative number (got "${rawVal}")`);
    return null;
  }
  if (num === 0) return null; // 0 discount == no discount
  const type = String(it.discounttype ?? 'percent').trim().toLowerCase();
  if (type === 'amount' || type === 'amt' || type === '$') {
    try {
      return { kind: 'amt', value: toMinor(num, currency) };
    } catch {
      sink.push(`${where}: discount amount is out of range (got "${rawVal}")`);
      return null;
    }
  }
  return { kind: 'pct', value: num };
}

function fmt(minor, currency) {
  return (minor / 10 ** currencyExponent(currency)).toFixed(currencyExponent(currency));
}
