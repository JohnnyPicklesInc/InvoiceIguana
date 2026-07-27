/**
 * Receipt generator page. Everything happens locally in this tab: form (or
 * uploaded file) -> validate -> live preview -> encode into the link. The only
 * network call is the OPTIONAL AI (Ask AI), which sends receipt text to the
 * shared MuseMoose gateway; nothing is sent unless you use AI, and nothing is stored.
 */
import { parseReceipt } from './shared/parse.js';
import { encodeReceipt, decodeReceipt, fromMinor } from './shared/codec.js';
import { renderReceiptInto, money as fmtMoney } from './shared/render.js';
import { renderQrInto } from './shared/qr.js';
import { downloadReceiptPng } from './shared/export-png.js';
import { durableLink } from './shared/durable-link.js';
import { shareLinks } from './shared/share-links.js';
import { TEMPLATES } from './shared/templates.js';
import { CURRENCIES } from './shared/currencies.js';
import { compressLogoImage } from './shared/logo-embed.js';
import { isHttpsUrl } from './shared/wire.js';
import { put, get, list, remove, exportAll, importAll, getMeta, setMeta } from './shared/db.js';

const $ = (id) => document.getElementById(id);
const URL_LENGTH_WARNING = 2000;

let currentReceipt = null;
let currentUrl = '';
let activeTaxRate = null;
let pendingLogoData = null;
let pendingLogoError = null;
// See generator.js: mirrors the same "load from IndexedDB / save in place" flow.
let currentSavedId = null;
// Auto-save state (mirrors generator.js). userEdited gates auto-save to real
// edits; storagePersisted caches whether the browser promised to keep our data.
let userEdited = false;
let autosaveTimer = null;
let storagePersisted = null;
let persistenceRequested = false;
let backupReminderDismissed = false;
try { backupReminderDismissed = sessionStorage.getItem('iiBackupDismissed') === '1'; } catch { /* private mode */ }

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
  scheduleAutosave();
}

// ---- auto-save (mirrors generator.js) --------------------------------------

function scheduleAutosave() {
  if (!userEdited) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { autosaveNow().catch(() => {}); }, 900);
}

async function autosaveNow() {
  if (!currentReceipt) return;
  await ensurePersistence();
  await saveCurrentReceipt();
}

async function ensurePersistence() {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    if (navigator.storage?.persist) {
      storagePersisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } else {
      storagePersisted = false;
    }
  } catch { storagePersisted = false; }
  updateSafetyBanners().catch(() => {});
}

async function checkPersistedPassive() {
  try {
    storagePersisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  } catch { storagePersisted = false; }
}

function setSavedStatus() {
  for (const id of ['autosaveStatus', 'saveStatus']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = '✓ Saved in this browser';
    el.hidden = false;
  }
}

