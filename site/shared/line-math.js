/**
 * Shared line-item money math for invoices and receipts. Kept in its own
 * module so each parser (which computes the subtotal) and renderer (which
 * shows each line's net amount) apply the exact same per-line discount
 * formula and can never drift apart.
 *
 * A line's discount is { kind: 'pct' | 'amt', value } | null:
 *   - 'pct': `value` is a percentage (e.g. 10 or 8.875) off the line's gross.
 *   - 'amt': `value` is a flat amount in minor units off the line's gross.
 * The discount is clamped to the line so a line's net is never negative.
 */

/** Discount, in minor units, for one line given its gross (price × qty). */
export function lineDiscountMinor(grossMinor, discount) {
  if (!discount) return 0;
  const raw = discount.kind === 'pct'
    ? Math.round(grossMinor * discount.value / 100)
    : discount.value;
  return Math.max(0, Math.min(raw, grossMinor));
}

/** Net amount, in minor units, for one line (gross minus its line discount). */
export function lineNetMinor(item) {
  const gross = item.priceMinor * item.qty;
  return gross - lineDiscountMinor(gross, item.discount);
}

/** A unit as it reads after a price: "$40.00/hr", not "$40.00/hrs". The qty
 *  column keeps the plural ("10 hrs"); this only singularizes the per-unit form,
 *  for a fixed list of common units — anything else is left exactly as typed. */
const SINGULAR = {
  hrs: 'hr', hours: 'hour', mins: 'min', minutes: 'minute', days: 'day', nights: 'night',
  weeks: 'week', wks: 'wk', months: 'month', mos: 'mo', years: 'year', yrs: 'yr',
  sessions: 'session', visits: 'visit', lessons: 'lesson', classes: 'class', items: 'item',
  pcs: 'pc', units: 'unit', lbs: 'lb', boxes: 'box', bags: 'bag', loads: 'load',
  rooms: 'room', pages: 'page', words: 'word', posts: 'post', photos: 'photo',
  ft: 'ft', yds: 'yd', gals: 'gal', trips: 'trip', people: 'person', guests: 'guest',
};
export function perUnit(unit) {
  const u = String(unit || '');
  const one = SINGULAR[u.toLowerCase()];
  if (!one) return u;
  return u[0] === u[0].toUpperCase() && u[0] !== u[0].toLowerCase() ? one[0].toUpperCase() + one.slice(1) : one;
}
