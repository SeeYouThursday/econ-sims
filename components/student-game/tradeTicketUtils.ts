import type { StockQuote } from './types';

export function normalizeTradeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
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
