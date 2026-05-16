import { useCallback, useEffect, useState, useMemo } from 'react';
import { fetchTickerNames, fetchTradeQuote } from './api';
import type { StockQuote } from './types';
import { formatCents } from '@/lib/formatCents';
import { RefreshCw } from 'lucide-react';
import {
  buildTradeSubmission,
  calculateEstimatedOrderValue,
  getSellableSymbols,
  isSellSymbolAllowed,
  normalizeTradeSymbol,
} from './tradeTicketUtils';

const DEFAULT_SYMBOL = 'AAPL';

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc. (Facebook)' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC', name: 'Bank of America' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'MCD', name: "McDonald's Corporation" },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'IBM', name: 'IBM Corporation' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'HD', name: 'The Home Depot Inc.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Incorporated' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'SAP', name: 'SAP SE' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'GE', name: 'General Electric Company' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'CAT', name: 'Caterpillar Inc.' },
  { symbol: 'AXP', name: 'American Express Company' },
  { symbol: 'MMM', name: '3M Company' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
  { symbol: 'CVS', name: 'CVS Health Corporation' },
  { symbol: 'WBA', name: 'Walgreens Boots Alliance Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  { symbol: 'VZ', name: 'Verizon Communications Inc.' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.' },
  { symbol: 'TXN', name: 'Texas Instruments Incorporated' },
  { symbol: 'NOW', name: 'ServiceNow Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.' },
  { symbol: 'SQ', name: 'Block Inc. (Square)' },
  { symbol: 'SNPS', name: 'Synopsys Inc.' },
  { symbol: 'INTU', name: 'Intuit Inc.' },
];

const STOCK_NAME_MAP = Object.fromEntries(
  POPULAR_STOCKS.map((stock) => [stock.symbol, stock.name]),
);

function fallbackTickerName(symbol: string) {
  return `Ticker ${symbol}`;
}

type TradeTicketProps = {
  onSubmit: (input: {
    symbol: string;
    side: 'buy' | 'sell';
    shares: number;
  }) => Promise<void>;
  submitting: boolean;
  tradingDisabled?: boolean;
  disabledReason?: string;
  availableCash?: number;
  lastFillMessage?: string | null;
  positions?: Record<string, number>;
};

