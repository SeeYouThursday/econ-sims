import { formatCents, formatSignedCents } from '@/lib/formatCents';
import { PortfolioSnapshot } from './types';

export default function PortfolioCard({
  portfolio,
}: {
  portfolio: PortfolioSnapshot;
}) {
  const positionEntries = Object.entries(portfolio.positions);
  const pnlIsPositive = portfolio.pnlValue >= 0;
  const pnlToneClass = pnlIsPositive ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        My Money
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Cash Left</p>
          <p className="text-lg font-black text-slate-900">
            {formatCents(portfolio.cash)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Stocks I Own</p>
          <p className="text-lg font-black text-slate-900">
            {formatCents(portfolio.holdingsValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-black text-slate-900">
            {formatCents(portfolio.totalValue)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Up or Down</p>
        <p className={`text-lg font-black ${pnlToneClass}`}>
          {formatSignedCents(portfolio.pnlValue)} (
          {pnlIsPositive ? '+' : ''}
          {portfolio.pnlPercent.toFixed(2)}%)
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Current stocks
        </p>
        {positionEntries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t bought any stocks yet.
          </p>
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
