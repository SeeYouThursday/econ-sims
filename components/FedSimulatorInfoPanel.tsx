'use client';

import { useState } from 'react';
import Tooltip from './Tooltip';

const INFLATION_TOOLTIP =
  'When prices for everyday things go up over time. The Fed target is 2%.';
const UNEMPLOYMENT_TOOLTIP =
  "The share of people who want a job but can't find one. The Fed target is about 5%.";

export default function FedSimulatorInfoPanel() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Floating Help button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="How to play"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          <span className="text-xl font-black leading-none">?</span>
        </button>
      </div>

      {/* Instructions modal — auto-opens on first load */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fed-instructions-title"
        >
          <div className="w-full max-w-2xl rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Quick Start
                </p>
                <h2
                  id="fed-instructions-title"
                  className="mt-2 text-2xl font-black tracking-tight text-slate-900"
                >
                  How To Play The Fed Game
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
              <Tooltip text={INFLATION_TOOLTIP}>
                <span className="cursor-help underline decoration-dotted decoration-red-300">
                  Target Inflation: 2.0%
                </span>
              </Tooltip>
              <span className="text-slate-300">|</span>
              <Tooltip text={UNEMPLOYMENT_TOOLTIP}>
                <span className="cursor-help underline decoration-dotted decoration-blue-300">
                  Target Unemployment: 5.0%
                </span>
              </Tooltip>
            </div>

            <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-7 text-slate-700">
              <li>
                Check{' '}
                <Tooltip text={INFLATION_TOOLTIP}>
                  <span className="cursor-help underline decoration-dotted decoration-red-300">
                    inflation
                  </span>
                </Tooltip>{' '}
                and{' '}
                <Tooltip text={UNEMPLOYMENT_TOOLTIP}>
                  <span className="cursor-help underline decoration-dotted decoration-blue-300">
                    unemployment
                  </span>
                </Tooltip>{' '}
                in the control panel.
              </li>
              <li>Set the interest rate with the slider for this quarter.</li>
              <li>
                Click <span className="font-black">Next Quarter</span> to run
                the simulation.
              </li>
              <li>Use the chart and year summary to track policy impact.</li>
              <li>
                Aim to keep{' '}
                <Tooltip text={INFLATION_TOOLTIP}>
                  <span className="cursor-help underline decoration-dotted decoration-red-300">
                    inflation
                  </span>
                </Tooltip>{' '}
                near 2.0% and{' '}
                <Tooltip text={UNEMPLOYMENT_TOOLTIP}>
                  <span className="cursor-help underline decoration-dotted decoration-blue-300">
                    unemployment
                  </span>
                </Tooltip>{' '}
                near 5.0% by year 4.
              </li>
            </ol>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Key Terms
              </p>
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-snug text-slate-700">
                <div>
                  <p className="font-black text-red-600">Inflation</p>
                  <p className="mt-0.5">
                    When prices for everyday things — like food and gas — go up
                    over time. A little is normal and healthy. The Fed targets
                    2%.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="font-black text-blue-600">Unemployment</p>
                  <p className="mt-0.5">
                    The share of people who want a job but can&apos;t find one.
                    Some is always normal — the Fed targets around 5%.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="font-black text-slate-900">Interest Rate</p>
                  <p className="mt-0.5">
                    The cost of borrowing money. Raising rates makes loans
                    expensive so people spend less and prices cool down.
                    Lowering rates encourages spending and hiring.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800"
              >
                Start simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
