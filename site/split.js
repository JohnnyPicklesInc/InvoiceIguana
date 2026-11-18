/**
 * Bill-split generator (/split). Form -> parseSplit -> live preview (the same
 * renderer as the viewer) -> share link /r#1s... and edit link /split#1s...
 * Opening /split#<payload> (or a readable #doc=split&... link) refills the form.
 * Nothing is stored; there is no server.
 */
import { parseSplit, encodeSplit, decodeSplit, DOC_SPLIT } from './shared/split.js';
import { renderSplitInto } from './shared/split-render.js';
import { fromMinor, currencyExponent, payloadHeader } from './shared/codec.js';
import { isReadableFragment, readableSplitRaw } from './shared/readable.js';
import { countArrival } from './shared/arrival.js';

countArrival();

const $ = (id) => document.getElementById(id);
const ORIGIN = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin : 'https://invoiceiguana.com';

// ---- item rows ------------------------------------------------------------------
function addItemRow(item = { name: '', price: '', who: '' }) {
  const row = document.createElement('div');
  row.className = 'split-item';
  const mk = (cls, ph, val, mode) => {
    const i = document.createElement('input');
    i.type = 'text'; i.className = cls; i.placeholder = ph; i.value = val ?? '';
    if (mode) i.inputMode = mode;
    i.addEventListener('input', update);
    return i;
  };
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'ghost remove'; del.textContent = '×'; del.title = 'Remove item';
  del.addEventListener('click', () => { row.remove(); update(); });
  row.append(mk('it-name', 'Pasta', item.name), mk('it-price', '24.00', item.price, 'decimal'), mk('it-who', 'Ann (blank = everyone)', item.who), del);
  $('itemRows').append(row);
}

const mode = () => document.querySelector('input[name="mode"]:checked').value;

function syncMode() {
  $('evenBox').hidden = mode() !== 'even';
  $('itemsBox').hidden = mode() !== 'items';
  if (mode() === 'items' && !$('itemRows').children.length) { addItemRow(); addItemRow(); }
}

function syncPayer() {
  const names = $('fPeople').value.split(',').map((x) => x.trim()).filter(Boolean);
  const sel = $('fPaidBy');
  const cur = sel.value;
  sel.replaceChildren(new Option('Nobody yet', ''));
  for (const n of names) sel.append(new Option(n, n));
  if (names.includes(cur)) sel.value = cur;
}

// ---- form <-> raw ---------------------------------------------------------------
function readForm() {
  const raw = {
    title: $('fTitle').value, date: $('fDate').value, people: $('fPeople').value,
    paidby: $('fPaidBy').value, currency: $('fCurrency').value,
    tax: $('fTax').value, tip: $('fTip').value,
    paypal: $('fPaypal').value, cashapp: $('fCashapp').value, venmo: $('fVenmo').value,
    paymenturl: $('fPayUrl').value, note: $('fNote').value,
  };
  if (mode() === 'even') raw.amount = $('fAmount').value;
  else {
    raw.items = [...$('itemRows').children].map((r) => ({
      name: r.querySelector('.it-name').value, price: r.querySelector('.it-price').value, who: r.querySelector('.it-who').value,
    })).filter((it) => it.name.trim() || String(it.price).trim());
  }
  return raw;
}

function fillForm(s) {
  const amt = (minor) => (minor == null ? '' : fromMinor(minor, s.currency).toFixed(currencyExponent(s.currency)));
  $('fTitle').value = s.title ?? '';
  $('fDate').value = s.date ?? '';
  $('fPeople').value = s.people.join(', ');
  syncPayer();
  $('fPaidBy').value = s.payer != null ? s.people[s.payer] : '';
  $('fCurrency').value = s.currency;
  $('fTax').value = amt(s.taxMinor);
  $('fTip').value = amt(s.tipMinor);
  $('fPaypal').value = s.pay.paypal ?? '';
  $('fCashapp').value = s.pay.cashapp ?? '';
  $('fVenmo').value = s.pay.venmo ?? '';
  $('fPayUrl').value = s.pay.url ?? '';
  $('fNote').value = s.note ?? '';
  $('itemRows').replaceChildren();
  if (s.items.length) {
    document.querySelector('input[name="mode"][value="items"]').checked = true;
    for (const it of s.items) addItemRow({ name: it.name, price: amt(it.priceMinor), who: it.who.map((i) => s.people[i]).join(', ') });
  } else {
    document.querySelector('input[name="mode"][value="even"]').checked = true;
    $('fAmount').value = amt(s.amountMinor);
  }
  syncMode();
}

// ---- update loop ----------------------------------------------------------------
function showList(id, msgs) {
  const ul = $(id);
  ul.replaceChildren(...msgs.map((m) => Object.assign(document.createElement('li'), { textContent: m })));
  ul.hidden = !msgs.length;
}

function showPlaceholder() {
  const p = $('preview');
  p.querySelector('[data-f="title"]').textContent = 'Who owes what';
  p.querySelector('[data-f="meta"]').textContent = 'Add who was there and the bill — each person’s share shows up here.';
  p.querySelector('[data-f="paidby"]').hidden = true;
  p.querySelector('[data-f="shares"]').replaceChildren();
  p.querySelector('[data-f="totals"]').replaceChildren();
  p.querySelector('[data-f="note"]').hidden = true;
}

let seq = 0;
async function update() {
  const mine = ++seq;
  const raw = readForm();
  const touched = String(raw.people).trim() || raw.amount || raw.items?.length;
  const { split, errors, warnings } = parseSplit(raw);
  showList('errors', touched ? errors : []);
  showList('warnings', split ? warnings : []);
  if (!split) {
    $('result').hidden = true;
    showPlaceholder();
    return;
  }
  renderSplitInto($('preview'), split);
  const payload = await encodeSplit(split);
  if (mine !== seq) return; // a newer edit already won
  const link = `${ORIGIN}/r#${payload}`;
  $('linkInput').value = link;
  $('openLink').href = link;
  $('waLink').href = `https://wa.me/?text=${encodeURIComponent(`${split.title || 'Our bill'} — what you owe: ${link}`)}`;
  $('smsLink').href = `sms:?&body=${encodeURIComponent(link)}`;
  $('editLinkInput').value = `${ORIGIN}/split#${payload}`;
  $('result').hidden = false;
}

async function copy(inputId, btnId) {
  try { await navigator.clipboard.writeText($(inputId).value); } catch { $(inputId).select(); }
  const b = $(btnId); const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1200);
}

// ---- wiring ---------------------------------------------------------------------
$('form').addEventListener('input', (e) => {
  if (e.target.id === 'fPeople') syncPayer();
  if (e.target.name === 'mode') syncMode();
  update();
});
$('form').addEventListener('change', update);
$('addItem').addEventListener('click', () => { addItemRow(); });
$('copyLink').addEventListener('click', () => copy('linkInput', 'copyLink'));
$('copyEdit').addEventListener('click', () => copy('editLinkInput', 'copyEdit'));
$('docTypeNav').addEventListener('change', (e) => { location.href = e.target.value; });

async function loadFromHash() {
  const frag = decodeURIComponent(location.hash.slice(1) || '');
  if (!frag) return;
  try {
    if (isReadableFragment(frag)) {
      const { split } = parseSplit(readableSplitRaw(frag));
      if (split) fillForm(split);
    } else if (payloadHeader(frag).docType === DOC_SPLIT) {
      fillForm(await decodeSplit(frag));
    }
  } catch { /* a bad edit link just leaves the form empty */ }
}

await loadFromHash();
syncMode();
update();
