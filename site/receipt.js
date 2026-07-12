/**
 * Receipt generator page. Everything happens locally in this tab: form (or
 * uploaded file) -> validate -> live preview -> encode into the link.
 * No network calls; the receipt never leaves the browser.
 */
import { parseReceipt } from './shared/parse.js';
import { encodeReceipt, decodeReceipt, fromMinor } from './shared/codec.js';
import { renderReceiptInto } from './shared/render.js';
import { renderQrInto } from './shared/qr.js';
import { downloadReceiptPng } from './shared/export-png.js';
import { durableLink } from './shared/durable-link.js';
import { shareLinks } from './shared/share-links.js';
import { loadRates, saveRate, removeRate } from './shared/tax-rates.js';
import { TEMPLATES } from './shared/templates.js';
import { compressLogoImage } from './shared/logo-embed.js';
import { isHttpsUrl } from './shared/wire.js';

const $ = (id) => document.getElementById(id);
const URL_LENGTH_WARNING = 2000;

let currentReceipt = null;
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
  row.append(mk('i-name', 'Coffee', name), mk('i-qty', '1', qty, 'numeric'),
    mk('i-price', '3.50', price, 'decimal'), remove);
  $('itemRows').append(row);
}

// ---- form <-> raw receipt object -------------------------------------------

function rawFromForm() {
  const val = (id) => $(id).value.trim();
  const raw = { merchant: val('fMerchant'), items: [] };
  if (val('fAddress')) raw.address = val('fAddress');
  if (val('fContact')) raw.contact = val('fContact');
  if (val('fDate')) raw.date = val('fDate');
  if (val('fReference')) raw.reference = val('fReference');
  if (val('fCurrency')) raw.currency = val('fCurrency');
  if (val('fDiscount')) raw.discount = val('fDiscount');
  if (val('fTax')) raw.tax = val('fTax');
  if (val('fTip')) raw.tip = val('fTip');
  if (val('fPayment')) raw.payment = val('fPayment');
  if (val('fFooter')) raw.footer = val('fFooter');
  for (const row of $('itemRows').children) {
    const name = row.querySelector('.i-name').value.trim();
    const qty = row.querySelector('.i-qty').value.trim();
    const price = row.querySelector('.i-price').value.trim();
    if (!name && !qty && !price) continue; // skip fully empty rows
    raw.items.push({ name, qty: qty || 1, price });
  }
  return raw;
}

/** After an upload parses, mirror the receipt into the form for tweaking. */
function fillFormFromReceipt(r) {
  $('fMerchant').value = r.merchant;
  $('fAddress').value = r.address ?? '';
  $('fContact').value = r.contact ?? '';
  $('fDate').value = r.date ?? '';
  $('fReference').value = r.reference ?? '';
  $('fCurrency').value = r.currency === 'USD' ? '' : r.currency;
  $('fDiscount').value = r.discountMinor != null ? String(fromMinor(r.discountMinor, r.currency)) : '';
  $('fTax').value = r.taxMinor != null ? String(fromMinor(r.taxMinor, r.currency)) : '';
  $('fTip').value = r.tipMinor != null ? String(fromMinor(r.tipMinor, r.currency)) : '';
  $('fPayment').value = r.payment ?? '';
  $('fFooter').value = r.footer ?? '';
  $('fLogoUrl').value = r.logoUrl ?? '';
  $('itemRows').replaceChildren();
  for (const it of r.items) {
    addItemRow(it.name, it.qty === 1 ? '' : String(it.qty), String(fromMinor(it.priceMinor, r.currency)));
  }
}

/** Restores style choices too — used only by the edit link (see loadFromHash),
 *  not by JSON/CSV upload, which deliberately leaves style at its defaults.
 *  Must run after buildTemplatePicker() so the template radios exist. */
function restoreStyleControls(r) {
  const radio = document.querySelector(`input[name="template"][value="${r.template}"]`);
  if (radio) radio.checked = true;
  $('fAccentOn').checked = !!r.accent;
  $('fAccent').value = r.accent ? `#${r.accent}` : '#2456a6';
  $('fAccent').disabled = !r.accent;
  $('fQr').checked = !!r.qr;
  $('fBrandingOff').checked = !!r.brandingOff;
  if (r.logoData) {
    pendingLogoData = r.logoData;
    updateLogoFileStatus();
  } else if (r.logoUrl) {
    embedLogoFromUrl(r.logoUrl);
  }
}

/** If the page was opened as an edit link (this page's own URL with a payload
 *  in the hash — see the "edit link" in the result panel), decode it and
 *  fill in the whole form, style included, so editing can continue. Returns
 *  whether it actually loaded anything, so boot() knows whether to fall back
 *  to its usual empty-form defaults. */
async function loadFromHash() {
  const payload = location.hash.slice(1);
  if (!payload) return false;
  try {
    const receipt = await decodeReceipt(payload);
    fillFormFromReceipt(receipt);
    restoreStyleControls(receipt);
    return true;
  } catch {
    return false;
  }
}

// ---- style controls ------------------------------------------------------------

function buildTemplatePicker() {
  const picker = $('templatePicker');
  for (const [id, tpl] of Object.entries(TEMPLATES)) {
    const label = document.createElement('label');
    label.className = 'tpl';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'template';
    radio.value = id;
    radio.checked = id === 'classic';
    radio.addEventListener('change', scheduleUpdate);
    const span = document.createElement('span');
    span.textContent = tpl.label;
    label.append(radio, span);
    picker.append(label);
  }
}

