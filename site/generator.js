/**
 * InvoiceIguana generator page. Mirrors site/generator.js's structure for the
 * invoice shape. Everything happens locally in this tab: form (or uploaded
 * file) -> validate -> live preview -> encode into the link. The only network
 * call is the OPTIONAL AI (generate / edit with AI), which sends invoice text
 * to the shared MuseMoose gateway; photos and files never leave the browser,
 * and nothing is sent unless you use AI.
 */
import { parseInvoice } from './shared/invoice-parse.js';
import { encodeInvoice, decodeInvoice } from './shared/invoice-codec.js';
import { fromMinor } from './shared/codec.js';
import { renderInvoiceInto } from './shared/invoice-render.js';
import { money as fmtMoney } from './shared/render.js';
import { renderQrInto } from './shared/qr.js';
import { TEMPLATES } from './shared/invoice-templates.js';
import { CURRENCIES } from './shared/currencies.js';
import { durableLink } from './shared/durable-link.js';
import { shareLinks } from './shared/share-links.js';
import { compressLogoImage } from './shared/logo-embed.js';
import { isHttpsUrl } from './shared/wire.js';
import { put, get, list, remove, exportAll, importAll, getMeta, setMeta } from './shared/db.js';

const $ = (id) => document.getElementById(id);
const URL_LENGTH_WARNING = 2000;

let currentInvoice = null;
let currentUrl = '';
let activeTaxRate = null;
let pendingLogoData = null;
let pendingLogoError = null;
// The record id in IndexedDB for the invoice currently loaded into the form
// (either opened from the saved list or already saved once). null means the
// next save creates a new record; a value means it overwrites in place.
let currentSavedId = null;
// Auto-save state. userEdited gates auto-save to genuine edits (so opening the
// page or an edit link never silently writes a record); storagePersisted caches
// whether the browser promised not to evict our IndexedDB.
let userEdited = false;
let autosaveTimer = null;
let storagePersisted = null; // null = unknown, then true/false
let persistenceRequested = false;
let backupReminderDismissed = false;
try { backupReminderDismissed = sessionStorage.getItem('iiBackupDismissed') === '1'; } catch { /* private mode */ }

// ---- item rows -----------------------------------------------------------

