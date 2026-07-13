/**
 * Invoice template registry — the single source for the generator's template
 * picker, the renderer's class mapping, and (like receipt's) any CSS sanity
 * check. Template ids ride in the link (compact key `w`); ids absent from
 * this registry render as classic, so old links and newer generators stay
 * forward compatible.
 *
 * Each className is layered over the base .invoice styles in
 * shared/invoice.css the same way receipt's templates layer over receipt.css.
 */
export const TEMPLATES = {
  classic: { label: 'Classic', className: '' },
  modern: { label: 'Modern', className: 't-modern' },
  minimal: { label: 'Minimal', className: 't-minimal' },
  bold: { label: 'Bold', className: 't-bold' },
};
