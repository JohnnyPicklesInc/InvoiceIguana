# 🦎 InvoiceIguana

A free invoice (and receipt) maker where **the whole document lives in the URL**. Type
it in (or upload JSON/CSV), share the link — no signup, no watermark, no server
storage, no database. The link *is* the document.

- **Invoice generator** (`/`): a web page — form editor with live preview, or JSON/CSV
  upload. Works on phones. Pick an accent color, emoji or logo, QR code; print/save as PDF.
- **Receipt generator** (`/receipt`): the same idea for receipts — thermal-style
  templates, tax presets, PNG export.
- **Viewer** (`/r#<payload>`): decodes the URL hash fragment and renders whichever
  document type the link contains in the recipient's browser. The fragment is never
  sent to any server.
- **Chrome extension** (`extension/`): an optional thin shortcut that opens the web app.

## How a link works

```
https://<host>/r#1i<base64url(deflate-raw(compact JSON))>
```

`1` is the payload version, `i` is the document type (`r` receipt, `i` invoice —
reserved for a wider family: `q` quote/estimate, `c` card, `p` recipe). The document is
normalized (money as integer minor units), mapped to short keys, compressed with the
browser's native `CompressionStream('deflate-raw')`, and base64url-encoded. A typical
invoice or receipt is a few hundred characters of URL; ~100 realistic line items still
fit under the ~2,000-character chat-app-safe budget. Styling (accent color, emoji, logo
URL, QR flag) rides in the payload only when non-default, so plain documents stay
minimal.

## File formats (upload path)

### Invoice JSON

Required: `seller`, `items` (each needs `name` + `price`; `qty` defaults to 1).
Optional: `selleraddress`, `sellercontact`, `buyer`, `buyeraddress`, `buyercontact`,
`invoicenumber`, `issuedate`, `duedate`, `currency` (3-letter code, default `USD`),
`subtotal`, `discount`, `tax`, `taxlabel` (purely descriptive — never affects the math),
`total`, `paymentinstructions`, `notes`, `logourl` (an `https://` image URL — hosted
externally, so it can break if that image ever moves, and viewing the invoice will
contact that server; the generator's emoji logo avoids both trade-offs and is the
fallback if this is unset or fails to load). `total = subtotal - discount + tax`.

The generator's form also has a **logo image upload** (upload-only, not part of the
JSON/CSV schema — like the accent color and emoji, it's a generator-UI-only style
control). It's compressed client-side to a 64×64 JPEG at ~70% quality and embedded
directly in the link, so — unlike `logourl` — nothing is ever contacted when the
document is viewed. It's capped to a small size to keep links shareable; an oversized
or very complex image gets a clear error instead of silently producing a huge link,
and the `logourl` option remains for a larger/full-quality external logo.
Omitted `subtotal`/`total` are computed; provided values that disagree with the
computed ones by more than one minor unit produce a warning, not an error.

```json
{
  "seller": "Acme Consulting",
  "buyer": "Client Co",
  "invoicenumber": "INV-2026-001",
  "items": [ { "name": "Consulting hours", "qty": 10, "price": 150 } ],
  "tax": 80
}
```

### Invoice CSV

Metadata rows are `key,value`; line items are `item,<name>,<qty>,<unit price>`
(qty optional). Quote fields that contain commas.

```
seller,Acme Consulting
buyer,Client Co
tax,80
item,Consulting hours,10,150
```

### Receipt JSON / CSV

The receipt generator (`/receipt`) uses the same shape idea with receipt-specific
fields (`merchant`, `address`, `contact`, `date`, `reference`, `tip`, `payment`,
`footer`, etc.) — see the in-app format reference on that page, or
`site/shared/parse.js`.

The form editor for both document types also supports **saved tax-rate presets**
(name + percentage, stored in your browser's `localStorage`): pick one and the tax
amount auto-computes from the current subtotal instead of typing a flat amount.
There's no built-in jurisdiction/rate database — rates change and vary too much to
bake in reliably, so you define whatever rate(s) your own business actually uses.

Samples are in [samples/](samples/).

## Repo layout

```
site/          the whole app (Cloudflare Pages root; 100% static)
  index.html   invoice generator/landing page (form editor + upload)
  receipt.html receipt generator page
  r.html       viewer (invoice and receipt links both resolve here)
  shared/      codec, parser, renderer, templates, QR, PNG/print export
extension/     optional Chrome MV3 shortcut that opens the site
scripts/       selftest.mjs, make-icons.mjs
samples/       example documents used by the selftest
```

`site/shared/qrcodegen.js` is vendored from
[Nayuki's QR Code generator](https://www.nayuki.io/page/qr-code-generator-library)
(MIT — see `qrcodegen.LICENSE`). Everything else is dependency-free, no bundler,
plain ES modules.

## Development

```sh
npm install              # wrangler only (and only needed for dev/deploy)
npm run selftest         # round-trip tests, Node 18+, no deps, no network
npm run dev              # serve the site at http://localhost:8788
node scripts/selftest.mjs --print-sample-url   # a ready-to-open sample link
npm run icons            # regenerate the icons (site + extension)
```

## Deploy

```sh
npm run deploy           # wrangler pages deploy site
```

The site is 100% static — GitHub Pages or any static host works just as well. After
choosing the production host, update the URL in `extension/background.js` and the
`PAGES_BASE` in `site/shared/durable-link.js` if you use those.

Planned additions (see [ROADMAP.md](ROADMAP.md)): estimates/quotes as a third document
type inside InvoiceIguana.

## License

MIT
