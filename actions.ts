import type { StockHistoryPoint } from './types';

export interface StockApiResponse {
  symbol: string;
  days: number;
  from: string;
  to: string;
  candles: StockHistoryPoint[];
}

export async function fetchStockData(
  symbol: string,
  days = 30,
): Promise<StockApiResponse> {
  const requestedSymbol = symbol.trim().toUpperCase();
  const response = await fetch(
    `/api/stock?symbol=${encodeURIComponent(requestedSymbol)}&days=${days}`,
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Unable to load stock prices.');
  }

  return payload as StockApiResponse;
}