export default function TradeTicket({
  onSubmit,
  submitting,
  tradingDisabled = false,
  disabledReason,
  availableCash = 0,
  lastFillMessage = null,
  positions = {},
}: TradeTicketProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('1');
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [showStockGuide, setShowStockGuide] = useState(false);
  const [tickerNamesBySymbol, setTickerNamesBySymbol] =
    useState<Record<string, string>>(STOCK_NAME_MAP);

  const normalizedSymbol = normalizeTradeSymbol(symbol);
  const sellableSymbols = useMemo(
    () => getSellableSymbols(positions),
    [positions],
  );
  const hasSellableSymbols = sellableSymbols.length > 0;
  const isStrictSellSelectionInvalid =
    side === 'sell' && !isSellSymbolAllowed(normalizedSymbol, positions);

  const loadQuote = useCallback(async (nextSymbol: string) => {
    if (!nextSymbol) {
      setQuote(null);
      setQuoteError('Enter a stock symbol to load a price.');
      return null;
    }

    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const nextQuote = await fetchTradeQuote(nextSymbol);
      setQuote(nextQuote);
      return nextQuote;
    } catch (error) {
      setQuote(null);
      setQuoteError(
        error instanceof Error ? error.message : 'Unable to load stock quote.',
      );
      return null;
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    void loadQuote(DEFAULT_SYMBOL);
  }, [loadQuote]);

  useEffect(() => {
    if (side !== 'sell') {
      return;
    }

    if (!hasSellableSymbols) {
      setSymbol('');
      return;
    }

    if (!isSellSymbolAllowed(normalizedSymbol, positions)) {
      setSymbol(sellableSymbols[0] ?? '');
    }
  }, [hasSellableSymbols, normalizedSymbol, positions, sellableSymbols, side]);

  const shouldFetchTickerNames = side === 'sell' && hasSellableSymbols;

  useEffect(() => {
    if (!shouldFetchTickerNames) {
      return;
    }

    let isActive = true;
    void fetchTickerNames(sellableSymbols)
      .then((names) => {
        if (!isActive) {
          return;
        }

        setTickerNamesBySymbol((previous) => ({
          ...previous,
          ...names,
        }));
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch ticker names.', error);
      });

    return () => {
      isActive = false;
    };
  }, [shouldFetchTickerNames, sellableSymbols]);

  const placeTrade = async () => {
    if (tradingDisabled) {
      return;
    }

    const activeQuote =
      quote && quote.symbol === normalizedSymbol
        ? quote
        : await loadQuote(normalizedSymbol);

    if (!activeQuote) {
      return;
    }

    await onSubmit(
      buildTradeSubmission({
        symbol: normalizedSymbol,
        side,
        shares,
        quote: activeQuote,
      }),
    );
  };

  const estimatedValue = calculateEstimatedOrderValue(shares, quote);
  const insufficientCash =
    side === 'buy' &&
    estimatedValue !== null &&
    Number.isFinite(estimatedValue) &&
    estimatedValue > availableCash;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Buy or Sell Stocks
      </p>
      <p className="mt-2 text-xs text-slate-600">
        You&apos;re buying or selling pretend shares with classroom money.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">Symbol</label>
          {side === 'sell' ? (
            <select
              title="Trade symbol"
              aria-label="Trade symbol"
              disabled={tradingDisabled || !hasSellableSymbols}
              value={symbol}
              onChange={(event) => {
                const newSymbol = event.target.value;
                setSymbol(newSymbol);
                setQuoteError(null);
                void loadQuote(newSymbol);
              }}
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
            >
              {!hasSellableSymbols ? (
                <option value="">No stocks available to sell</option>
              ) : (
                <option value="">Select a stock to sell...</option>
              )}
              {sellableSymbols.map((sym) => {
                const shares = positions[sym] ?? 0;
                const companyName =
                  tickerNamesBySymbol[sym] ?? fallbackTickerName(sym);
                return (
                  <option key={sym} value={sym}>
                    {`${sym} - ${companyName}`} ({shares} shares)
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              title="Trade symbol"
              aria-label="Trade symbol"
              disabled={tradingDisabled}
              value={symbol}
              onBlur={() => {
                void loadQuote(symbol.trim().toUpperCase());
              }}
              onChange={(event) => {
                setSymbol(event.target.value);
                setQuoteError(null);
              }}
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">
            Buy or Sell
          </label>
          <select
            title="Trade side"
            aria-label="Trade side"
            disabled={tradingDisabled}
            value={side}
            onChange={(event) => setSide(event.target.value as 'buy' | 'sell')}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Shares</label>
          <input
            title="Trade shares"
            aria-label="Trade shares"
            type="number"
            min={1}
            step={1}
            disabled={tradingDisabled}
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-600">
                Latest price
              </label>
              <div className="mt-1 truncate rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                {quote ? formatCents(quote.latestPrice) : '—'}
              </div>
            </div>
            <button
              type="button"
              title="Refresh latest price"
              aria-label="Refresh latest price"
              onClick={() => {
                void loadQuote(normalizedSymbol);
              }}
              disabled={tradingDisabled || loadingQuote}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loadingQuote ? 'animate-spin' : undefined}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Price checked at</span>
          <span className="font-semibold text-slate-900">
            {quote?.asOf ?? '—'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span>Cost of trade</span>
          <span className="font-semibold text-slate-900">
            {estimatedValue !== null && Number.isFinite(estimatedValue)
              ? formatCents(estimatedValue)
              : '—'}
          </span>
        </div>
      </div>

      {lastFillMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {lastFillMessage}
        </div>
      ) : null}

      {quoteError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {quoteError}
        </div>
      ) : null}

      {tradingDisabled && disabledReason ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {disabledReason}
        </div>
      ) : null}

      {insufficientCash ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Insufficient cash. You have {formatCents(availableCash)}, but this
          order costs {formatCents(estimatedValue ?? 0)}.
        </div>
      ) : null}

      <button
        type="button"
        onClick={placeTrade}
        disabled={
          tradingDisabled ||
          submitting ||
          loadingQuote ||
          !normalizedSymbol ||
          insufficientCash ||
          isStrictSellSelectionInvalid
        }
        className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {submitting
          ? 'Placing…'
          : side === 'sell' && !hasSellableSymbols
            ? 'No stocks to sell'
            : 'Submit trade'}
      </button>

      <button
        type="button"
        onClick={() => setShowStockGuide(!showStockGuide)}
        className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        {showStockGuide ? '✓ Hide' : '+ Browse'} Popular Stocks
      </button>

      {showStockGuide ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-3">
            Click a stock to load its current price:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => {
                  setSymbol(stock.symbol);
                  void loadQuote(stock.symbol);
                }}
                className="text-left rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs hover:border-slate-400 hover:bg-white transition-colors"
              >
                <div className="font-semibold text-slate-900">
                  {stock.symbol}
                </div>
                <div className="text-slate-600 text-xs truncate">
                  {stock.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
