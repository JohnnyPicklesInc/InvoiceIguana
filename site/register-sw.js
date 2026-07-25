/* Registers the service worker (site/sw.js). Loaded as a module on every page
 * so it satisfies the strict CSP (script-src 'self') without an inline script.
 * Failures are swallowed — the app works fine without the SW, just not offline. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