/** Durability warning (storage not persisted) + periodic backup reminder. */
async function updateSafetyBanners(count) {
  if (count == null) {
    try { count = (await list('invoices')).filter((r) => r.kind === 'receipt').length; } catch { count = 0; }
  }
  const mkBackupBtn = (label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ghost';
    b.textContent = label;
    b.addEventListener('click', () => downloadBackup().catch((e) => alert(`Couldn't create backup: ${e.message}`)));
    return b;
  };

  const warn = $('durabilityWarn');
  if (warn) {
    if (storagePersisted === false && count > 0) {
      warn.replaceChildren(
        document.createTextNode('⚠ This browser might clear saved receipts — e.g. in private/incognito mode, or when you clear browsing data. '),
        mkBackupBtn('Download a backup'),
      );
      warn.hidden = false;
    } else {
      warn.hidden = true;
    }
  }

  const rem = $('backupReminder');
  if (rem) {
    const lastBackup = await getMeta('lastBackupAt', 0);
    const stale = !lastBackup || (Date.now() - lastBackup) > 14 * 24 * 3600 * 1000;
    const showWarn = storagePersisted === false && count > 0;
    if (count >= 3 && stale && !backupReminderDismissed && !showWarn) {
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'banner-x';
      dismiss.title = 'Dismiss';
      dismiss.textContent = '✕';
      dismiss.addEventListener('click', () => {
        backupReminderDismissed = true;
        try { sessionStorage.setItem('iiBackupDismissed', '1'); } catch { /* private mode */ }
        rem.hidden = true;
      });
      rem.replaceChildren(
        document.createTextNode(`You have ${count} receipts saved only in this browser. `),
        mkBackupBtn('Download a backup'),
        dismiss,
      );
      rem.hidden = false;
    } else {
      rem.hidden = true;
    }
  }
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

// ---- AI: one box that creates OR edits (via the shared MuseMoose gateway) ---
// Describe a whole receipt on an empty form (creates one) or a change to an
// existing one (edits it). Text is sent only when you click Ask AI; nothing is
// stored. Tax stays deterministic: the model returns "taxrate" (%), the app
// computes the amount. Tip is a flat amount.
const AI_ENDPOINT = 'https://musemoose.johnnypicklespartners.workers.dev';
let aiBeforeRec = null;
let aiBeforeTax = null;

const EMPTY_RECEIPT = () => ({
  merchant: '', address: null, contact: null, date: null, reference: null, currency: 'USD',
  items: [], subtotalMinor: 0, discountMinor: null, taxMinor: null, taxLabel: null, tipMinor: null,
  totalMinor: 0, payment: null, footer: null, logoUrl: null,
  template: 'classic', brandingOff: false, accent: null, emoji: null, logoData: null, qr: false,
});

function setAiStatus(el, msg, kind) {
  el.textContent = msg || '';
  el.className = 'ai-status' + (kind ? ' ' + kind : '');
}

async function aiRequest(body) {
  const res = await fetch(AI_ENDPOINT + '/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app: 'invoiceiguana-receipt', ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  if (!data.manifest || typeof data.manifest !== 'object') {
    throw new Error("The AI didn't return a usable receipt — try rephrasing.");
  }
  return data.manifest;
}

async function applyRawReceipt(raw) {
  const r = { ...raw };
  const taxrate = r.taxrate;
  delete r.taxrate;
  const { receipt } = parseReceipt(JSON.stringify(r), 'json');   // strict: needs merchant + items
  if (!receipt) throw new Error("The AI didn't return a usable receipt — try rephrasing.");
  fillFormFromReceipt(receipt);
  if (taxrate != null && Number.isFinite(Number(taxrate)) && Number(taxrate) >= 0) {
    $('taxPreset').value = 'pct';
    $('fTaxPercent').value = String(Number(taxrate));
  } else {
    $('taxPreset').value = '';
    $('fTaxPercent').value = '';
  }
  applyTaxMode();
  userEdited = true;
  await update();
}

async function aiRun() {
  const statusEl = $('aiEditStatus'), btn = $('aiEditApply');
  const instr = $('aiEditPrompt').value.trim();
  if (!instr) { setAiStatus(statusEl, 'Describe your receipt or a change first.', 'err'); return; }
  btn.disabled = true; setAiStatus(statusEl, 'Working… updating your receipt.', 'working');
  try {
    const raw0 = rawFromForm();
    const hasContent = !!((raw0.merchant && raw0.merchant.trim()) || (raw0.items && raw0.items.length));
    aiBeforeRec = currentReceipt ? structuredClone(currentReceipt) : EMPTY_RECEIPT();
    aiBeforeTax = { preset: $('taxPreset').value, pct: $('fTaxPercent').value };
    const raw = await aiRequest(hasContent ? { prompt: instr, manifest: raw0 } : { prompt: instr });
    await applyRawReceipt(raw);
    renderAiChanges(summarizeReceiptChanges(aiBeforeRec, currentReceipt));
    setAiStatus(statusEl, ''); $('aiEditPrompt').value = '';
    $('aiReviewBar').hidden = false;
  } catch (e) {
    setAiStatus(statusEl, e.message || 'Something went wrong — try again.', 'err');
  } finally { btn.disabled = false; }
}

function keepAiEdit() { aiBeforeRec = null; aiBeforeTax = null; $('aiReviewBar').hidden = true; }
async function undoAiEdit() {
  if (!aiBeforeRec) { $('aiReviewBar').hidden = true; return; }
  fillFormFromReceipt(aiBeforeRec);
  restoreStyleControls(aiBeforeRec);
  $('taxPreset').value = aiBeforeTax.preset;
  $('fTaxPercent').value = aiBeforeTax.pct;
  applyTaxMode();
  aiBeforeRec = null; aiBeforeTax = null;
  $('aiReviewBar').hidden = true;
  await update();
}

function summarizeReceiptChanges(b, a) {
  const wasEmpty = !(b.merchant) && !(b.items || []).length;
  if (wasEmpty) {
    const line = ['Drafted your receipt'];
    if (a.totalMinor) line.push(`Total is ${fromMinor(a.totalMinor, a.currency)} ${a.currency || ''}`.trim());
    return line;
  }
  const out = [];
  if ((b.merchant || '') !== (a.merchant || '')) out.push('Changed the merchant');
  const bn = (b.items || []).length, an = (a.items || []).length;
  if (an > bn) out.push(`Added ${an - bn} line item${an - bn > 1 ? 's' : ''}`);
  else if (an < bn) out.push(`Removed ${bn - an} line item${bn - an > 1 ? 's' : ''}`);
  else if (JSON.stringify(b.items) !== JSON.stringify(a.items)) out.push('Edited the line items');
  if ((b.discountMinor || 0) !== (a.discountMinor || 0)) out.push('Changed the discount');
  if ((b.taxMinor || 0) !== (a.taxMinor || 0) || (b.taxLabel || '') !== (a.taxLabel || '')) out.push('Changed the tax');
  if ((b.tipMinor || 0) !== (a.tipMinor || 0)) out.push('Changed the tip');
  if ((b.payment || '') !== (a.payment || '')) out.push('Updated the payment method');
  if ((b.footer || '') !== (a.footer || '')) out.push('Updated the footer');
  if ((b.date || '') !== (a.date || '') || (b.reference || '') !== (a.reference || '')) out.push('Updated the date/reference');
  if ((b.totalMinor || 0) !== (a.totalMinor || 0)) {
    out.push(`Total is now ${fromMinor(a.totalMinor, a.currency)} ${a.currency || ''}`.trim());
  }
  const seen = new Set(), res = [];
  for (const s of out) if (!seen.has(s)) { seen.add(s); res.push(s); }
  return res.slice(0, 7);
}
function renderAiChanges(list) {
  const ul = $('aiChanges'), msg = $('aiReviewMsg');
  ul.replaceChildren();
  for (const s of list) { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); }
  msg.textContent = list.length ? "✨ Here's what AI changed — keep it?" : "✨ Here's your update — keep it?";
}

