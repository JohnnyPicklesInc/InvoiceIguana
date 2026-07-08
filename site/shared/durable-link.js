/**
 * "Durable link" — points at the site as published via GitHub Pages instead
 * of our own hosting (e.g. Cloudflare Pages), so it survives that hosting
 * disappearing.
 *
 * GitHub Pages was chosen after jsDelivr's GitHub CDN was tried and found to
 * serve .html as text/plain (confirmed against a live request, not just
 * assumed from docs) — same as raw.githubusercontent.com — so a browser
 * would show source instead of running the page. GitHub Pages is actually
 * built to serve committed content with correct MIME types.
 *
 * NOT pinned to a specific historical release: this always points at
 * whatever `.github/workflows/pages.yml` currently has deployed (on every
 * push to master), not a frozen snapshot. True per-release pinning on Pages
 * would need a versioned-snapshot publishing scheme (accumulating a folder
 * per tag) — more infrastructure than this project needs right now. What
 * actually keeps old links working is the codec's own backward-compatibility
 * design: the version+doc-type prefix and lenient style-field decoding mean
 * newer code always correctly decodes older payloads (see the pinned-fixture
 * regression test in scripts/selftest.mjs). If that guarantee is ever broken
 * on purpose, this is the tradeoff that would need revisiting.
 */
// TODO: confirm once the repo is public and GitHub Pages is enabled for it.
const PAGES_BASE = 'https://johnnypicklesinc.github.io/InvoiceIguana';

export function durableLink(payload) {
  return `${PAGES_BASE}/r.html#${payload}`;
}
