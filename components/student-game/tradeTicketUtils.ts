import type { StockQuote } from './types';

export function normalizeTradeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function getSellableSymbols(positions: Record<string, number>) {
  return Object.entries(positions)
    .filter(([, shares]) => Number.isFinite(shares) && shares > 0)
    .map(([symbol]) => normalizeTradeSymbol(symbol))
    .sort((a, b) => a.localeCompare(b));
}

export function isSellSymbolAllowed(
  symbol: string,
  positions: Record<string, number>,
) {
  const normalized = normalizeTradeSymbol(symbol);
  return (positions[normalized] ?? 0) > 0;
}

export function calculateEstimatedOrderValue(
  shares: string,
  quote: StockQuote | null,
) {
  if (!quote) {
    return null;
  }

  return Number(shares || '0') * quote.latestPrice;
}

export function buildTradeSubmission(input: {
  symbol: string;
  side: 'buy' | 'sell';
  shares: string;
  quote: StockQuote;
}) {
  return {
    symbol: normalizeTradeSymbol(input.symbol),
    side: input.side,
    shares: Number(input.shares),
  };
}
