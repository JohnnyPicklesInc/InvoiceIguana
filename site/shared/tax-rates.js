/**
 * User-managed tax-rate presets, stored in localStorage on this device.
 * Deliberately NOT a hardcoded jurisdiction/rate database — real tax rates
 * change over time and vary by locality in ways we can't track reliably;
 * the user defines whatever rate(s) their own business actually uses.
 */
const KEY = 'receiptrat.taxRates';

export function loadRates() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.rate))
      : [];
  } catch {
    return [];
  }
}

export function saveRate(name, rate) {
  const rates = loadRates();
  rates.push({ name, rate });
  localStorage.setItem(KEY, JSON.stringify(rates));
  return rates;
}

export function removeRate(index) {
  const rates = loadRates();
  rates.splice(index, 1);
  localStorage.setItem(KEY, JSON.stringify(rates));
  return rates;
}
