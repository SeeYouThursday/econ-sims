import { useState } from 'react';

const DEFAULT_SYMBOL = 'AAPL';

type TradeTicketProps = {
  onSubmit: (input: {
    symbol: string;
    side: 'buy' | 'sell';
    shares: number;
    price: number;
  }) => Promise<void>;
  submitting: boolean;
};

export default function TradeTicket({
  onSubmit,
  submitting,
}: TradeTicketProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('1');
  const [price, setPrice] = useState('100');

  const placeTrade = async () => {
    await onSubmit({
      symbol: symbol.trim().toUpperCase(),
      side,
      shares: Number(shares),
      price: Number(price),
    });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Place trade
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">Symbol</label>
          <input
            title="Trade symbol"
            aria-label="Trade symbol"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Side</label>
          <select
            title="Trade side"
            aria-label="Trade side"
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
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Price</label>
          <input
            title="Trade price"
            aria-label="Trade price"
            type="number"
            min={0.01}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={placeTrade}
        disabled={submitting}
        className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {submitting ? 'Placing…' : 'Submit trade'}
      </button>
    </div>
  );
}
