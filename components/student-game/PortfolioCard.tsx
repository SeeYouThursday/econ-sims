import { PortfolioSnapshot } from './types';

export default function PortfolioCard({
  portfolio,
}: {
  portfolio: PortfolioSnapshot;
}) {
  const positionEntries = Object.entries(portfolio.positions);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Portfolio
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Cash</p>
          <p className="text-lg font-black text-slate-900">
            ${portfolio.cash.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Holdings</p>
          <p className="text-lg font-black text-slate-900">
            ${portfolio.holdingsValue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total value</p>
          <p className="text-lg font-black text-slate-900">
            ${portfolio.totalValue.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Open positions
        </p>
        {positionEntries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No open positions yet.</p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            {positionEntries.map(([symbol, shares]) => (
              <p key={symbol}>
                {symbol}: <span className="font-semibold">{shares}</span> shares
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