$('aiEditApply').addEventListener('click', aiRun);
$('aiKeep').addEventListener('click', keepAiEdit);
$('aiUndo').addEventListener('click', undoAiEdit);
$('aiEditPrompt').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); aiRun(); }
});

// ---- saved receipts (IndexedDB) ---------------------------------------------------

/** Mirror of the invoice generator's saved-list — pulls from the shared
 *  `invoices` store filtered to kind='receipt'. Keeps both generators sharing
 *  one backup/restore stream while showing each side only its own documents. */
async function refreshSavedList() {
  let rows;
  try {
    const all = await list('invoices', { index: 'updatedAt', direction: 'prev' });
    rows = all.filter((r) => r.kind === 'receipt');
  } catch {
    $('savedPanel').hidden = true;
    return;
  }
  const listEl = $('savedList');
  // Count reflects total saved (unfiltered); filter only affects display.
  $('savedCount').textContent = String(rows.length);
  // Always-visible panel (mirrors the invoice generator) so first-timers learn
  // saving exists and is automatic; intro shows only while empty.
  $('savedPanel').hidden = false;
  $('savedCount').hidden = rows.length === 0;
  if ($('savedIntro')) $('savedIntro').hidden = rows.length > 0;
  if ($('savedFilter')) $('savedFilter').hidden = rows.length <= 3;
  updateSafetyBanners(rows.length).catch(() => {});
  const filter = ($('savedFilter').value || '').trim().toLowerCase();
  if (filter) {
    rows = rows.filter((r) => {
      const parts = [
        r.doc?.reference,
        r.doc?.merchant,
        r.status === 'template' ? 'template' : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return parts.includes(filter);
    });
  }
  $('savedEmpty').hidden = !(filter && rows.length === 0);
  listEl.replaceChildren();
  const fmtDate = (t) => new Date(t).toLocaleDateString();
  for (const row of rows) {
    const isTemplate = row.status === 'template';
    const li = document.createElement('li');
    li.className = 'saved-item' + (row.id === currentSavedId ? ' is-current' : '') + (isTemplate ? ' is-template' : '');
    const label = row.doc?.reference || row.doc?.merchant || (isTemplate ? 'Untitled template' : 'Untitled receipt');
    const totalStr = !isTemplate && row.doc?.totalMinor != null && row.doc?.currency
      ? fmtMoney(row.doc.totalMinor, row.doc.currency) : '';
    const meta = [row.doc?.merchant || 'No merchant', fmtDate(row.updatedAt), totalStr].filter(Boolean).join(' · ');
    // Templates carry a static "template" pill; regular receipts show no
    // pill (unlike invoices they have no status to cycle through).
    const pill = document.createElement('span');
    if (isTemplate) {
      pill.className = 'saved-status-pill status-template';
      pill.textContent = 'template';
      pill.title = 'Template — open it to start a new receipt from this style/business';
    } else {
      pill.hidden = true;
    }
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'saved-open';
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.className = 'linkmeta';
    span.textContent = meta;
    openBtn.append(strong, span);
    openBtn.addEventListener('click', () => isTemplate ? openTemplateAsDraft(row.id) : openSavedReceipt(row.id));
    const dup = document.createElement('button');
    dup.type = 'button';
    dup.className = 'ghost saved-dup';
    dup.textContent = 'Duplicate';
    dup.title = 'Copy this receipt into a new draft';
    dup.addEventListener('click', () => duplicateSavedReceipt(row.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ghost saved-del';
    del.textContent = 'Delete';
    del.title = isTemplate ? 'Delete this template' : 'Delete this saved receipt';
    del.addEventListener('click', () => deleteSavedReceipt(row.id, label));
    li.append(openBtn, pill, dup, del);
    listEl.append(li);
  }
}

/** Save the current receipt as a template — a status='template' record that
 *  won't overwrite when the user later saves a real receipt built from it. */
async function saveCurrentReceiptAsTemplate() {
  if (!currentReceipt) return;
  const record = { id: null, kind: 'receipt', status: 'template', doc: currentReceipt };
  await put('invoices', record);
  await persistMerchantEntry(currentReceipt);
  await refreshDirectories();
  flashSaveStatus('Saved as template');
  refreshSavedList();
}

/** Open a template as a fresh draft — nulls currentSavedId so the next Save
 *  creates a new record, leaving the template untouched. */
async function openTemplateAsDraft(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromReceipt(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = null;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('fDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('taxPreset').value = '';
  applyTaxMode();
  update();
  refreshSavedList();
  flashSaveStatus('Loaded from template — your edits save automatically');
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCurrentReceipt() {
  if (!currentReceipt) return;
  const record = {
    id: currentSavedId,
    kind: 'receipt',
    status: 'saved',
    doc: currentReceipt,
  };
  const saved = await put('invoices', record);
  currentSavedId = saved.id;
  await persistMerchantEntry(currentReceipt);
  await refreshDirectories();
  setSavedStatus();
  refreshSavedList();
}

// ---- saved businesses (merchant directory) --------------------------------

let businessDirectory = [];

async function refreshDirectories() {
  try {
    businessDirectory = await list('businesses');
  } catch {
    businessDirectory = [];
    return;
  }
  const dl = $('businessNames');
  dl.replaceChildren();
  for (const row of businessDirectory) {
    const opt = document.createElement('option');
    opt.value = row.name;
    dl.append(opt);
  }
}

async function persistMerchantEntry(doc) {
  const name = doc.merchant?.trim();
  if (!name) return;
  await put('businesses', {
    id: `biz:${name.toLowerCase()}`,
    name,
    address: doc.address ?? null,
    contact: doc.contact ?? null,
    logoData: doc.logoData ?? null,
  });
}

function autofillFromDirectory(nameValue, directory, targets) {
  const key = nameValue.trim().toLowerCase();
  const hit = directory.find((r) => r.name.trim().toLowerCase() === key);
  if (!hit) return false;
  let changed = false;
  for (const [inputId, field] of targets) {
    if (!$(inputId).value.trim() && hit[field]) {
      $(inputId).value = hit[field];
      changed = true;
    }
  }
  return changed;
}

async function openSavedReceipt(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromReceipt(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = id;
  $('taxPreset').value = '';
  applyTaxMode();
  update();
  refreshSavedList();
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteSavedReceipt(id, label) {
  if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
  await remove('invoices', id);
  if (currentSavedId === id) currentSavedId = null;
  refreshSavedList();
}

/** Duplicates a saved receipt: loads it into the form as an unsaved draft
 *  with the current timestamp. User's next Save creates a new record. */
async function duplicateSavedReceipt(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromReceipt(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = null;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('fDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('taxPreset').value = '';
  applyTaxMode();
  // Persist the copy immediately (currentSavedId is null → creates a new record).
  userEdited = true;
  await update();
  await saveCurrentReceipt();
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetToNewReceipt() {
  currentSavedId = null;
  $('form').reset();
  $('itemRows').replaceChildren();
  addItemRow();
  addItemRow();
  pendingLogoData = null;
  pendingLogoError = null;
  updateLogoFileStatus();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('fDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const classic = document.querySelector('input[name="template"][value="classic"]');
  if (classic) classic.checked = true;
  $('fAccentOn').checked = false;
  $('fAccent').disabled = true;
  $('fQr').checked = false;
  $('fBrandingOff').checked = false;
  $('taxPreset').value = '';
  applyTaxMode();
  update();
  refreshSavedList();
}

async function downloadBackup() {
  const backup = await exportAll();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `invoiceiguana-backup-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await setMeta('lastBackupAt', Date.now());
  updateSafetyBanners().catch(() => {});
}

async function importBackupFile(file) {
  try {
    const backup = JSON.parse(await file.text());
    const { imported } = await importAll(backup, { mode: 'merge' });
    const total = Object.values(imported).reduce((a, b) => a + b, 0);
    alert(`Imported ${total} record${total === 1 ? '' : 's'}.`);
    refreshSavedList();
  } catch (e) {
    alert(`Couldn't import that file: ${e.message}`);
  }
}

let saveStatusTimer = null;
function flashSaveStatus(text) {
  const el = $('saveStatus');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => { el.hidden = true; }, 1500);
}

// Saving is automatic now; this button just jumps to the saved list.
$('myReceiptsBtn').addEventListener('click', () => {
  $('savedPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
// Any genuine edit inside the editor arms auto-save (programmatic fills don't
// fire input/change, so opening a saved receipt or an edit link won't trip it).
const editorEl = document.querySelector('.editor');
editorEl.addEventListener('input', () => { userEdited = true; });
editorEl.addEventListener('change', () => { userEdited = true; });
$('fMerchant').addEventListener('change', () => {
  if (autofillFromDirectory($('fMerchant').value, businessDirectory,
      [['fAddress', 'address'], ['fContact', 'contact']])) scheduleUpdate();
});
$('newInvoiceBtn').addEventListener('click', resetToNewReceipt);
$('backupBtn').addEventListener('click', () => {
  downloadBackup().catch((err) => alert(`Couldn't create backup: ${err.message}`));
});
$('restoreBtn').addEventListener('click', () => $('restoreFile').click());
$('restoreFile').addEventListener('change', () => {
  const file = $('restoreFile').files[0];
  if (file) importBackupFile(file);
  $('restoreFile').value = '';
});
$('savedFilter').addEventListener('input', () => refreshSavedList());
// Result-panel actions — the old text-link row (`printBtn` / `saveBtn`) has
// been replaced with a 4-card action grid; the same underlying behaviors
// live here. `pngBtn` is a secondary link below the grid, kept for the
// receipt-specific PNG export.
$('downloadBtn').addEventListener('click', () => print());
$('shareBtn').addEventListener('click', () => {
  const panel = $('sharePanel');
  const open = panel.hidden;
  panel.hidden = !open;
  $('shareBtn').setAttribute('aria-expanded', String(open));
});
$('templateBtn').addEventListener('click', () => {
  saveCurrentReceiptAsTemplate().catch((err) => alert(`Couldn't save template: ${err.message}`));
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
await checkPersistedPassive();
refreshSavedList();
refreshDirectories();
