/**
 * Money formatting helpers for the stock-game UI.
 *
 * All monetary values crossing the /api/stock-game/* API boundary are integer
 * cents (AGENTS.md §3). UI code converts to dollars at the display boundary
 * using these helpers — there should be no inline `value / 100` or `$${...}`
 * concatenation in components.
 */

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_WHOLE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function centsToDollars(cents: number): number {
  return cents / 100;
}

/** "$1,234.56" — for cash, holdings, totals, per-share prices, etc. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return USD_FORMATTER.format(centsToDollars(cents));
}

/** "+$12.34" / "-$12.34" — for signed P/L values. */
export function formatSignedCents(cents: number): string {
  if (!Number.isFinite(cents)) return '+$0.00';
  const sign = cents >= 0 ? '+' : '-';
  return `${sign}${USD_FORMATTER.format(Math.abs(centsToDollars(cents)))}`;
}

/** "$1,234" — for Recharts axis ticks where a whole-dollar label is plenty. */
export function formatCentsWhole(cents: number): string {
  if (!Number.isFinite(cents)) return '$0';
  return USD_WHOLE_FORMATTER.format(centsToDollars(cents));
}

/** Round a dollar amount (possibly fractional) to integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
