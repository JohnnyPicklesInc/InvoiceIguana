/**
 * Invoice template registry — the single source for the generator's template
 * picker, the renderer's class mapping, and (like receipt's) any CSS sanity
 * check. Template ids ride in the link (compact key `w`); ids absent from
 * this registry render as classic, so old links and newer generators stay
 * forward compatible.
 *
 * Each className is layered over the base .invoice styles in
 * shared/invoice.css the same way receipt's templates layer over receipt.css.
 * `custom` is special: it renders a neutral base and lets the generator's
 * custom-formatting panel drive the composable knob classes (font, totals,
 * table, density, header) — see applyInvoiceLayout in invoice-render.js.
 */
export const TEMPLATES = {
  classic: { label: 'Classic', className: '' },
  modern: { label: 'Modern', className: 't-modern' },
  minimal: { label: 'Minimal', className: 't-minimal' },
  bold: { label: 'Bold', className: 't-bold' },
  corp: { label: 'Corporate', className: 't-corp' },
  compact: { label: 'Compact', className: 't-compact' },
  creative: { label: 'Creative', className: 't-creative' },
  custom: { label: 'Custom…', className: 't-custom' },
};
