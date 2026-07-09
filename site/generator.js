/**
 * InvoiceIguana generator page. Mirrors site/generator.js's structure for the
 * invoice shape. Everything happens locally in this tab: form (or uploaded
 * file) -> validate -> live preview -> encode into the link. No network
 * calls; the invoice never leaves the browser.
 */
import { parseInvoice } from './shared/invoice-parse.js';
import { encodeInvoice } from './shared/invoice-codec.js';
import { fromMinor } from './shared/codec.js';
import { renderInvoiceInto } from './shared/invoice-render.js';
import { renderQrInto } from './shared/qr.js';
import { durableLink } from './shared/durable-link.js';
import { shareLinks } from './shared/share-links.js';
import { loadRates, saveRate, removeRate } from './shared/tax-rates.js';
import { compressLogoImage } from './shared/logo-embed.js';

const $ = (id) => document.getElementById(id);
const URL_LENGTH_WARNING = 2000;

let currentInvoice = null;
let currentUrl = '';
let activeTaxRate = null;
let pendingLogoData = null;
let pendingLogoError = null;

// ---- item rows -----------------------------------------------------------

function addItemRow(name = '', qty = '', price = '') {
  const row = document.createElement('div');
  row.className = 'item-row';
  const mk = (cls, placeholder, value, mode) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = cls;
    input.placeholder = placeholder;
    input.value = value;
    if (mode) input.inputMode = mode;
    input.addEventListener('input', scheduleUpdate);
    return input;
  };
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost remove';
  remove.textContent = '×';
  remove.title = 'Remove item';
  remove.addEventListener('click', () => { row.remove(); scheduleUpdate(); });
  row.append(mk('i-name', 'Consulting hours', name), mk('i-qty', '1', qty, 'numeric'),
    mk('i-price', '150.00', price, 'decimal'), remove);
  $('itemRows').append(row);
}

// ---- form <-> raw invoice object -------------------------------------------

function rawFromForm() {
  const val = (id) => $(id).value.trim();
  const raw = { seller: val('fSeller'), items: [] };
  if (val('fSellerAddress')) raw.selleraddress = val('fSellerAddress');
  if (val('fSellerContact')) raw.sellercontact = val('fSellerContact');
  if (val('fBuyer')) raw.buyer = val('fBuyer');
  if (val('fBuyerAddress')) raw.buyeraddress = val('fBuyerAddress');
  if (val('fBuyerContact')) raw.buyercontact = val('fBuyerContact');
  if (val('fInvoiceNumber')) raw.invoicenumber = val('fInvoiceNumber');
  if (val('fIssueDate')) raw.issuedate = val('fIssueDate');
  if (val('fDueDate')) raw.duedate = val('fDueDate');
  if (val('fCurrency')) raw.currency = val('fCurrency');
  if (val('fDiscount')) raw.discount = val('fDiscount');
  if (val('fTax')) raw.tax = val('fTax');
  if (val('fPaymentInstructions')) raw.paymentinstructions = val('fPaymentInstructions');
  if (val('fNotes')) raw.notes = val('fNotes');
  if (val('fLogoUrl')) raw.logourl = val('fLogoUrl');
  for (const row of $('itemRows').children) {
    const name = row.querySelector('.i-name').value.trim();
    const qty = row.querySelector('.i-qty').value.trim();
    const price = row.querySelector('.i-price').value.trim();
    if (!name && !qty && !price) continue; // skip fully empty rows
    raw.items.push({ name, qty: qty || 1, price });
  }
  return raw;
}

/** After an upload parses, mirror the invoice into the form for tweaking. */
function fillFormFromInvoice(inv) {
  $('fSeller').value = inv.seller.name;
  $('fSellerAddress').value = inv.seller.address ?? '';
  $('fSellerContact').value = inv.seller.contact ?? '';
  $('fBuyer').value = inv.buyer?.name ?? '';
  $('fBuyerAddress').value = inv.buyer?.address ?? '';
  $('fBuyerContact').value = inv.buyer?.contact ?? '';
  $('fInvoiceNumber').value = inv.invoiceNumber ?? '';
  $('fIssueDate').value = inv.issueDate ?? '';
  $('fDueDate').value = inv.dueDate ?? '';
  $('fCurrency').value = inv.currency === 'USD' ? '' : inv.currency;
  $('fDiscount').value = inv.discountMinor != null ? String(fromMinor(inv.discountMinor, inv.currency)) : '';
  $('fTax').value = inv.taxMinor != null ? String(fromMinor(inv.taxMinor, inv.currency)) : '';
  $('fPaymentInstructions').value = inv.paymentInstructions ?? '';
  $('fNotes').value = inv.notes ?? '';
  $('fLogoUrl').value = inv.logoUrl ?? '';
  $('itemRows').replaceChildren();
  for (const it of inv.items) {
    addItemRow(it.name, it.qty === 1 ? '' : String(it.qty), String(fromMinor(it.priceMinor, inv.currency)));
  }
}

