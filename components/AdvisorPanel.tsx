'use client';

import { Lightbulb } from 'lucide-react';

interface AdvisorPanelProps {
  showHints: boolean;
  advice: string;
  onToggle: () => void;
}

export default function AdvisorPanel({
  showHints,
  advice,
  onToggle,
}: AdvisorPanelProps) {
  return (
    <div className="border-t border-slate-800 pt-4 flex flex-col items-center">
      <button
        onClick={onToggle}
        className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-colors"
      >
        <Lightbulb size={12} className={showHints ? 'text-yellow-400' : ''} />
        Advisor Advice
      </button>
      {showHints ? (
        <div className="mt-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center">
          <p className="text-[11px] text-blue-200 font-bold leading-snug">
            {advice}
          </p>
        </div>
      ) : null}
    </div>
  );
}
