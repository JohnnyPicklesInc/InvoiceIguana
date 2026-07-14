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
import { TEMPLATES } from './shared/templates.js';
import { CURRENCIES } from './shared/currencies.js';
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

function addItemRow(name = '', qty = '', price = '', disc = '', discType = 'pct') {
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
  // Per-line discount: a value plus a %/$ unit toggle. Empty value = no discount.
  const discTypeSel = document.createElement('select');
  discTypeSel.className = 'i-disctype';
  discTypeSel.title = 'Discount as a percentage or a flat amount';
  for (const [value, label] of [['pct', '%'], ['amt', '$']]) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    discTypeSel.append(opt);
  }
  discTypeSel.value = discType;
  discTypeSel.addEventListener('change', scheduleUpdate);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost remove';
  remove.textContent = '×';
  remove.title = 'Remove item';
  remove.addEventListener('click', () => { row.remove(); scheduleUpdate(); });
  row.append(mk('i-name', 'Coffee', name), mk('i-qty', '1', qty, 'numeric'),
    mk('i-price', '3.50', price, 'decimal'), mk('i-disc', '0', disc, 'decimal'),
    discTypeSel, remove);
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
    const disc = row.querySelector('.i-disc').value.trim();
    if (!name && !qty && !price && !disc) continue; // skip fully empty rows
    const item = { name, qty: qty || 1, price };
    if (disc) {
      item.discount = disc;
      item.discounttype = row.querySelector('.i-disctype').value === 'amt' ? 'amount' : 'percent';
    }
    raw.items.push(item);
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
  selectCurrency(r.currency);
  $('fDiscount').value = r.discountMinor != null ? String(fromMinor(r.discountMinor, r.currency)) : '';
  $('fTax').value = r.taxMinor != null ? String(fromMinor(r.taxMinor, r.currency)) : '';
  $('fTip').value = r.tipMinor != null ? String(fromMinor(r.tipMinor, r.currency)) : '';
  $('fPayment').value = r.payment ?? '';
  $('fFooter').value = r.footer ?? '';
  $('fLogoUrl').value = r.logoUrl ?? '';
  $('itemRows').replaceChildren();
  for (const it of r.items) {
    const discValue = it.discount
      ? (it.discount.kind === 'amt' ? String(fromMinor(it.discount.value, r.currency)) : String(it.discount.value))
      : '';
    addItemRow(it.name, it.qty === 1 ? '' : String(it.qty),
      String(fromMinor(it.priceMinor, r.currency)), discValue, it.discount?.kind ?? 'pct');
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

/** Fills the currency <select> from the common-currency list. */
function buildCurrencyPicker() {
  const select = $('fCurrency');
  select.replaceChildren(...CURRENCIES.map(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${code} — ${name}`;
    return opt;
  }));
}

/** Selects a currency, adding it as an option first if it isn't one of the
 *  common ones — so a currency from an upload or an older edit link is never
 *  silently dropped just because it's off the default menu. */
function selectCurrency(code) {
  const select = $('fCurrency');
  if (![...select.options].some((o) => o.value === code)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code;
    select.append(opt);
  }
  select.value = code;
}

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
  // Reveal the collapsed "Add a logo" panel when there's a logo (or an error)
  // to report, so its status/Remove control isn't hidden after an edit-link load.
  const details = status.closest('details');
  if (details && (pendingLogoError || pendingLogoData)) details.open = true;
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
  // The shared link always points at the durable GitHub Pages host, so it
  // survives our own hosting going away (see shared/durable-link.js). The edit
  // link stays on the current host so in-place editing works wherever you are.
  currentUrl = durableLink(payload);
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

$('editLinkCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('editLinkInput').value);
  $('editLinkCopy').textContent = 'Copied!';
  setTimeout(() => { $('editLinkCopy').textContent = 'Copy'; }, 1200);
});

/** Reflects the tax dropdown into UI state: activeTaxRate drives the computed
 *  tax in update(); a null rate means "flat amount typed directly into fTax". */
function applyTaxMode() {
  const val = $('taxPreset').value;
  const pctInput = $('fTaxPercent');
  if (val === 'pct') {
    // Inline percentage: type a % and it's applied to the subtotal.
    pctInput.hidden = false;
    $('fTax').readOnly = true;
    const rate = Number(pctInput.value);
    activeTaxRate = pctInput.value.trim() && Number.isFinite(rate) && rate >= 0
      ? { name: 'Tax', rate } : null;
    if (!activeTaxRate) $('fTax').value = '';
  } else {
    // Flat amount typed directly into fTax.
    pctInput.hidden = true;
    activeTaxRate = null;
    $('fTax').readOnly = false;
  }
}

$('taxPreset').addEventListener('change', () => {
  applyTaxMode();
  scheduleUpdate();
});

$('fTaxPercent').addEventListener('input', () => {
  applyTaxMode();
  scheduleUpdate();
});

// ---- boot ---------------------------------------------------------------------------

buildTemplatePicker();
buildCurrencyPicker();
const loadedFromEditLink = await loadFromHash();
if (!loadedFromEditLink) {
  addItemRow();
  addItemRow();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('fDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
update();
