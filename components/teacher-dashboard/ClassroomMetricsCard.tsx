import type {
  ClassroomAudit,
  ClassroomStudent,
} from '@/components/teacher-dashboard/types';

type ClassroomMetricsCardProps = {
  selectedStartingCash: string;
  selectedClassroomStudents: ClassroomStudent[];
  selectedClassroomAudit?: ClassroomAudit;
  loadingMetrics: boolean;
  updatingClassroomSettings: boolean;
  studentActionKey: string | null;
  onSelectedStartingCashChange: (value: string) => void;
  onSaveStartingCash: () => void;
  onRefreshMetrics: () => void;
  onResetAll: () => void;
  onRestartGame: () => void;
};

export function ClassroomMetricsCard({
  selectedStartingCash,
  selectedClassroomStudents,
  selectedClassroomAudit,
  loadingMetrics,
  updatingClassroomSettings,
  studentActionKey,
  onSelectedStartingCashChange,
  onSaveStartingCash,
  onRefreshMetrics,
  onResetAll,
  onRestartGame,
}: ClassroomMetricsCardProps) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          Classroom metrics
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={100}
            max={1000000}
            step={100}
            value={selectedStartingCash}
            onChange={(event) =>
              onSelectedStartingCashChange(event.target.value)
            }
            placeholder="10000"
            title="Starting cash for the selected classroom"
            className="w-28 rounded-xl border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-900 outline-none transition focus:border-slate-500"
            aria-label="Selected classroom starting cash"
          />
          <button
            type="button"
            onClick={onSaveStartingCash}
            disabled={updatingClassroomSettings}
            className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updatingClassroomSettings ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onRefreshMetrics}
            disabled={loadingMetrics}
            className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMetrics ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={onResetAll}
            disabled={
              studentActionKey !== null ||
              selectedClassroomStudents.length === 0
            }
            className="rounded-full border border-rose-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-rose-700 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={onRestartGame}
            disabled={
              studentActionKey !== null ||
              selectedClassroomStudents.length === 0
            }
            className="rounded-full border border-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-amber-700 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Restart game
          </button>
        </div>
      </div>

      {loadingMetrics && !selectedClassroomAudit ? (
        <p className="mt-3 text-xs text-slate-600">Loading…</p>
      ) : selectedClassroomAudit ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 text-[10px] sm:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Students</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.studentCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Active</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.activeSessionCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Trades</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.tradeCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Buys</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.buyCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Sells</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.sellCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Top symbols</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {selectedClassroomAudit.topSymbols.length}
              </p>
            </div>
          </div>
          {selectedClassroomAudit.topSymbols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedClassroomAudit.topSymbols.slice(0, 5).map((entry) => (
                <span
                  key={`${entry.symbol}:${entry.trades}`}
                  className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-700"
                >
                  {entry.symbol}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-600">Metrics unavailable.</p>
      )}
    </div>
  );
}