function addItemRow(name = '', qty = '', unit = '', price = '', disc = '', discType = 'pct') {
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
  const nameInput = mk('i-name', 'Consulting hours', name);
  // Datalist offers saved product names; on match, autofill the sibling
  // .i-price if the user hasn't already typed one.
  nameInput.setAttribute('list', 'productNames');
  nameInput.addEventListener('change', () => {
    if (autofillProductPrice(row)) scheduleUpdate();
  });
  // Unit is optional free-text (e.g. "hrs", "days"); a datalist offers common
  // choices without locking the user out of custom values like "sq ft".
  const unitInput = mk('i-unit', 'hrs', unit);
  unitInput.setAttribute('list', 'itemUnits');
  unitInput.maxLength = 8;
  const priceInput = mk('i-price', '150.00', price, 'decimal');
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
  row.append(nameInput, mk('i-qty', '1', qty, 'numeric'), unitInput,
    priceInput, mk('i-disc', '0', disc, 'decimal'),
    discTypeSel, remove);
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
  if (val('fPaymentUrl')) raw.paymenturl = val('fPaymentUrl');
  if (val('fNotes')) raw.notes = val('fNotes');
  for (const row of $('itemRows').children) {
    const name = row.querySelector('.i-name').value.trim();
    const qty = row.querySelector('.i-qty').value.trim();
    const unit = row.querySelector('.i-unit').value.trim();
    const price = row.querySelector('.i-price').value.trim();
    const disc = row.querySelector('.i-disc').value.trim();
    if (!name && !qty && !price && !disc && !unit) continue; // skip fully empty rows
    const item = { name, qty: qty || 1, price };
    if (unit) item.unit = unit;
    if (disc) {
      item.discount = disc;
      item.discounttype = row.querySelector('.i-disctype').value === 'amt' ? 'amount' : 'percent';
    }
    raw.items.push(item);
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
  selectCurrency(inv.currency);
  $('fDiscount').value = inv.discountMinor != null ? String(fromMinor(inv.discountMinor, inv.currency)) : '';
  $('fTax').value = inv.taxMinor != null ? String(fromMinor(inv.taxMinor, inv.currency)) : '';
  $('fPaymentInstructions').value = inv.paymentInstructions ?? '';
  $('fPaymentUrl').value = inv.paymentUrl ?? '';
  $('fNotes').value = inv.notes ?? '';
  $('fLogoUrl').value = inv.logoUrl ?? '';
  $('itemRows').replaceChildren();
  for (const it of inv.items) {
    // A per-line discount comes back as {kind:'pct'|'amt', value}; pct values
    // are plain percentages, amt values are in minor units.
    const discValue = it.discount
      ? (it.discount.kind === 'amt' ? String(fromMinor(it.discount.value, inv.currency)) : String(it.discount.value))
      : '';
    addItemRow(it.name, it.qty === 1 ? '' : String(it.qty), it.unit ?? '',
      String(fromMinor(it.priceMinor, inv.currency)), discValue, it.discount?.kind ?? 'pct');
  }
}

/** Restores style choices too — used only by the edit link (see loadFromHash),
 *  not by JSON/CSV upload, which deliberately leaves style at its defaults. */
function restoreStyleControls(inv) {
  // Must run after buildTemplatePicker() so the template radios exist.
  const radio = document.querySelector(`input[name="template"][value="${inv.template}"]`);
  if (radio) radio.checked = true;
  $('fAccentOn').checked = !!inv.accent;
  $('fAccent').value = inv.accent ? `#${inv.accent}` : '#2456a6';
  $('fAccent').disabled = !inv.accent;
  $('fQr').checked = !!inv.qr;
  for (const [id, field, def] of CUSTOM_CONTROLS) $(id).value = inv[field] ?? def;
  updateCustomPanel();
  $('fBrandingOff').checked = !!inv.brandingOff;
  if (inv.logoData) {
    pendingLogoData = inv.logoData;
    updateLogoFileStatus();
  } else if (inv.logoUrl) {
    embedLogoFromUrl(inv.logoUrl);
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
    const invoice = await decodeInvoice(payload);
    fillFormFromInvoice(invoice);
    restoreStyleControls(invoice);
    return true;
  } catch {
    return false;
  }
}

// ---- style controls --------------------------------------------------------------

// Custom-template knobs: [select id, normalized field, neutral default]. The
// default matches the codec/parser so non-custom templates round-trip exactly.
const CUSTOM_CONTROLS = [
  ['cFont', 'font', 'sans'],
  ['cTotals', 'totalsLayout', 'wide'],
  ['cTable', 'tableStyle', 'lines'],
  ['cDensity', 'density', 'comfortable'],
  ['cHeader', 'headerLayout', 'default'],
];

function selectedTemplate() {
  return document.querySelector('input[name="template"]:checked')?.value ?? 'classic';
}

/** The custom-formatting panel is only relevant to the "custom" template. */
function updateCustomPanel() {
  $('customPanel').hidden = selectedTemplate() !== 'custom';
}

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

/** Populates the template picker from the registry (mirrors receipt.js). */
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
    radio.addEventListener('change', () => { updateCustomPanel(); scheduleUpdate(); });
    const span = document.createElement('span');
    span.textContent = tpl.label;
    label.append(radio, span);
    picker.append(label);
  }
}

