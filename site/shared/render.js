/**
 * Shared receipt renderer — fills a .receipt DOM subtree (see the markup in
 * site/r.html) from a normalized receipt. Used by both the viewer page and the
 * generator's live preview so they can never drift apart.
 *
 * Fields are located by [data-f="..."] inside the given root. All receipt
 * strings are set via textContent / createElement — no innerHTML, ever.
 */
import { fromMinor } from './codec.js';
import { TEMPLATES } from './templates.js';
import { applyDocumentStyle } from './style.js';
import { lineNetMinor } from './line-math.js';

export function money(minor, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency })
      .format(fromMinor(minor, currency));
  } catch {
    return `${currency} ${fromMinor(minor, currency)}`;
  }
}

/** Applies template class, accent color, emoji logo, and branding visibility. */
export function applyReceiptStyle(root, r) {
  applyDocumentStyle(root, r, TEMPLATES);
}

export function renderReceiptInto(root, r) {
  const $ = (f) => root.querySelector(`[data-f="${f}"]`);

  const setOptional = (f, value) => {
    const el = $(f);
    el.hidden = value == null;
    if (value != null) el.textContent = value;
  };
  // Hide a totals row when its amount is zero as well as absent (a $0.00 tax or
  // tip is the same as none), matching the discount row below.
  const setOptionalMoney = (rowF, cellF, minor) => {
    $(rowF).hidden = !minor;
    if (minor) $(cellF).textContent = money(minor, r.currency);
  };

  applyReceiptStyle(root, r);

  $('merchant').textContent = r.merchant;
  setOptional('address', r.address);
  setOptional('contact', r.contact);
  setOptional('date', r.date);
  setOptional('reference', r.reference);

  const list = $('items');
  list.replaceChildren();
  for (const it of r.items) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = it.qty > 1 ? `${it.name} ×${it.qty}` : it.name;
    const amount = document.createElement('span');
    amount.className = 'amount';
    // Amount is the net (discounted) line total so the subtotal sums amounts.
    amount.textContent = money(lineNetMinor(it), r.currency);
    if (it.qty > 1) {
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = ` (@ ${money(it.priceMinor, r.currency)})`;
      name.append(unit);
    }
    if (it.discount) {
      const disc = document.createElement('span');
      disc.className = 'disc';
      disc.textContent = it.discount.kind === 'pct'
        ? ` — ${it.discount.value}% off`
        : ` — ${money(it.discount.value, r.currency)} off`;
      name.append(disc);
    }
    li.append(name, amount);
    list.append(li);
  }

  $('subtotal').textContent = money(r.subtotalMinor, r.currency);
  // Zero discount == no discount — don't clutter the totals with a -$0.00 line.
  $('discountRow').hidden = !r.discountMinor;
  if (r.discountMinor) $('discount').textContent = `-${money(r.discountMinor, r.currency)}`;
  const taxLabelEl = $('taxLabel');
  if (taxLabelEl) taxLabelEl.textContent = r.taxLabel || 'Tax';
  setOptionalMoney('taxRow', 'tax', r.taxMinor);
  setOptionalMoney('tipRow', 'tip', r.tipMinor);
  $('total').textContent = money(r.totalMinor, r.currency);
  setOptional('payment', r.payment);
  setOptional('footer', r.footer);
}