// ---- style controls (no template picker — InvoiceIguana has one template for v1) --

function styleFromControls() {
  return {
    accent: $('fAccentOn').checked ? $('fAccent').value.slice(1).toLowerCase() : null,
    emoji: $('fEmoji').value.trim() || null,
    qr: $('fQr').checked,
    brandingOff: $('fBrandingOff').checked,
    logoData: pendingLogoData,
  };
}

// ---- embedded logo upload ---------------------------------------------------------

function updateLogoFileStatus() {
  const status = $('logoFileStatus');
  if (pendingLogoError) {
    status.textContent = pendingLogoError;
    status.hidden = false;
  } else if (pendingLogoData) {
    status.replaceChildren(document.createTextNode('Logo embedded in the link. '));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      pendingLogoData = null;
      $('fLogoFile').value = '';
      updateLogoFileStatus();
      scheduleUpdate();
    });
    status.append(remove);
    status.hidden = false;
  } else {
    status.hidden = true;
    status.replaceChildren();
  }
}

// ---- tax rate presets (identical to generator.js — rates are document-agnostic) --

function refreshTaxPresets() {
  const select = $('taxPreset');
  const prevValue = select.value;
  select.replaceChildren();
  const flat = document.createElement('option');
  flat.value = '';
  flat.textContent = 'Flat amount';
  select.append(flat);
  loadRates().forEach((rate, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${rate.name} — ${rate.rate}%`;
    select.append(opt);
  });
  select.value = [...select.options].some((o) => o.value === prevValue) ? prevValue : '';
}

// ---- main update loop ------------------------------------------------------------

function setList(id, entries) {
  const el = $(id);
  el.hidden = entries.length === 0;
  el.replaceChildren(...entries.map((msg) => {
    const li = document.createElement('li');
    li.textContent = msg;
    return li;
  }));
}

let timer = null;
function scheduleUpdate() {
  clearTimeout(timer);
  timer = setTimeout(update, 150);
}

async function update() {
  const raw = rawFromForm();
  const untouched = !raw.seller && raw.items.length === 0;
  let { invoice, errors, warnings } = parseInvoice(JSON.stringify(raw), 'json');

  if (invoice && activeTaxRate) {
    const computedTaxMinor = Math.round(invoice.subtotalMinor * activeTaxRate.rate / 100);
    raw.tax = fromMinor(computedTaxMinor, invoice.currency);
    raw.taxlabel = `${activeTaxRate.name} (${activeTaxRate.rate}%)`;
    ({ invoice, errors, warnings } = parseInvoice(JSON.stringify(raw), 'json'));
    $('fTax').value = String(raw.tax);
  }

  setList('errors', untouched ? [] : errors);
  setList('warnings', warnings);
  currentInvoice = null;
  if (!invoice) {
    $('result').hidden = true;
    return;
  }

  Object.assign(invoice, styleFromControls());
  currentInvoice = invoice;

  const payload = await encodeInvoice(invoice);
  currentUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}r#${payload}`;
  $('durableLinkInput').value = durableLink(payload);

  renderInvoiceInto($('preview'), invoice);
  const qrEl = $('preview').querySelector('[data-f="qr"]');
  qrEl.hidden = !invoice.qr;
  if (invoice.qr) renderQrInto(qrEl, currentUrl);

  $('link').value = currentUrl;
  $('open').href = currentUrl;
  $('charcount').textContent = `${currentUrl.length.toLocaleString()} characters`;
  $('lengthWarning').hidden = currentUrl.length <= URL_LENGTH_WARNING;

  const share = shareLinks(currentUrl, invoice.seller.name);
  $('shareEmail').href = share.email;
  $('shareSms').href = share.sms;
  $('shareWhatsapp').href = share.whatsapp;

  $('result').hidden = false;
}

// ---- uploads ----------------------------------------------------------------------

async function handleFile(file) {
  const format = /\.csv$/i.test(file.name) ? 'csv' : 'json';
  const { invoice, errors, warnings } = parseInvoice(await file.text(), format);
  setList('errors', errors);
  setList('warnings', warnings);
  if (!invoice) {
    $('result').hidden = true;
    return;
  }
  fillFormFromInvoice(invoice);
  switchTab('form');
  update();
}

// ---- wiring ------------------------------------------------------------------------

function switchTab(which) {
  $('tabForm').classList.toggle('active', which === 'form');
  $('tabUpload').classList.toggle('active', which === 'upload');
  $('form').hidden = which !== 'form';
  $('upload').hidden = which !== 'upload';
}

$('docTypeNav').addEventListener('change', (e) => { location.href = e.target.value; });

$('tabForm').addEventListener('click', () => switchTab('form'));
$('tabUpload').addEventListener('click', () => switchTab('upload'));

$('form').addEventListener('input', scheduleUpdate);
$('addItem').addEventListener('click', () => addItemRow());
$('form').addEventListener('submit', (e) => e.preventDefault());

$('fAccentOn').addEventListener('change', () => {
  $('fAccent').disabled = !$('fAccentOn').checked;
  scheduleUpdate();
});
$('fAccent').addEventListener('input', scheduleUpdate);
$('fEmoji').addEventListener('input', scheduleUpdate);
$('fQr').addEventListener('change', scheduleUpdate);
$('fBrandingOff').addEventListener('change', scheduleUpdate);
$('fLogoUrl').addEventListener('input', scheduleUpdate);

$('fLogoFile').addEventListener('change', async () => {
  const file = $('fLogoFile').files[0];
  if (!file) return;
  pendingLogoData = null;
  pendingLogoError = null;
  updateLogoFileStatus();
  const result = await compressLogoImage(file);
  if (result.error) {
    pendingLogoError = result.error;
    $('fLogoFile').value = '';
  } else {
    pendingLogoData = result.dataB64;
  }
  updateLogoFileStatus();
  scheduleUpdate();
});

$('file').addEventListener('change', () => {
  const file = $('file').files[0];
  if (file) handleFile(file).catch((e) => setList('errors', [`Couldn't read that file: ${e.message}`]));
});
const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file).catch((err) => setList('errors', [`Couldn't read that file: ${err.message}`]));
});

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('link').value);
  $('copy').textContent = 'Copied!';
  setTimeout(() => { $('copy').textContent = 'Copy'; }, 1200);
});

