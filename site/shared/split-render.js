/**
 * Bill-split renderer — fills a .split DOM subtree (markup in r.html and
 * split.html) from a normalized split. Shared by the viewer and the generator's
 * live preview. Strings via textContent / createElement only — no innerHTML.
 */
import { money } from './render.js';
import { splitShares, payLinks } from './split.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function renderSplitInto(root, s) {
  const $ = (f) => root.querySelector(`[data-f="${f}"]`);
  const m = (minor) => money(minor, s.currency);
  const r = splitShares(s);
  const payer = s.payer != null ? s.people[s.payer] : null;

  $('title').textContent = s.title || 'Splitting the bill';
  const meta = [s.date, `${s.people.length} people`, `total ${m(r.totalMinor)}`].filter(Boolean).join(' · ');
  $('meta').textContent = meta;
  $('paidby').textContent = payer ? `${payer} paid — everyone else pays ${payer} back.` : '';
  $('paidby').hidden = !payer;

  const list = $('shares');
  list.replaceChildren();
  for (const sh of r.shares) {
    const card = el('li', `share${sh.isPayer ? ' is-payer' : ''}`);
    const head = el('div', 'share-head');
    head.append(el('span', 'share-name', sh.name), el('span', 'share-amt', m(sh.minor)));
    card.append(head);
    if (sh.lines.length) {
      const ul = el('ul', 'share-lines');
      for (const ln of sh.lines) {
        ul.append(el('li', null, `${ln.name}${ln.shared > 1 ? ` (÷${ln.shared})` : ''}`));
      }
      card.append(ul);
    }
    if (sh.isPayer) {
      card.append(el('p', 'share-note', `Paid the bill · gets back ${m(r.totalMinor - sh.minor)}`));
    } else if (sh.minor > 0) {
      const links = payLinks(s, sh.minor);
      if (links.length) {
        const row = el('div', 'share-pay');
        for (const l of links) {
          const a = el('a', 'btn-pay-sm', payer ? `${l.label}${l.label === 'Pay' ? '' : ` ${payer}`}` : l.label);
          a.href = l.href;
          a.target = '_blank';
          a.rel = 'noopener nofollow';
          row.append(a);
        }
        card.append(row);
      }
    }
    list.append(card);
  }

  const rows = [['Subtotal', r.subtotalMinor]];
  if (r.taxMinor) rows.push(['Tax', r.taxMinor]);
  if (r.tipMinor) rows.push(['Tip', r.tipMinor]);
  rows.push(['Total', r.totalMinor]);
  const tb = $('totals');
  tb.replaceChildren();
  for (const [label, minor] of rows) {
    const tr = el('tr', label === 'Total' ? 'split-total' : null);
    tr.append(el('td', null, label), el('td', 'num', m(minor)));
    tb.append(tr);
  }
  $('note').textContent = s.note || '';
  $('note').hidden = !s.note;
  return r;
}
