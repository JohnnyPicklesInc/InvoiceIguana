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

export function renderInvoiceInto(root, inv) {
  const $ = (f) => root.querySelector(`[data-f="${f}"]`);

  const setOptional = (f, value) => {
    const el = $(f);
    el.hidden = value == null;
    if (value != null) el.textContent = value;
  };

  applyDocumentStyle(root, inv, TEMPLATES);

  $('sellerName').textContent = inv.seller.name;
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
    const qtyTd = document.createElement('td');
    qtyTd.className = 'item-qty';
    qtyTd.textContent = String(it.qty);
    const priceTd = document.createElement('td');
    priceTd.className = 'item-price';
    priceTd.textContent = money(it.priceMinor, inv.currency);
    const amountTd = document.createElement('td');
    amountTd.className = 'item-amount';
    amountTd.textContent = money(it.qty * it.priceMinor, inv.currency);
    tr.append(nameTd, qtyTd, priceTd, amountTd);
    tbody.append(tr);
  }

  $('subtotal').textContent = money(inv.subtotalMinor, inv.currency);
  $('discountRow').hidden = inv.discountMinor == null;
  if (inv.discountMinor != null) $('discount').textContent = `-${money(inv.discountMinor, inv.currency)}`;
  const taxLabelEl = $('taxLabel');
  if (taxLabelEl) taxLabelEl.textContent = inv.taxLabel || 'Tax';
  $('taxRow').hidden = inv.taxMinor == null;
  if (inv.taxMinor != null) $('tax').textContent = money(inv.taxMinor, inv.currency);
  $('total').textContent = money(inv.totalMinor, inv.currency);

  $('paymentRow').hidden = inv.paymentInstructions == null;
  setOptional('paymentInstructions', inv.paymentInstructions);
  setOptional('notes', inv.notes);
}
