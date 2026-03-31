import type { ReactNode } from 'react';

interface YearSummaryProps {
  currentYear: number;
  quarterCount: number;
  summary: string;
  startInflation?: number;
  startUnemployment?: number;
}

export default function YearSummary({
  currentYear,
  quarterCount,
  summary,
  startInflation,
  startUnemployment,
}: YearSummaryProps) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-4 mb-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        Year summary
      </p>
      <p className="mt-2 min-w-0 text-sm leading-7 text-slate-700 break-words">
        {summary}
      </p>
      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Year" value={String(currentYear)} />
        <SummaryCard label="Quarters" value={`${quarterCount}/4`} />
        <SummaryCard
          label="Inflation"
          value={
            startInflation !== undefined ? `${startInflation.toFixed(2)}%` : '—'
          }
        />
        <SummaryCard
          label="Jobs"
          value={
            startUnemployment !== undefined
              ? `${startUnemployment.toFixed(2)}%`
              : '—'
          }
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-3xl bg-slate-50 p-3 text-xs uppercase tracking-[0.2em] text-slate-600">
      <span className="block whitespace-nowrap font-black text-slate-900">
        {label}
      </span>
      <span className="min-w-0 break-words block mt-1 text-sm text-slate-800">
        {value}
      </span>
    </div>
  );
}
