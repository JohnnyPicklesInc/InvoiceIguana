/**
 * Common ISO 4217 currencies for the generator's currency picker, in rough
 * order of how often a small business is likely to reach for them.
 *
 * This is a friendly default menu, NOT a hard allow-list: the codec accepts any
 * 3-letter code (currencyExponent in wire.js falls back to 2 decimals for ones
 * it doesn't specially know), so the generator injects an invoice's own
 * currency as an extra option if it isn't listed here — e.g. one that arrived
 * from an uploaded file or an older edit link — rather than silently dropping
 * it. Zero-decimal currencies like JPY/KRW are handled by the codec regardless
 * of their position here.
 */
export const CURRENCIES = [
  ['USD', 'US Dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['JPY', 'Japanese Yen'],
  ['CAD', 'Canadian Dollar'],
  ['AUD', 'Australian Dollar'],
  ['CHF', 'Swiss Franc'],
  ['CNY', 'Chinese Yuan'],
  ['INR', 'Indian Rupee'],
  ['MXN', 'Mexican Peso'],
  ['BRL', 'Brazilian Real'],
  ['ZAR', 'South African Rand'],
  ['SEK', 'Swedish Krona'],
  ['NOK', 'Norwegian Krone'],
  ['DKK', 'Danish Krone'],
  ['PLN', 'Polish Złoty'],
  ['NZD', 'New Zealand Dollar'],
  ['SGD', 'Singapore Dollar'],
  ['HKD', 'Hong Kong Dollar'],
  ['AED', 'UAE Dirham'],
  ['SAR', 'Saudi Riyal'],
  ['ILS', 'Israeli New Shekel'],
  ['KRW', 'South Korean Won'],
  ['TRY', 'Turkish Lira'],
  ['THB', 'Thai Baht'],
  ['PHP', 'Philippine Peso'],
  ['IDR', 'Indonesian Rupiah'],
  ['MYR', 'Malaysian Ringgit'],
];
