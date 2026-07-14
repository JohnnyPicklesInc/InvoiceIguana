/**
 * Shared invoice renderer — fills an .invoice DOM subtree (see the markup in
 * site/r.html and site/invoice.html) from a normalized invoice. Used by both
 * the viewer page and the generator's live preview so they can never drift
 * apart — same pattern as shared/render.js for receipts.
 *
 * Fields are located by [data-f="..."] inside the given root. All invoice
 * strings are set via textContent / createElement — no innerHTML, ever.
 */
import { money } from './render.js';
import { applyDocumentStyle } from './style.js';
import { TEMPLATES } from './invoice-templates.js';
import { lineNetMinor } from './line-math.js';

// Composable layout knobs → CSS classes (see the `.invoice.<class>` rules in
// invoice.css). The neutral default of each knob maps to no class, so preset
// templates that never leave the defaults get no extra classes. Every class a
// knob can add is listed so we can clear them all before re-applying.
const LAYOUT_KNOBS = {
  font: { serif: 'f-serif', mono: 'f-mono' },
  totalsLayout: { compact: 'tot-compact' },
  tableStyle: { zebra: 'tbl-zebra', plain: 'tbl-plain' },
  density: { compact: 'den-compact' },
  headerLayout: { center: 'hdr-center', swap: 'hdr-swap' },
};
const ALL_KNOB_CLASSES = Object.values(LAYOUT_KNOBS).flatMap((m) => Object.values(m));

/** Invoice-specific formatting classes (the "custom" template's knobs). Kept
 *  here rather than in the shared applyDocumentStyle since they're layout, not
 *  document-agnostic branding. */
function applyInvoiceLayout(root, inv) {
  root.classList.remove(...ALL_KNOB_CLASSES);
  for (const [knob, map] of Object.entries(LAYOUT_KNOBS)) {
    const cls = map[inv[knob]];
    if (cls) root.classList.add(cls);
  }
}

export function renderInvoiceInto(root, inv) {
  const $ = (f) => root.querySelector(`[data-f="${f}"]`);

  const setOptional = (f, value) => {
    const el = $(f);
    el.hidden = value == null;
    if (value != null) el.textContent = value;
  };

  applyDocumentStyle(root, inv, TEMPLATES);
  applyInvoiceLayout(root, inv);

  $('sellerName').textContent = inv.seller.name ?? '';
  setOptional('sellerAddress', inv.seller.address);
  setOptional('sellerContact', inv.seller.contact);

  setOptional('buyerName', inv.buyer?.name ?? null);
  setOptional('buyerAddress', inv.buyer?.address ?? null);
  setOptional('buyerContact', inv.buyer?.contact ?? null);

  setOptional('invoiceNumber', inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : null);
  setOptional('issueDate', inv.issueDate ? `Issued: ${inv.issueDate}` : null);
  setOptional('dueDate', inv.dueDate ? `Due: ${inv.dueDate}` : null);

  const tbody = $('items');
  tbody.replaceChildren();
  for (const it of inv.items) {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.className = 'item-name';
    nameTd.textContent = it.name;
    // A per-line discount is noted under the name; the Amount column shows the
    // net (discounted) line total, so the subtotal always sums the amounts.
    if (it.discount) {
      const note = document.createElement('div');
      note.className = 'item-disc';
      note.textContent = it.discount.kind === 'pct'
        ? `${it.discount.value}% off`
        : `${money(it.discount.value, inv.currency)} off`;
      nameTd.append(note);
    }
    const qtyTd = document.createElement('td');
    qtyTd.className = 'item-qty';
    qtyTd.textContent = String(it.qty);
    const priceTd = document.createElement('td');
    priceTd.className = 'item-price';
    priceTd.textContent = money(it.priceMinor, inv.currency);
    const amountTd = document.createElement('td');
    amountTd.className = 'item-amount';
    amountTd.textContent = money(lineNetMinor(it), inv.currency);
    tr.append(nameTd, qtyTd, priceTd, amountTd);
    tbody.append(tr);
  }

  $('subtotal').textContent = money(inv.subtotalMinor, inv.currency);
  // A zero discount is the same as no discount — don't clutter the totals with
  // a "-$0.00" line (falsy covers both null and 0).
  $('discountRow').hidden = !inv.discountMinor;
  if (inv.discountMinor) $('discount').textContent = `-${money(inv.discountMinor, inv.currency)}`;
  const taxLabelEl = $('taxLabel');
  if (taxLabelEl) taxLabelEl.textContent = inv.taxLabel || 'Tax';
  // Like discount: a zero tax is the same as no tax — hide the row (falsy
  // covers both null and 0).
  $('taxRow').hidden = !inv.taxMinor;
  if (inv.taxMinor) $('tax').textContent = money(inv.taxMinor, inv.currency);
  $('total').textContent = money(inv.totalMinor, inv.currency);

  $('paymentRow').hidden = inv.paymentInstructions == null;
  setOptional('paymentInstructions', inv.paymentInstructions);
  setOptional('notes', inv.notes);
}
