import { CompactStatProps } from '@/types';
import Tooltip from './Tooltip';

const CompactStat = ({
  title,
  val,
  color,
  icon,
  tooltipText,
}: CompactStatProps) => (
  <div
    className={`${color} p-4 rounded-2xl text-white shadow-md flex flex-col items-center justify-center`}
  >
    {tooltipText ? (
      <Tooltip text={tooltipText} className="inline-flex" position="bottom">
        <p className="flex items-center gap-1 text-[9px] font-black opacity-80 mb-1 tracking-widest uppercase cursor-help underline decoration-dotted decoration-white/70">
          {icon} {title}
        </p>
      </Tooltip>
    ) : (
      <p className="flex items-center gap-1 text-[9px] font-black opacity-80 mb-1 tracking-widest uppercase">
        {icon} {title}
      </p>
    )}
    <p className="text-2xl font-black tabular-nums tracking-tighter">
      {val.toFixed(1)}%
    </p>
  </div>
);

export default CompactStat;
