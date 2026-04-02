import type { ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}

export default function Tooltip({
  text,
  children,
  className = 'inline-flex',
  position = 'top',
}: TooltipProps) {
  const bubblePositionClass =
    position === 'bottom'
      ? 'top-full left-1/2 mt-2 -translate-x-1/2'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2';

  const caretClass =
    position === 'bottom'
      ? 'absolute left-1/2 bottom-full -translate-x-1/2 border-[5px] border-transparent border-b-slate-900'
      : 'absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-slate-900';

  return (
    <span className={`relative group/tip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-70 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs leading-snug text-white whitespace-normal wrap-break-word opacity-0 shadow-2xl transition-opacity group-hover/tip:opacity-100 ${bubblePositionClass}`}
      >
        {text}
        <span className={caretClass} />
      </span>
    </span>
  );
}