// No PNG export for v1 (canvas layout is vertical-specific) — print-to-PDF only.
$('printBtn').addEventListener('click', (e) => {
  e.preventDefault();
  print();
});

$('durableCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('durableLinkInput').value);
  $('durableCopy').textContent = 'Copied!';
  setTimeout(() => { $('durableCopy').textContent = 'Copy'; }, 1200);
});

$('taxPreset').addEventListener('change', () => {
  const val = $('taxPreset').value;
  if (val === '') {
    activeTaxRate = null;
    $('fTax').readOnly = false;
  } else {
    activeTaxRate = loadRates()[Number(val)] ?? null;
    $('fTax').readOnly = !!activeTaxRate;
  }
  scheduleUpdate();
});

$('manageRates').addEventListener('click', () => {
  const rates = loadRates();
  const list = rates.length
    ? rates.map((r, i) => `${i + 1}. ${r.name} — ${r.rate}%`).join('\n')
    : '(no saved rates yet)';
  const choice = prompt(`Saved tax rates:\n${list}\n\nType a number to delete that rate, or "new" to add one:`);
  if (choice == null) return;
  const trimmed = choice.trim().toLowerCase();
  if (trimmed === 'new') {
    const name = prompt('Name this tax rate (e.g. "NY Sales Tax"):');
    if (!name) return;
    const rateStr = prompt('Rate as a percentage (e.g. 8.875 for 8.875%):');
    const rate = Number(rateStr);
    if (!Number.isFinite(rate) || rate < 0) {
      if (rateStr != null) alert('Enter a valid percentage.');
      return;
    }
    saveRate(name.trim(), rate);
  } else {
    const idx = Number(trimmed) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < rates.length) removeRate(idx);
  }
  refreshTaxPresets();
});

// ---- boot ---------------------------------------------------------------------------

refreshTaxPresets();
addItemRow();
const today = new Date();
const dueDate = new Date(today);
dueDate.setDate(dueDate.getDate() + 30);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
$('fIssueDate').value = fmt(today);
$('fDueDate').value = fmt(dueDate);
update();
