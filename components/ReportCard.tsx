import React from 'react';
import {
  RefreshCcw,
  Award,
  AlertTriangle,
  TrendingUp,
  Users,
} from 'lucide-react';
import { GradeResult, ReportCardProps } from '@/types';
import Tooltip from './Tooltip';

const INFLATION_TOOLTIP =
  'When prices for everyday things go up over time. The Fed target is 2%.';
const UNEMPLOYMENT_TOOLTIP =
  "The share of people who want a job but can't find one. The Fed target is about 5%.";

const ReportCard: React.FC<ReportCardProps> = ({ history, onRestart }) => {
  const avgInf =
    history.reduce((acc, curr) => acc + curr.inf, 0) / history.length;
  const avgUnp =
    history.reduce((acc, curr) => acc + curr.unp, 0) / history.length;

  const totalError = Math.abs(avgInf - 2.0) + Math.abs(avgUnp - 5.0);

  const getGrade = (error: number): GradeResult => {
    // Stricter grading curve: students must stay much closer to both targets
    if (error < 0.7)
      return {
        letter: 'A',
        title: 'Economic Legend',
        color: 'text-green-600',
        bg: 'bg-green-50',
        icon: <Award size={48} />,
        text: "Perfect balance! You've been reappointed.",
      };
    if (error < 1.6)
      return {
        letter: 'B',
        title: 'Steady Hand',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        icon: <TrendingUp size={48} />,
        text: 'Good job keeping the economy on track.',
      };
    if (error < 2.8)
      return {
        letter: 'C',
        title: 'The Survivor',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        icon: <Users size={48} />,
        text: 'You made it through, but it was a bumpy ride.',
      };
    return {
      letter: 'F',
      title: 'Term Expired',
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: <AlertTriangle size={48} />,
      text: 'The economy was too volatile for the public.',
    };
  };

  const grade = getGrade(totalError);

  return (
    <div className="inset-0 bg-white/98 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
      <div className={`p-4 rounded-full ${grade.bg} ${grade.color} mb-4`}>
        {grade.icon}
      </div>
      <h1 className={`text-9xl font-black ${grade.color} mb-2`}>
        {grade.letter}
      </h1>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">{grade.title}</h2>
      <p className="text-gray-600 mb-6 max-w-md">{grade.text}</p>

      <div className="flex gap-6 my-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
        <div className="text-center">
          <Tooltip text={INFLATION_TOOLTIP}>
            <span className="text-xs font-bold text-gray-500 uppercase mb-1 cursor-help underline decoration-dotted decoration-red-300">
              Avg Inflation
            </span>
          </Tooltip>
          <p className="text-2xl font-black text-red-600">
            {avgInf.toFixed(1)}%
          </p>
        </div>
        <div className="w-px bg-gray-300 h-12 self-center"></div>
        <div className="text-center">
          <Tooltip text={UNEMPLOYMENT_TOOLTIP}>
            <span className="text-xs font-bold text-gray-500 uppercase mb-1 cursor-help underline decoration-dotted decoration-blue-300">
              Avg Unemployment
            </span>
          </Tooltip>
          <p className="text-2xl font-black text-blue-600">
            {avgUnp.toFixed(1)}%
          </p>
        </div>
      </div>

      <button
        type="reset"
        onClick={onRestart}
        className="flex items-center gap-2 bg-slate-900 text-white px-10 py-4 rounded-full font-bold hover:bg-black transition shadow-xl"
      >
        <RefreshCcw size={20} /> Try Again
      </button>
    </div>
  );
};

export default ReportCard;
