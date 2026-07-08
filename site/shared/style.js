/**
 * Document-agnostic style application — template class, accent color, logo
 * image/emoji priority, and branding visibility. None of this was ever
 * receipt-specific; it just used to close over receipt's own TEMPLATES
 * import. Takes the template registry as a parameter so any document type
 * (receipt, invoice, ...) can reuse it with its own registry.
 */
export function applyDocumentStyle(root, doc, templates) {
  const tpl = templates[doc.template] || templates.classic;
  for (const t of Object.values(templates)) {
    if (t.className) root.classList.remove(t.className);
  }
  if (tpl.className) root.classList.add(tpl.className);

  if (doc.accent) root.style.setProperty('--accent', `#${doc.accent}`);
  else root.style.removeProperty('--accent');

  // An image logo (if set) takes priority over the emoji one.
  const logoImg = root.querySelector('[data-f="logoImg"]');
  if (logoImg) {
    logoImg.hidden = !doc.logoUrl;
    if (doc.logoUrl) {
      logoImg.src = doc.logoUrl;
      logoImg.alt = `${doc.merchant ?? doc.seller?.name ?? ''} logo`;
      logoImg.referrerPolicy = 'no-referrer';
    }
  }
  const logo = root.querySelector('[data-f="logo"]');
  if (logo) {
    logo.hidden = doc.emoji == null || !!doc.logoUrl;
    if (doc.emoji != null) logo.textContent = doc.emoji;
  }

  const brand = root.querySelector('.brand');
  if (brand) brand.hidden = !!doc.brandingOff;
}
