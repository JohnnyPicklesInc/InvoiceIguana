/**
 * Receipt template registry — the single source for the generator's template
 * picker, the renderer's class mapping, and the selftest's CSS sanity check.
 * Template ids ride in the link (compact key `w`); ids absent from this
 * registry render as classic (forward compatibility with newer generators).
 */
export const TEMPLATES = {
  classic: { label: 'Classic thermal', className: '' },
  inv: { label: 'Modern invoice', className: 't-inv' },
  min: { label: 'Minimal', className: 't-min' },
  ele: { label: 'Elegant', className: 't-ele' },
};