function styleFromControls() {
  return {
    template: document.querySelector('input[name="template"]:checked')?.value ?? 'classic',
    accent: $('fAccentOn').checked ? $('fAccent').value.slice(1).toLowerCase() : null,
    // No emoji key here on purpose — the generator no longer offers a way to
    // set one, so this leaves whatever was already on the receipt (null for
    // a fresh document, or a decoded value from an edit link) untouched
    // rather than clobbering it. Still fully decodable for old links.
    qr: $('fQr').checked,
    brandingOff: $('fBrandingOff').checked,
    // The generator never sets an external logoUrl anymore — a URL pasted into
    // fLogoUrl is downloaded and embedded via pendingLogoData instead (see
    // embedLogoFromUrl below), so nothing is ever contacted when the document
    // is later viewed. logoUrl stays decodable for backward compatibility with
    // links made before this changed (or uploaded JSON that still sets it).
    logoUrl: null,
    logoData: pendingLogoData,
  };
}

// ---- embedded logo (paste a URL or choose a file — both end up embedded) ----------

/** Fetches an image URL client-side and runs it through the same compressor as a
 *  file upload, so a pasted URL and a picked file behave identically: nothing is
 *  ever contacted when the resulting document is later viewed. */
async function embedLogoFromUrl(url) {
  pendingLogoData = null;
  pendingLogoError = null;
  $('logoFileStatus').textContent = 'Downloading…';
  $('logoFileStatus').hidden = false;
  try {
    const res = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await compressLogoImage(await res.blob());
    if (result.error) pendingLogoError = result.error;
    else pendingLogoData = result.dataB64;
  } catch {
    pendingLogoError = "Couldn't download that image (its host may not allow this) — try downloading it yourself and uploading the file instead.";
  }
  updateLogoFileStatus();
  scheduleUpdate();
}

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
      $('fLogoUrl').value = '';
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

// ---- tax rate presets ------------------------------------------------------------

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
  const untouched = !raw.merchant && raw.items.length === 0;
  let { receipt, errors, warnings } = parseReceipt(JSON.stringify(raw), 'json');

  if (receipt && activeTaxRate) {
    // Recompute in integer minor units (not toFixed) so this stays correct
    // for zero-decimal currencies like JPY, then re-parse with the override.
    const computedTaxMinor = Math.round(receipt.subtotalMinor * activeTaxRate.rate / 100);
    raw.tax = fromMinor(computedTaxMinor, receipt.currency);
    raw.taxlabel = `${activeTaxRate.name} (${activeTaxRate.rate}%)`;
    ({ receipt, errors, warnings } = parseReceipt(JSON.stringify(raw), 'json'));
    $('fTax').value = String(raw.tax);
  }

  setList('errors', untouched ? [] : errors);
  setList('warnings', warnings);
  currentReceipt = null;
  if (!receipt) {
    $('result').hidden = true;
    return;
  }

  Object.assign(receipt, styleFromControls());
  currentReceipt = receipt;

  const payload = await encodeReceipt(receipt);
  currentUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}r#${payload}`;
  $('durableLinkInput').value = durableLink(payload);
  $('editLinkInput').value = `${location.origin}/receipt#${payload}`;

  renderReceiptInto($('preview'), receipt);
  const qrEl = $('preview').querySelector('[data-f="qr"]');
  qrEl.hidden = !receipt.qr;
  if (receipt.qr) renderQrInto(qrEl, currentUrl);

  $('link').value = currentUrl;
  $('open').href = currentUrl;
  $('charcount').textContent = `${currentUrl.length.toLocaleString()} characters`;
  $('lengthWarning').hidden = currentUrl.length <= URL_LENGTH_WARNING;

  const share = shareLinks(currentUrl, receipt.merchant);
  $('shareEmail').href = share.email;
  $('shareSms').href = share.sms;
  $('shareWhatsapp').href = share.whatsapp;

  $('result').hidden = false;
}

// ---- uploads ----------------------------------------------------------------------

async function handleFile(file) {
  const format = /\.csv$/i.test(file.name) ? 'csv' : 'json';
  const { receipt, errors, warnings } = parseReceipt(await file.text(), format);
  setList('errors', errors);
  setList('warnings', warnings);
  if (!receipt) {
    $('result').hidden = true;
    return;
  }
  fillFormFromReceipt(receipt);
  if (receipt.logoUrl) embedLogoFromUrl(receipt.logoUrl);
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
$('fQr').addEventListener('change', scheduleUpdate);
$('fBrandingOff').addEventListener('change', scheduleUpdate);

$('fLogoUrl').addEventListener('change', () => {
  const url = $('fLogoUrl').value.trim();
  if (!url) {
    pendingLogoData = null;
    pendingLogoError = null;
    updateLogoFileStatus();
    scheduleUpdate();
    return;
  }
  if (!isHttpsUrl(url)) {
    pendingLogoData = null;
    pendingLogoError = 'Logo URL must start with https://';
    updateLogoFileStatus();
    return;
  }
  embedLogoFromUrl(url);
});

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

$('pngBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (currentReceipt) downloadReceiptPng(currentReceipt, { qrText: currentUrl });
});

$('durableCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('durableLinkInput').value);
  $('durableCopy').textContent = 'Copied!';
  setTimeout(() => { $('durableCopy').textContent = 'Copy'; }, 1200);
});

$('editLinkCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('editLinkInput').value);
  $('editLinkCopy').textContent = 'Copied!';
  setTimeout(() => { $('editLinkCopy').textContent = 'Copy'; }, 1200);
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

buildTemplatePicker();
refreshTaxPresets();
const loadedFromEditLink = await loadFromHash();
if (!loadedFromEditLink) {
  addItemRow();
  addItemRow();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('fDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
update();
