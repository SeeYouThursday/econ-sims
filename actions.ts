import type { FedStartResponse, StockHistoryPoint } from './types';

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

const DEFAULT_FED_START: FedStartResponse = {
  inflation: 2.0,
  unemployment: 5.0,
  interestRate: 4.0,
  source: 'fallback',
  asOf: 'N/A',
};

export async function fetchFedStartData(): Promise<FedStartResponse> {
  try {
    const response = await fetch('/api/fed-start');
    const payload = await response.json().catch(() => null);

    if (
      !response.ok ||
      !payload ||
      typeof payload.inflation !== 'number' ||
      typeof payload.unemployment !== 'number' ||
      typeof payload.interestRate !== 'number'
    ) {
      return DEFAULT_FED_START;
    }

    return payload as FedStartResponse;
  } catch {
    return DEFAULT_FED_START;
  }
}
