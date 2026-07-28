/**
 * Bill of Sale generator. A one-off document, so this is intentionally lean —
 * no IndexedDB/save/sync/templates (unlike the invoice/receipt pages): just a
 * form <-> live preview, the shared AI box (draft/edit + Keep/Undo), and
 * print-to-PDF. The AI text is sent to MuseMoose only when you click Ask AI.
 * This is a general template, NOT legal advice (see the on-page disclaimer).
 */
const $ = (id) => document.getElementById(id);
const AI_ENDPOINT = 'https://musemoose.johnnypicklespartners.workers.dev';

// nav switch (matches the other generators)
$('docTypeNav').addEventListener('change', (e) => { location.href = e.target.value; });

function money(n, cur) {
  const num = Number(String(n).replace(/[^0-9.\-]/g, '')) || 0;
  const s = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const c = (cur || 'USD').toUpperCase();
  return c === 'USD' ? `$${s}` : `${s} ${c}`;
}

const FIELDS = {
  fItemType: 'itemtype', fItem: 'item', fPrice: 'price', fCurrency: 'currency',
  fSeller: 'seller', fSellerAddress: 'selleraddress', fBuyer: 'buyer', fBuyerAddress: 'buyeraddress',
  fDate: 'saledate', fPayment: 'payment', fTerms: 'terms',
};

function readForm() {
  const o = {};
  for (const [id, key] of Object.entries(FIELDS)) {
    const v = $(id).value.trim();
    if (v) o[key] = key === 'price' ? Number(v.replace(/[^0-9.\-]/g, '')) || 0 : v;
  }
  return o;
}

function fillForm(o) {
  for (const [id, key] of Object.entries(FIELDS)) {
    if (o[key] != null && o[key] !== '') $(id).value = String(o[key]);
  }
}

// --- live preview (createElement/textContent only — never innerHTML) ---------
function line(cls, ...parts) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  parts.forEach((part) => {
    if (typeof part === 'string') p.appendChild(document.createTextNode(part));
    else p.appendChild(part);
  });
  return p;
}
function strong(t) { const s = document.createElement('strong'); s.textContent = t; return s; }

function render() {
  const o = readForm();
  const pv = $('preview');
  pv.replaceChildren();

  const h = document.createElement('h1'); h.className = 'bos-title'; h.textContent = 'BILL OF SALE';
  pv.appendChild(h);
  pv.appendChild(line('bos-date', o.saledate ? `Date of sale: ${o.saledate}` : 'Date of sale: ____________'));

  pv.appendChild(line('bos-party', strong('Seller: '), o.seller || '____________', o.selleraddress ? `  ·  ${o.selleraddress}` : ''));
  pv.appendChild(line('bos-party', strong('Buyer: '), o.buyer || '____________', o.buyeraddress ? `  ·  ${o.buyeraddress}` : ''));

  pv.appendChild(line('bos-body', 'For the sum of ', strong(money(o.price, o.currency)),
    ', the Seller sells and transfers to the Buyer all right, title and interest in the following:'));
  pv.appendChild(line('bos-item', o.item || '____________________'));

  if (o.payment) pv.appendChild(line('bos-meta', strong('Payment: '), o.payment));
  pv.appendChild(line('bos-terms', o.terms || 'Sold as-is, where-is, with no warranty, express or implied.'));

  const sig = document.createElement('div'); sig.className = 'bos-sigs';
  sig.appendChild(line('bos-sig', strong('Seller signature: '), '_______________________   Date: __________'));
  sig.appendChild(line('bos-sig', strong('Buyer signature: '), '_______________________   Date: __________'));
  pv.appendChild(sig);
}

$('form').addEventListener('input', render);
$('printBtn').addEventListener('click', () => window.print());

// --- AI: draft or edit the bill of sale --------------------------------------
let aiBefore = null;

function setAiStatus(msg, kind) {
  const el = $('aiEditStatus');
  el.textContent = msg || '';
  el.className = 'ai-status' + (kind ? ' ' + kind : '');
}

async function aiRequest(body) {
  const res = await fetch(AI_ENDPOINT + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app: 'invoiceiguana-billofsale', ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  if (!data.manifest || typeof data.manifest !== 'object') {
    throw new Error("The AI didn't return a usable bill of sale — try rephrasing.");
  }
  return data.manifest;
}

async function aiRun() {
  const instr = $('aiEditPrompt').value.trim();
  if (!instr) { setAiStatus('Describe the sale or a change first.', 'err'); return; }
  const btn = $('aiEditApply');
  btn.disabled = true; setAiStatus('Working… drafting your bill of sale.', 'working');
  try {
    const cur = readForm();
    const hasContent = !!(cur.seller || cur.buyer || cur.item);
    aiBefore = cur;
    const raw = await aiRequest(hasContent ? { prompt: instr, manifest: cur } : { prompt: instr });
    fillForm(raw);
    render();
    $('aiReviewMsg').textContent = hasContent ? '✨ Updated your bill of sale — keep it?' : '✨ Drafted your bill of sale — keep it?';
    setAiStatus(''); $('aiEditPrompt').value = '';
    $('aiReviewBar').hidden = false;
  } catch (e) {
    setAiStatus(e.message || 'Something went wrong — try again.', 'err');
  } finally { btn.disabled = false; }
}

function clearForm() { for (const id of Object.keys(FIELDS)) $(id).value = ''; }

function keepAi() { aiBefore = null; $('aiReviewBar').hidden = true; }
function undoAi() {
  if (aiBefore) { clearForm(); fillForm(aiBefore); render(); aiBefore = null; }
  $('aiReviewBar').hidden = true;
}

$('aiEditApply').addEventListener('click', aiRun);
$('aiKeep').addEventListener('click', keepAi);
$('aiUndo').addEventListener('click', undoAi);
$('aiEditPrompt').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); aiRun(); }
});

// --- boot --------------------------------------------------------------------
(function boot() {
  if (!$('fDate').value) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    $('fDate').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (!$('fCurrency').value) $('fCurrency').value = 'USD';
  if (!$('fTerms').value) $('fTerms').value = 'Sold as-is, where-is, with no warranty, express or implied.';
  render();

  // Deep-link from a landing page: ?prompt=... pre-fills the AI box (no auto-run,
  // so AI calls stay tied to a real click — protects the per-app daily budget).
  const seed = new URLSearchParams(location.search).get('prompt');
  if (seed) {
    const box = $('aiEditPrompt');
    box.value = seed.slice(0, 2000);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.focus();
  }
})();
