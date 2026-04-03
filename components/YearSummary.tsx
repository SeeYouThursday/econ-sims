import type { ReactNode } from 'react';
import type { YearSummaryProps } from '@/types';
import Tooltip from './Tooltip';

const INFLATION_TOOLTIP =
  'When prices for everyday things go up over time. The Fed target is 2%.';
const UNEMPLOYMENT_TOOLTIP =
  "The share of people who want a job but can't find one. The Fed target is about 5%.";

function withTermTooltips(text: string): ReactNode {
  const parts = text.split(/\b(inflation|unemployment)\b/gi);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    if (lower === 'inflation') {
      return (
        <Tooltip
          key={`term-${index}`}
          text={INFLATION_TOOLTIP}
          position="bottom"
        >
          <span className="cursor-help underline decoration-dotted decoration-red-300">
            {part}
          </span>
        </Tooltip>
      );
    }
    if (lower === 'unemployment') {
      return (
        <Tooltip
          key={`term-${index}`}
          text={UNEMPLOYMENT_TOOLTIP}
          position="bottom"
        >
          <span className="cursor-help underline decoration-dotted decoration-blue-300">
            {part}
          </span>
        </Tooltip>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
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
        {withTermTooltips(summary)}
      </p>
      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Year" value={String(currentYear)} />
        <SummaryCard label="Quarters" value={`${quarterCount}/4`} />
        <SummaryCard
          label={
            <Tooltip text={INFLATION_TOOLTIP} position="bottom">
              <span className="cursor-help underline decoration-dotted decoration-red-300">
                Inflation
              </span>
            </Tooltip>
          }
          value={
            startInflation !== undefined ? `${startInflation.toFixed(2)}%` : '—'
          }
        />
        <SummaryCard
          label={
            <Tooltip text={UNEMPLOYMENT_TOOLTIP} position="bottom">
              <span className="cursor-help underline decoration-dotted decoration-blue-300">
                Unemployment
              </span>
            </Tooltip>
          }
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

function SummaryCard({ label, value }: { label: ReactNode; value: ReactNode }) {
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
