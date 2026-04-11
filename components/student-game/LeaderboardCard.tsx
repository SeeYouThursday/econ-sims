import { LeaderboardResponse } from './types';

export default function LeaderboardCard({
  leaderboard,
}: {
  leaderboard: LeaderboardResponse;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Class Rankings
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Updated {new Date(leaderboard.asOf).toLocaleString()}
      </p>

      {leaderboard.entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Waiting for students to join…
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {leaderboard.entries.map((entry) => (
            <div
              key={`${entry.rank}-${entry.username}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Rank {entry.rank}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {entry.username}
                </p>
              </div>
              <p className="text-sm font-black text-slate-900">
                ${entry.totalValue.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
