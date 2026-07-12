# Roadmap

## The idea

One pattern, one product: **small structured documents that live entirely inside their
link.** A codec compresses the document into the URL fragment; a static viewer page
decodes and renders it. No server storage, no accounts, no expiry, private by
architecture (fragments never reach the server), free to host at any scale.

🦎 **InvoiceIguana** is that product. It isn't a single document type wearing one
brand — it's one app, one domain, supporting a growing family of document types:

| Document type | Status |
|---|---|
| Invoices | web-first, built: form editor, A4-style template, QR, print-to-PDF export, seller/buyer blocks, invoice #, issue/due dates, payment instructions, discount/tax, configurable tax-rate presets, one-click email/SMS/WhatsApp share, durable GitHub-backed link. Not yet deployed. |
| Receipts | built: form editor, 4 templates, QR, PNG/print export, contact/discount/reference/tax-label fields, configurable tax-rate presets, one-click share, durable link. Not yet deployed. |
| Quotes / estimates ("QuoteQuail" concept) | planned — a future document type inside InvoiceIguana, not a separate brand |
| Contact cards | idea, not scheduled |
| Recipe cards | idea, not scheduled (see risks — payload size) |

## Architecture decisions (settled)

- **One app, one domain, one repo.** Every link embeds its domain forever — the domain
  that mints links must serve the viewer indefinitely. Document types live at `/`
  (invoice), `/receipt`, and later `/quote`, `/card`, `/recipe`; one shared viewer at
  `/r` dispatches all of them by payload doc-type.
- **Web-first, extension demoted.** The generator is a web page (mobile + SEO + zero
  install friction); the Chrome extension is a thin shortcut that opens the site.
- **Payload carries a doc-type character**: `<version><type>` prefix, e.g. `1i…`
  invoice, `1r…` receipt, `1q…` quote, `1c…` card, `1p…` recipe. One byte buys a single
  viewer dispatching every document type, forever.
- **Shared core** (`site/shared/`): codec (deflate-raw + base64url + versioning), money
  helpers, safe DOM renderer, template/style system, QR (vendored qrcodegen), export
  helpers. Each document type adds only: a parse schema, templates, a form editor, a
  landing/feature page.

## Monetization posture (settled for now)

**Everything free. No payment code.** The "made with InvoiceIguana 🦎" branding line
stays on every document — it is the growth loop. A future unlock (branding removal via
Stripe, ~$10/mo) is deferred until the free product shows organic pull. Kill criterion:
if ~6 weeks after launch the viewer gets no meaningful organic link-opens from
strangers, don't invest in monetization. Ads were evaluated and rejected (30–50× worse
per visitor than subscriptions; approval risk in this niche).

## Per-document-type scope (delta beyond the shared core)

- **Quotes / estimates** — *nearly free (1–2 days).* Invoice minus payment-due, plus
  validity date and "prepared for" framing; `mailto:` accept button. Real acceptance
  tracking needs a server — out of scope.
- **Contact cards** — *small twist (2–4 days).* No money fields; new form (name/title/
  org/phones/links). New feature: client-side **.vcf (vCard) download** (~40-line text
  generator) so "Save to contacts" works. QR is the hero feature (already built). No
  photo uploads — images don't fit in links; emoji/initials avatar instead.
- **Recipe cards** — *real work (about a week) + a design constraint.* New schema
  (ingredients qty/unit/name, ordered prose steps), servings scaling (structured-
  quantity math), checkable steps. **Payload-size risk**: prose steps can push links
  past the ~2,000-char chat-safe budget — needs a live length meter in the editor and
  copy guidance. Do this one last, deliberately.
- **PNG export caveat (all document types):** the canvas PNG renderer is layout-
  specific — each type needs its own drawing code (~1 day each). Policy: new types
  launch with print-to-PDF only; add PNG per-type when usage justifies it.

## Sequencing

1. **Phase 1 (done): receipts, then invoices, unified under InvoiceIguana** —
   restructured to `site/` (invoice generator at `/`, receipt generator at `/receipt`,
   viewer at `/r`), doc-type char in codec, style keys (template/accent/emoji/QR),
   type-in form editors, PNG (receipts) + print-to-PDF export, PWA manifest, privacy
   page, extension demoted. Includes contact/discount/reference/tax-label fields,
   configurable tax-rate presets, one-click share links, an optional external
   logo-image URL, and a durable GitHub Pages-backed link as an alternative to the
   normal hosted one (jsDelivr was tried first but rejected — confirmed it serves
   .html as text/plain, so it wouldn't actually render as a live page). Selftest stays
   green throughout (33/33 as of this writing).
2. **Phase 2: deploy + launch** — Cloudflare Pages, GitHub Pages, Cloudflare Web
   Analytics, Show HN (the codec/architecture story), Product Hunt, open-source repo.
3. **Phase 3: quotes/estimates** — a third document type inside InvoiceIguana, its own
   feature page and launch moment.
4. **Phase 4: contact cards** — vCard + QR story, mobile-first marketing.
5. **Phase 5 (conditional):** recipe cards; monetization (branding-removal unlock) if
   the analytics show pull; extension to Web Store as a shortcut.

## Standing risks

- **Permanent-link commitment**: the viewer must be served forever on whatever domain
  mints links. Never mint from a domain we're not committed to.
- **Fraud-adjacent demand**: part of "receipt/invoice maker" search intent is
  fake-document fraud. Never target those queries or features; it risks payment
  processors, ad networks, and the brand. Legitimate intents only (small business,
  digital receipts, freelancers, sharing).
- **Payload ceiling**: ~2,000 chars is the chat-app-safe budget (real invoices/receipts:
  ~100 items fit). Editors for prose-heavy document types need length meters.
- **Only a bounded low-res image can be embedded in links**: a full-size photo/logo
  doesn't fit the payload budget, so the generator's one logo field (paste a URL or
  choose a file) downloads it once and compresses it to a small 64×64 JPEG before
  embedding it directly (capped size, see `shared/logo-embed.js` and `wire.js`'s
  `MAX_LOGO_B64`) — fully private, nothing contacted, no matter which of the two ways
  the image came in. Accent color remains the zero-dependency fallback if there's no
  logo, or if a pasted URL can't be downloaded client-side (some hosts block
  cross-origin fetches — the generator surfaces a clear error rather than
  falling back to an external reference). The codec can still *decode* the older
  plain-external-URL form for backward compatibility (see `site/privacy.html`) — that's
  the one case that isn't fully private, and it only affects links made before this
  changed. PNG/PDF export remains the escape hatch for shares that need to be
  self-contained files.
