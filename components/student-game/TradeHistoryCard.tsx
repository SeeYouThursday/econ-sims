import { StudentTradeHistoryResponse } from './types';

export default function TradeHistoryCard({
  history,
}: {
  history: StudentTradeHistoryResponse;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
          Recent trades
        </p>
        <p className="text-xs text-slate-500">
          As of {new Date(history.asOf).toLocaleString()}
        </p>
      </div>

      {history.trades.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No trades yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2 pr-3 font-semibold">Time</th>
                <th className="py-2 pr-3 font-semibold">Symbol</th>
                <th className="py-2 pr-3 font-semibold">Side</th>
                <th className="py-2 pr-3 font-semibold">Shares</th>
                <th className="py-2 pr-3 font-semibold">Price</th>
                <th className="py-2 pr-3 font-semibold">Quote date</th>
              </tr>
            </thead>
            <tbody>
              {history.trades.map((trade) => (
                <tr key={trade.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-600">
                    {new Date(trade.executedAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">
                    {trade.symbol}
                  </td>
                  <td
                    className={`py-2 pr-3 font-semibold ${
                      trade.side === 'buy'
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{trade.shares}</td>
                  <td className="py-2 pr-3 text-slate-700">
                    ${trade.price.toFixed(2)}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {trade.quoteAsOf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
