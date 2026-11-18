/**
 * Arrival counts. Cloudflare's free analytics can't see query strings, so —
 * like Website Wombat — a page counts an arrival by fetching a tiny static file
 * under /e/, and Cloudflare's per-path request counts are the tally. No cookies,
 * no IDs, nothing about the document.
 *
 *   ?ref=credit-invoice|credit-quote|credit-receipt|credit-split -> clicked a document's "make your own" credit
 *   ?utm_source=chatgpt.com                           -> opened a link ChatGPT showed
 *
 * The tags are then dropped from the address (the #fragment is kept), so a
 * reload, bookmark or forwarded link doesn't count again.
 */
const EVENTS = new Set(['credit-invoice', 'credit-quote', 'credit-receipt', 'credit-split']);

export function countArrival() {
  const params = new URLSearchParams(location.search);
  const hits = [];
  const ref = params.get('ref');
  if (EVENTS.has(ref)) hits.push(ref);
  if (/chatgpt\.com/i.test(params.get('utm_source') || '')) hits.push('from-chatgpt');
  if (!hits.length) return;
  for (const ev of hits) {
    fetch(`/e/${ev}.txt`, { cache: 'no-store', keepalive: true }).catch(() => {});
  }
  params.delete('ref');
  params.delete('utm_source');
  const rest = params.toString();
  try { history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`); } catch { /* ignore */ }
}
