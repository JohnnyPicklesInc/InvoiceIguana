/**
 * InvoiceIguana viewer — decodes the document from location.hash
 * and fills the matching template based on its docType. The payload never
 * leaves the browser (fragments aren't sent to servers). Rendering goes
 * through shared/render.js or shared/invoice-render.js — textContent only,
 * no innerHTML with payload data.
 */
import { decodeReceipt, payloadHeader, BadVersion, DOC_RECEIPT } from './shared/codec.js';
import { decodeInvoice, DOC_INVOICE } from './shared/invoice-codec.js';
import { decodeQuote, DOC_QUOTE } from './shared/quote-codec.js';
import { renderReceiptInto } from './shared/render.js';
import { renderInvoiceInto } from './shared/invoice-render.js';
import { renderQuoteInto } from './shared/quote-render.js';
import { renderQrInto } from './shared/qr.js';
import { downloadReceiptPng } from './shared/export-png.js';
import { viewerLink, durableLink } from './shared/durable-link.js';
import { isReadableFragment, readableToPayload } from './shared/readable.js';
import { shareLinks } from './shared/share-links.js';

import { countArrival } from './shared/arrival.js';
const $ = (id) => document.getElementById(id);
let current = null;
let currentDocType = null;
let currentPayload = '';

function show(section) {
  for (const id of ['receipt', 'invoice', 'quote', 'empty', 'error']) $(id).hidden = id !== section;
  $('actions').hidden = section !== 'receipt' && section !== 'invoice' && section !== 'quote';
  // PNG export is receipt-only for v1 — invoices' canvas layout doesn't exist yet.
  $('downloadPng').hidden = section !== 'receipt';
  $('acceptQuote').hidden = section !== 'quote';
}

function fail(msg) {
  $('errorMsg').textContent = msg;
  show('error');
}

async function main() {
  let payload = location.hash.slice(1);
  // A hand-written / AI-written readable link (#doc=invoice&seller=...):
  // build the document with the app's own parser, then swap the address to
  // the normal compact link so anything shared onward is the short form.
  if (isReadableFragment(decodeURIComponentSafe(payload))) {
    let r;
    try { r = await readableToPayload(decodeURIComponentSafe(payload)); } catch (e) { r = { errors: [e.message] }; }
    if (!r.payload) {
      fail(`This link couldn't be turned into a document: ${r.errors.join('; ')}.`);
      return;
    }
    payload = r.payload;
    history.replaceState(null, '', `${location.pathname}${location.search}#${payload}`);
  }
  current = null;
  currentDocType = null;
  currentPayload = payload;
  if (!payload) {
    show('empty');
    return;
  }
  if (typeof DecompressionStream === 'undefined') {
    fail('Your browser is too old to decode this document — try a current Chrome, Firefox, or Safari.');
    return;
  }
  try {
    const { docType } = payloadHeader(payload);

    if (docType === DOC_RECEIPT) {
      const receipt = await decodeReceipt(payload);
      document.title = `${receipt.merchant} — receipt`;
      renderReceiptInto($('receipt'), receipt);
      const qrEl = $('receipt').querySelector('[data-f="qr"]');
      qrEl.hidden = !receipt.qr;
      if (receipt.qr) renderQrInto(qrEl, viewerLink(payload));
      wireShareLinks(viewerLink(payload), receipt.merchant);
      current = receipt;
      currentDocType = docType;
      show('receipt');
    } else if (docType === DOC_INVOICE) {
      const invoice = await decodeInvoice(payload);
      document.title = `${invoice.seller.name} — invoice`;
      renderInvoiceInto($('invoice'), invoice);
      const qrEl = $('invoice').querySelector('[data-f="qr"]');
      qrEl.hidden = !invoice.qr;
      if (invoice.qr) renderQrInto(qrEl, viewerLink(payload));
      wireShareLinks(viewerLink(payload), invoice.seller.name);
      current = invoice;
      currentDocType = docType;
      show('invoice');
    } else if (docType === DOC_QUOTE) {
      const quote = await decodeQuote(payload);
      document.title = `${quote.seller.name} — quote`;
      renderQuoteInto($('quote'), quote);
      const qrEl = $('quote').querySelector('[data-f="qr"]');
      qrEl.hidden = !quote.qr;
      if (quote.qr) renderQrInto(qrEl, viewerLink(payload));
      wireShareLinks(viewerLink(payload), quote.seller.name);
      current = quote;
      currentDocType = docType;
      show('quote');
      // Accept-by-email: mailto the seller's contact (the ROADMAP's lightweight,
      // no-server acceptance). Only offered when the seller left a contact.
      const accept = $('acceptQuote');
      const contact = quote.seller.contact;
      if (contact) {
        const num = quote.invoiceNumber ? ` #${quote.invoiceNumber}` : '';
        const subject = encodeURIComponent(`Accepting your quote${num}`);
        const body = encodeURIComponent(`Hi ${quote.seller.name || ''},\n\nI'd like to accept this quote${num}.\n\n${viewerLink(payload)}\n`);
        accept.href = `mailto:${contact}?subject=${subject}&body=${body}`;
      } else {
        accept.hidden = true;
        accept.removeAttribute('href');
      }
    } else {
      fail("This link holds a document type this page doesn't know yet — it may be from a newer tool in the family.");
    }
  } catch (e) {
    fail(e instanceof BadVersion
      ? 'This link was made with a newer version than this page understands.'
      : "This link doesn't contain a valid document.");
  }
}

/** Some chat apps percent-encode the whole fragment (doc%3Dinvoice%26...);
 *  undo that once so URLSearchParams sees real & and = separators. */
function decodeURIComponentSafe(s) {
  if (/(^|&)doc=/.test(s)) return s;
  try { return decodeURIComponent(s); } catch { return s; }
}

function wireShareLinks(link, name) {
  const share = shareLinks(link, name);
  $('shareEmail').href = share.email;
  $('shareSms').href = share.sms;
  $('shareWhatsapp').href = share.whatsapp;
}

$('printBtn').addEventListener('click', () => print());
$('downloadPng').addEventListener('click', () => {
  if (current && currentDocType === DOC_RECEIPT) downloadReceiptPng(current, { qrText: durableLink(currentPayload) });
});

countArrival();
addEventListener('hashchange', main);
main();