function styleFromControls() {
  const template = selectedTemplate();
  // The formatting knobs only take effect for the custom template; every other
  // template forces the neutral defaults so its payload never carries a `cf`.
  const custom = Object.fromEntries(CUSTOM_CONTROLS.map(([id, field, def]) =>
    [field, template === 'custom' ? $(id).value : def]));
  return {
    template,
    accent: $('fAccentOn').checked ? $('fAccent').value.slice(1).toLowerCase() : null,
    // No emoji key here on purpose — the generator no longer offers a way to
    // set one, so this leaves whatever was already on the invoice (null for
    // a fresh document, or a decoded value from an edit link) untouched
    // rather than clobbering it. Still fully decodable for old links.
    qr: $('fQr').checked,
    ...custom,
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

// ---- auto-save --------------------------------------------------------------

/** Debounced auto-save. Fires only once the user has actually edited (so the
 *  initial page render / an opened edit link never writes silently), and only
 *  when there's a valid, encodable invoice (currentInvoice). */
function scheduleAutosave() {
  if (!userEdited) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { autosaveNow().catch(() => {}); }, 900);
}

async function autosaveNow() {
  if (!currentInvoice) return;
  await ensurePersistence();
  await saveCurrentInvoice();
}

/** Ask the browser to keep our IndexedDB (not evict it under storage pressure).
 *  Requested lazily on the first real save, when the user has clearly engaged —
 *  Chrome grants it silently based on engagement; Firefox may prompt once. */
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

/** Passive read of the persisted() flag on boot — no request, just so the
 *  durability banner reflects reality before the first save. */
async function checkPersistedPassive() {
  try {
    storagePersisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  } catch { storagePersisted = false; }
}

/** Shows the persistent "saved in this browser" confirmation in both the saved
 *  panel header and the result panel. */
function setSavedStatus() {
  for (const id of ['autosaveStatus', 'saveStatus']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = '✓ Saved in this browser';
    el.hidden = false;
  }
}

/** Two "don't lose your saves" nudges: a warning when the browser hasn't
 *  promised to keep our storage (private mode / eviction risk), and a periodic
 *  reminder to download a backup once there are several saved invoices. */
async function updateSafetyBanners(count) {
  if (count == null) {
    try { count = (await list('invoices')).filter((r) => r.kind === 'invoice').length; } catch { count = 0; }
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
        document.createTextNode('⚠ This browser might clear saved invoices — e.g. in private/incognito mode, or when you clear browsing data. '),
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
    // Skip when the stronger durability warning is already showing.
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
        document.createTextNode(`You have ${count} invoices saved only in this browser. `),
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
  const untouched = !raw.seller && raw.items.length === 0;

  // Nothing is required: a lenient parse always yields a renderable, encodable
  // invoice, so the preview and the link both track the form from the very
  // first keystroke. (The upload path still uses the strict parser for real
  // validation — see handleFile.)
  let { invoice, warnings } = parseInvoice(JSON.stringify(raw), 'json', { lenient: true });

  if (invoice && activeTaxRate) {
    const computedTaxMinor = Math.round(invoice.subtotalMinor * activeTaxRate.rate / 100);
    raw.tax = fromMinor(computedTaxMinor, invoice.currency);
    raw.taxlabel = `${activeTaxRate.name} (${activeTaxRate.rate}%)`;
    ({ invoice, warnings } = parseInvoice(JSON.stringify(raw), 'json', { lenient: true }));
    $('fTax').value = String(raw.tax);
  }

  setList('errors', []); // nothing blocks — the invoice always parses
  setList('warnings', warnings);

  // The live preview always reflects the form — nothing is required to see it.
  if (invoice) {
    Object.assign(invoice, styleFromControls());
    renderInvoiceInto($('preview'), invoice);
  }
  const qrEl = $('preview').querySelector('[data-f="qr"]');

  // Hold the link back only while the form is still pristine (nothing typed),
  // so an untouched page isn't offering a link to a blank invoice.
  currentInvoice = untouched ? null : invoice;
  if (untouched || !invoice) {
    qrEl.hidden = true;
    $('result').hidden = true;
    return;
  }

  const payload = await encodeInvoice(invoice);
  // The shared link always points at the durable GitHub Pages host, so it
  // survives our own hosting going away (see shared/durable-link.js). The edit
  // link stays on the current host so in-place editing works wherever you are.
  currentUrl = durableLink(payload);
  $('editLinkInput').value = `${location.origin}/#${payload}`;

  qrEl.hidden = !invoice.qr;
  if (invoice.qr) renderQrInto(qrEl, currentUrl);

  $('link').value = currentUrl;
  $('open').href = currentUrl;
  $('charcount').textContent = `${currentUrl.length.toLocaleString()} characters`;
  $('lengthWarning').hidden = currentUrl.length <= URL_LENGTH_WARNING;

  const share = shareLinks(currentUrl, invoice.seller.name || 'Invoice');
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
  if (invoice.logoUrl) embedLogoFromUrl(invoice.logoUrl);
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
for (const [id] of CUSTOM_CONTROLS) $(id).addEventListener('change', scheduleUpdate);

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

// Result-panel actions — see index.html #result. The old `printBtn`/`saveBtn`
// text links have been replaced with a 4-card action grid; the same underlying
// behaviors live here.
$('downloadBtn').addEventListener('click', () => print());
$('shareBtn').addEventListener('click', () => {
  const panel = $('sharePanel');
  const open = panel.hidden;
  panel.hidden = !open;
  $('shareBtn').setAttribute('aria-expanded', String(open));
});
$('templateBtn').addEventListener('click', () => {
  saveCurrentInvoiceAsTemplate().catch((err) => alert(`Couldn't save template: ${err.message}`));
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
// You can describe a whole invoice on an empty form (creates one) or describe a
// change to an existing one (edits it) — no need to fill anything in first. Text
// is sent only when you click Ask AI; nothing is stored. Tax stays deterministic:
// the model returns a "taxrate" (%) and the app computes the amount.
const AI_ENDPOINT = 'https://musemoose.johnnypicklespartners.workers.dev';
let aiBeforeInv = null;   // snapshot before the last AI run, for Undo
let aiBeforeTax = null;   // tax-mode UI state at snapshot time

function setAiStatus(el, msg, kind) {
  el.textContent = msg || '';
  el.className = 'ai-status' + (kind ? ' ' + kind : '');
}

async function aiRequest(body) {
  const res = await fetch(AI_ENDPOINT + '/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app: 'invoiceiguana', ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  if (!data.manifest || typeof data.manifest !== 'object') {
    throw new Error("The AI didn't return a usable invoice — try rephrasing.");
  }
  return data.manifest;
}

// Apply an AI "raw invoice" to the form + preview. Percentage tax drives the
// app's own computation (no LLM arithmetic); a flat amount goes in as-is.
async function applyRawInvoice(raw) {
  const r = { ...raw };
  const taxrate = r.taxrate;
  delete r.taxrate;
  const { invoice } = parseInvoice(JSON.stringify(r), 'json', { lenient: true });
  fillFormFromInvoice(invoice);
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

const EMPTY_INVOICE = () => parseInvoice('{"seller":"","items":[]}', 'json', { lenient: true }).invoice;

async function aiRun() {
  const statusEl = $('aiEditStatus'), btn = $('aiEditApply');
  const instr = $('aiEditPrompt').value.trim();
  if (!instr) { setAiStatus(statusEl, 'Describe your invoice or a change first.', 'err'); return; }
  btn.disabled = true; setAiStatus(statusEl, 'Working… updating your invoice.', 'working');
  try {
    // Empty form → generate from scratch; existing invoice → edit it.
    const raw0 = rawFromForm();
    const hasContent = !!((raw0.seller && raw0.seller.trim()) || (raw0.items && raw0.items.length));
    // Snapshot BEFORE applying, so Undo always restores (empty form → empty snapshot).
    aiBeforeInv = currentInvoice ? structuredClone(currentInvoice) : EMPTY_INVOICE();
    aiBeforeTax = { preset: $('taxPreset').value, pct: $('fTaxPercent').value };
    const raw = await aiRequest(hasContent ? { prompt: instr, manifest: raw0 } : { prompt: instr });
    await applyRawInvoice(raw);
    renderInvoiceChanges(summarizeInvoiceChanges(aiBeforeInv, currentInvoice));
    setAiStatus(statusEl, ''); $('aiEditPrompt').value = '';
    $('aiReviewBar').hidden = false;
  } catch (e) {
    setAiStatus(statusEl, e.message || 'Something went wrong — try again.', 'err');
  } finally { btn.disabled = false; }
}

function keepAiEdit() { aiBeforeInv = null; aiBeforeTax = null; $('aiReviewBar').hidden = true; }
async function undoAiEdit() {
  if (!aiBeforeInv) { $('aiReviewBar').hidden = true; return; }
  fillFormFromInvoice(aiBeforeInv);
  restoreStyleControls(aiBeforeInv);
  $('taxPreset').value = aiBeforeTax.preset;
  $('fTaxPercent').value = aiBeforeTax.pct;
  applyTaxMode();
  aiBeforeInv = null; aiBeforeTax = null;
  $('aiReviewBar').hidden = true;
  await update();
}

// A truthful summary of what the AI did (diff of before/after invoices).
function summarizeInvoiceChanges(b, a) {
  const wasEmpty = !(b.seller?.name) && !(b.items || []).length;
  if (wasEmpty) {
    const line = ['Drafted your invoice'];
    if (a.totalMinor) line.push(`Total is ${fromMinor(a.totalMinor, a.currency)} ${a.currency || ''}`.trim());
    return line;
  }
  const out = [];
  if ((b.seller?.name || '') !== (a.seller?.name || '')) out.push('Changed the business');
  if ((b.buyer?.name || '') !== (a.buyer?.name || '')) out.push('Changed the client');
  if ((b.invoiceNumber || '') !== (a.invoiceNumber || '')) out.push('Updated the invoice number');
  if ((b.issueDate || '') !== (a.issueDate || '') || (b.dueDate || '') !== (a.dueDate || '')) out.push('Updated the dates');
  if ((b.currency || '') !== (a.currency || '')) out.push('Changed the currency');
  const bn = (b.items || []).length, an = (a.items || []).length;
  if (an > bn) out.push(`Added ${an - bn} line item${an - bn > 1 ? 's' : ''}`);
  else if (an < bn) out.push(`Removed ${bn - an} line item${bn - an > 1 ? 's' : ''}`);
  else if (JSON.stringify(b.items) !== JSON.stringify(a.items)) out.push('Edited the line items');
  if ((b.discountMinor || 0) !== (a.discountMinor || 0)) out.push('Changed the discount');
  if ((b.taxMinor || 0) !== (a.taxMinor || 0) || (b.taxLabel || '') !== (a.taxLabel || '')) out.push('Changed the tax');
  if ((b.notes || '') !== (a.notes || '')) out.push('Updated the notes');
  if ((b.totalMinor || 0) !== (a.totalMinor || 0)) {
    out.push(`Total is now ${fromMinor(a.totalMinor, a.currency)} ${a.currency || ''}`.trim());
  }
  const seen = new Set(), res = [];
  for (const s of out) if (!seen.has(s)) { seen.add(s); res.push(s); }
  return res.slice(0, 7);
}
function renderInvoiceChanges(list) {
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

// ---- saved invoices (IndexedDB) ---------------------------------------------------

/** Loads the saved-list from IndexedDB and renders it. Shows the panel only
 *  when there's at least one saved invoice, so a first-time visitor sees the
 *  same clean editor they always have. */
async function refreshSavedList() {
  let rows;
  try {
    // The 'invoices' store holds every doc kind (invoice/receipt/quote); this
    // page only lists invoices.
    const all = await list('invoices', { index: 'updatedAt', direction: 'prev' });
    rows = all.filter((r) => r.kind === 'invoice');
  } catch {
    // IndexedDB unavailable (e.g. private-window edge cases) — hide the panel
    // and keep the generator working in its original URL-only mode.
    $('savedPanel').hidden = true;
    return;
  }
  const listEl = $('savedList');
  // Count reflects total saved (unfiltered) — the filter only affects what's
  // shown, so a user searching for "acme" still sees the true "12" count.
  $('savedCount').textContent = String(rows.length);
  // The panel is always visible (so first-time visitors learn saving exists and
  // happens automatically). The intro explainer shows only while empty; the
  // filter appears once there are enough rows to be worth filtering.
  $('savedPanel').hidden = false;
  $('savedCount').hidden = rows.length === 0;
  $('savedIntro').hidden = rows.length > 0;
  $('savedFilter').hidden = rows.length <= 3;
  updateSafetyBanners(rows.length).catch(() => {});
  const filter = ($('savedFilter').value || '').trim().toLowerCase();
  if (filter) {
    rows = rows.filter((r) => {
      const parts = [
        r.doc?.invoiceNumber,
        r.doc?.buyer?.name,
        r.doc?.seller?.name,
        r.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return parts.includes(filter);
    });
  }
  $('savedEmpty').hidden = !(filter && rows.length === 0);
  listEl.replaceChildren();
  const fmtDate = (t) => new Date(t).toLocaleDateString();
  const todayISO = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    const isTemplate = row.status === 'template';
    // Overdue: a sent invoice whose due date is in the past. Templates are
    // excluded (they have no real due date). String comparison works because
    // dates are stored as ISO YYYY-MM-DD.
    const isOverdue = !isTemplate && row.status === 'sent'
      && row.doc?.dueDate && row.doc.dueDate < todayISO;
    const li = document.createElement('li');
    li.className = 'saved-item'
      + (row.id === currentSavedId ? ' is-current' : '')
      + (isTemplate ? ' is-template' : '')
      + (isOverdue ? ' is-overdue' : '');
    const label = row.doc?.invoiceNumber || (isTemplate ? 'Untitled template' : 'Untitled invoice');
    const buyer = row.doc?.buyer?.name || (isTemplate ? '' : 'No client');
    // Total is a real scanning aid once the list has more than a few rows —
    // "INV-023 · Widget Co · $1,245.00" is much easier to eyeball than the
    // number alone. Templates skip it since a template's stored total is
    // arbitrary (whatever seeded it).
    const totalStr = !isTemplate && row.doc?.totalMinor != null && row.doc?.currency
      ? fmtMoney(row.doc.totalMinor, row.doc.currency) : '';
    const metaParts = [buyer, fmtDate(row.updatedAt), totalStr].filter(Boolean);
    const meta = metaParts.join(' · ');
    // Status pill: draft/sent/paid cycle for regular invoices; templates get
    // a static "template" badge that opens the doc instead of cycling; sent
    // invoices past their due date get an "overdue" pill instead.
    const statusPill = document.createElement('button');
    statusPill.type = 'button';
    const pillStatus = isOverdue ? 'overdue' : (row.status || 'draft');
    statusPill.className = `saved-status-pill status-${pillStatus}`;
    statusPill.textContent = pillStatus;
    if (isTemplate) {
      statusPill.title = 'Template — open it to start a new invoice from this style/business';
      statusPill.disabled = true;
    } else if (isOverdue) {
      statusPill.title = `Overdue — due ${row.doc.dueDate}. Click to cycle: draft → sent → paid`;
      statusPill.addEventListener('click', (e) => { e.stopPropagation(); cycleStatus(row.id); });
    } else {
      statusPill.title = 'Click to cycle: draft → sent → paid';
      statusPill.addEventListener('click', (e) => { e.stopPropagation(); cycleStatus(row.id); });
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
    // Templates open as a fresh draft (currentSavedId=null so Save creates a
    // new record). Regular invoices open in-place — Save overwrites.
    openBtn.addEventListener('click', () => isTemplate ? openTemplateAsDraft(row.id) : openSavedInvoice(row.id));
    const dup = document.createElement('button');
    dup.type = 'button';
    dup.className = 'ghost saved-dup';
    dup.textContent = 'Duplicate';
    dup.title = 'Copy this invoice into a new draft';
    dup.addEventListener('click', () => duplicateSavedInvoice(row.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ghost saved-del';
    del.textContent = 'Delete';
    del.title = isTemplate ? 'Delete this template' : 'Delete this saved invoice';
    del.addEventListener('click', () => deleteSavedInvoice(row.id, label));
    li.append(openBtn, statusPill, dup, del);
    listEl.append(li);
  }
}

/** Opens a saved template as a new draft — same underlying data load as
 *  duplicateSavedInvoice but keeps the invoice number as-is (templates
 *  shouldn't imply a specific number). Nulls currentSavedId so the next
 *  Save creates a new record instead of overwriting the template. */
async function openTemplateAsDraft(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromInvoice(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = null;
  // Templates suggest the auto-tracked next number, since the stored number
  // came from whichever concrete invoice seeded the template.
  const suggested = await suggestNextInvoiceNumber();
  if (suggested) $('fInvoiceNumber').value = suggested;
  $('taxPreset').value = '';
  applyTaxMode();
  update();
  refreshSavedList();
  flashSaveStatus('Loaded from template — your edits save automatically');
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const STATUS_CYCLE = ['draft', 'sent', 'paid'];
async function cycleStatus(id) {
  const row = await get('invoices', id);
  if (!row) return;
  const current = STATUS_CYCLE.indexOf(row.status);
  row.status = STATUS_CYCLE[(current + 1) % STATUS_CYCLE.length];
  await put('invoices', row);
  refreshSavedList();
}

// ---- saved directories (clients + businesses) ----------------------------------

let clientDirectory = [];
let businessDirectory = [];
let productDirectory = [];

async function refreshDirectories() {
  try {
    [clientDirectory, businessDirectory, productDirectory] = await Promise.all([
      list('clients'),
      list('businesses'),
      list('products'),
    ]);
  } catch {
    clientDirectory = [];
    businessDirectory = [];
    productDirectory = [];
    return;
  }
  const fill = (id, rows) => {
    const dl = $(id);
    dl.replaceChildren();
    for (const row of rows) {
      const opt = document.createElement('option');
      opt.value = row.name;
      dl.append(opt);
    }
  };
  fill('clientNames', clientDirectory);
  fill('businessNames', businessDirectory);
  fill('productNames', productDirectory);
}

/** Upserts the current invoice's parties + line items into their directories
 *  so autocomplete learns from every save. `id` is derived from the name
 *  (lower-cased) so repeated saves of the same client / product update in
 *  place instead of piling up. */
async function persistDirectoryEntries(doc) {
  const nameKey = (s) => (s || '').trim().toLowerCase();
  const puts = [];
  if (doc.buyer?.name?.trim()) {
    puts.push(put('clients', {
      id: `client:${nameKey(doc.buyer.name)}`,
      name: doc.buyer.name.trim(),
      address: doc.buyer.address ?? null,
      contact: doc.buyer.contact ?? null,
    }));
  }
  if (doc.seller?.name?.trim()) {
    puts.push(put('businesses', {
      id: `biz:${nameKey(doc.seller.name)}`,
      name: doc.seller.name.trim(),
      address: doc.seller.address ?? null,
      contact: doc.seller.contact ?? null,
      logoData: doc.logoData ?? null,
    }));
  }
  for (const item of doc.items || []) {
    if (!item.name?.trim() || !item.priceMinor) continue;
    puts.push(put('products', {
      id: `product:${nameKey(item.name)}`,
      name: item.name.trim(),
      priceMinor: item.priceMinor,
      currency: doc.currency,
    }));
  }
  await Promise.all(puts);
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

/** Autofills the price on a line item row from the saved product catalog.
 *  Only fires when the price is still blank (so the user's typed override
 *  wins) and when the saved product's currency matches the current invoice's
 *  currency (a USD-priced product doesn't belong in a JPY invoice). */
function autofillProductPrice(row) {
  const nameEl = row.querySelector('.i-name');
  const priceEl = row.querySelector('.i-price');
  if (!nameEl.value.trim() || priceEl.value.trim()) return false;
  const key = nameEl.value.trim().toLowerCase();
  const hit = productDirectory.find((p) => p.name.trim().toLowerCase() === key);
  if (!hit) return false;
  const currency = $('fCurrency').value || 'USD';
  if (hit.currency && hit.currency !== currency) return false;
  priceEl.value = String(fromMinor(hit.priceMinor, currency));
  return true;
}

async function saveCurrentInvoice() {
  if (!currentInvoice) return;
  // Preserve the existing status when overwriting a saved invoice; a fresh
  // save defaults to 'draft'. Explicit status changes come from cycleStatus.
  let status = 'draft';
  if (currentSavedId) {
    const existing = await get('invoices', currentSavedId);
    if (existing?.status) status = existing.status;
  }
  const record = { id: currentSavedId, kind: 'invoice', status, doc: currentInvoice };
  const saved = await put('invoices', record);
  currentSavedId = saved.id;
  await recordNextInvoiceNumber(currentInvoice.invoiceNumber);
  await persistDirectoryEntries(currentInvoice);
  await refreshDirectories();
  setSavedStatus();
  refreshSavedList();
}

/** Saves the current invoice as a template — a separate record with
 *  status='template' so it doesn't clutter the draft/sent/paid list, and
 *  isn't the "current" record either (so a follow-up Save doesn't overwrite
 *  the template with a filled-in client's invoice). Opening a template later
 *  loads it as a fresh draft. */
async function saveCurrentInvoiceAsTemplate() {
  if (!currentInvoice) return;
  // Always creates a new record (id: null) — templates don't overwrite.
  const record = { id: null, kind: 'invoice', status: 'template', doc: currentInvoice };
  await put('invoices', record);
  await persistDirectoryEntries(currentInvoice);
  await refreshDirectories();
  flashSaveStatus('Saved as template');
  refreshSavedList();
}

/** Parses "INV-2026-014" into { prefix: "INV-2026-", num: 14, padLen: 3 }.
 *  Only the trailing run of digits is treated as the counter; the rest is
 *  preserved verbatim as the prefix. Returns null for numbers without any
 *  trailing digits (e.g. "invoice for Q3"). */
function parseInvoiceNumber(str) {
  if (!str) return null;
  const match = /^(.*?)(\d+)$/.exec(str);
  if (!match) return null;
  return { prefix: match[1], num: Number(match[2]), padLen: match[2].length };
}

function formatInvoiceNumber({ prefix, num, padLen }) {
  return `${prefix}${String(num).padStart(padLen, '0')}`;
}

async function recordNextInvoiceNumber(current) {
  const parsed = parseInvoiceNumber(current);
  if (!parsed) return;
  await setMeta('nextInvoiceNumber', { ...parsed, num: parsed.num + 1 });
}

async function suggestNextInvoiceNumber() {
  const next = await getMeta('nextInvoiceNumber');
  return next ? formatInvoiceNumber(next) : '';
}

async function openSavedInvoice(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromInvoice(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = id;
  // Reset any tax-preset UI state — the saved doc already carries a flat tax.
  $('taxPreset').value = '';
  applyTaxMode();
  update();
  refreshSavedList();
  // Bring the editor into view; on mobile the saved panel is above the form.
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteSavedInvoice(id, label) {
  if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
  await remove('invoices', id);
  if (currentSavedId === id) currentSavedId = null;
  refreshSavedList();
}

/** Duplicates a saved invoice: loads it into the form as an unsaved draft,
 *  bumps its own invoice number (so #INV-2026-014 duplicates to -015 rather
 *  than the meta-tracked "next"), and resets the dates to today + net-30.
 *  User's next Save creates a new record instead of overwriting the source. */
async function duplicateSavedInvoice(id) {
  const row = await get('invoices', id);
  if (!row?.doc) return;
  fillFormFromInvoice(row.doc);
  restoreStyleControls(row.doc);
  currentSavedId = null;
  const parsed = parseInvoiceNumber(row.doc.invoiceNumber);
  $('fInvoiceNumber').value = parsed
    ? formatInvoiceNumber({ ...parsed, num: parsed.num + 1 })
    : (await suggestNextInvoiceNumber());
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('fIssueDate').value = fmt(today);
  $('fDueDate').value = fmt(due);
  $('taxPreset').value = '';
  applyTaxMode();
  // Persist the copy right away so "Duplicate" produces a real new saved record
  // (currentSavedId is null, so this creates one rather than overwriting).
  userEdited = true;
  await update();
  await saveCurrentInvoice();
  document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function resetToNewInvoice() {
  currentSavedId = null;
  $('form').reset();
  $('itemRows').replaceChildren();
  addItemRow();
  pendingLogoData = null;
  pendingLogoError = null;
  updateLogoFileStatus();
  // Re-apply the "today + 30 days" defaults used on a fresh page load.
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('fIssueDate').value = fmt(today);
  $('fDueDate').value = fmt(due);
  // Suggest the next invoice number based on the last one the user saved.
  $('fInvoiceNumber').value = await suggestNextInvoiceNumber();
  // Style controls default: classic template, no accent, no QR, no branding off.
  const classic = document.querySelector('input[name="template"][value="classic"]');
  if (classic) classic.checked = true;
  $('fAccentOn').checked = false;
  $('fAccent').disabled = true;
  $('fQr').checked = false;
  $('fBrandingOff').checked = false;
  updateCustomPanel();
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
  // Remember the backup so the "download a backup" reminder stays quiet for a while.
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
$('myInvoicesBtn').addEventListener('click', () => {
  $('savedPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Any genuine edit inside the editor arms auto-save. Programmatic fills (opening
// a saved invoice, loading an edit link) set values without firing input/change,
// so they never trip this — auto-save waits for the user's first real edit.
const editorEl = document.querySelector('.editor');
editorEl.addEventListener('input', () => { userEdited = true; });
editorEl.addEventListener('change', () => { userEdited = true; });

// Autocomplete: when the seller/client name matches a saved directory entry,
// auto-fill the address/contact fields that are still blank. Never overwrites
// values the user has already typed.
$('fSeller').addEventListener('change', () => {
  if (autofillFromDirectory($('fSeller').value, businessDirectory,
      [['fSellerAddress', 'address'], ['fSellerContact', 'contact']])) scheduleUpdate();
});
$('fBuyer').addEventListener('change', () => {
  if (autofillFromDirectory($('fBuyer').value, clientDirectory,
      [['fBuyerAddress', 'address'], ['fBuyerContact', 'contact']])) scheduleUpdate();
});
$('newInvoiceBtn').addEventListener('click', resetToNewInvoice);
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

// ---- boot ---------------------------------------------------------------------------

buildTemplatePicker();
buildCurrencyPicker();
const loadedFromEditLink = await loadFromHash();
if (!loadedFromEditLink) {
  addItemRow();
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('fIssueDate').value = fmt(today);
  $('fDueDate').value = fmt(dueDate);
  const suggested = await suggestNextInvoiceNumber();
  if (suggested) $('fInvoiceNumber').value = suggested;
}
update();
await checkPersistedPassive();
refreshSavedList();
refreshDirectories();
