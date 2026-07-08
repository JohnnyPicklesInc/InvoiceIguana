/**
 * InvoiceIguana viewer — decodes the document from location.hash
 * and fills the matching template based on its docType. The payload never
 * leaves the browser (fragments aren't sent to servers). Rendering goes
 * through shared/render.js or shared/invoice-render.js — textContent only,
 * no innerHTML with payload data.
 */
import { decodeReceipt, payloadHeader, BadVersion, DOC_RECEIPT } from './shared/codec.js';
import { decodeInvoice, DOC_INVOICE } from './shared/invoice-codec.js';
import { renderReceiptInto } from './shared/render.js';
import { renderInvoiceInto } from './shared/invoice-render.js';
import { renderQrInto } from './shared/qr.js';
import { downloadReceiptPng } from './shared/export-png.js';
import { durableLink } from './shared/durable-link.js';
import { shareLinks } from './shared/share-links.js';

const $ = (id) => document.getElementById(id);
let current = null;
let currentDocType = null;
let currentPayload = '';

function show(section) {
  for (const id of ['receipt', 'invoice', 'empty', 'error']) $(id).hidden = id !== section;
  $('actions').hidden = section !== 'receipt' && section !== 'invoice';
  // PNG export is receipt-only for v1 — invoices' canvas layout doesn't exist yet.
  $('downloadPng').hidden = section !== 'receipt';
}

function fail(msg) {
  $('errorMsg').textContent = msg;
  show('error');
}

async function main() {
  const payload = location.hash.slice(1);
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
      if (receipt.qr) renderQrInto(qrEl, location.href);
      wireShareLinks(location.href, receipt.merchant);
      current = receipt;
      currentDocType = docType;
      show('receipt');
    } else if (docType === DOC_INVOICE) {
      const invoice = await decodeInvoice(payload);
      document.title = `${invoice.seller.name} — invoice`;
      renderInvoiceInto($('invoice'), invoice);
      const qrEl = $('invoice').querySelector('[data-f="qr"]');
      qrEl.hidden = !invoice.qr;
      if (invoice.qr) renderQrInto(qrEl, location.href);
      wireShareLinks(location.href, invoice.seller.name);
      current = invoice;
      currentDocType = docType;
      show('invoice');
    } else {
      fail("This link holds a document type this page doesn't know yet — it may be from a newer tool in the family.");
    }
  } catch (e) {
    fail(e instanceof BadVersion
      ? 'This link was made with a newer version than this page understands.'
      : "This link doesn't contain a valid document.");
  }
}

function wireShareLinks(link, name) {
  const share = shareLinks(link, name);
  $('shareEmail').href = share.email;
  $('shareSms').href = share.sms;
  $('shareWhatsapp').href = share.whatsapp;
}

$('printBtn').addEventListener('click', () => print());
$('downloadPng').addEventListener('click', () => {
  if (current && currentDocType === DOC_RECEIPT) downloadReceiptPng(current, { qrText: location.href });
});

$('durableBtn').addEventListener('click', async () => {
  if (!current) return;
  const label = $('durableBtn').textContent;
  try {
    await navigator.clipboard.writeText(durableLink(currentPayload));
    $('durableBtn').textContent = 'Copied!';
  } catch {
    $('durableBtn').textContent = 'Failed — try again';
  } finally {
    setTimeout(() => { $('durableBtn').textContent = label; }, 1500);
  }
});

addEventListener('hashchange', main);
main();
