'use client';

import { useEffect, useState } from 'react';
import FedGame from '@/components/RevFedGame';
import Link from 'next/link';

const FedGamePage = () => {
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('student');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setShowDetails(viewMode === 'teacher');
  }, [viewMode]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2.5rem] bg-white p-6 shadow-2xl border border-slate-200 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-500">
                Fed Chair Simulation
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {viewMode === 'student'
                  ? 'Student mode: jump straight into the game'
                  : 'Teach macro policy with an interactive Fed game.'}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                {viewMode === 'student'
                  ? 'The student view hides extra instructional text so learners can focus on gameplay. Toggle to teacher mode for lesson guidance and classroom context.'
                  : 'Lead the economy through inflation, unemployment, and interest rate decisions. This page is built for classroom use, with a clear interface that helps students learn how policy choices affect real-world outcomes.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setViewMode((current) =>
                    current === 'student' ? 'teacher' : 'student',
                  )
                }
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
              >
                {viewMode === 'student'
                  ? 'Show teacher notes'
                  : 'Show student view'}
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
              >
                Back to home
              </Link>
              <Link
                href="/stock"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800"
              >
                Try stock lesson
              </Link>
            </div>
          </div>

          {viewMode === 'student' ? (
            <div className="mt-8 rounded-4xl border border-slate-200 bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDetails((current) => !current)}
                aria-expanded={showDetails}
                aria-controls="student-guidance-panel"
                className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-black uppercase tracking-[0.18em] text-slate-700 bg-white hover:bg-slate-50"
              >
                <span>
                  {showDetails
                    ? 'Hide student guidance'
                    : 'Show student guidance'}
                </span>
                <span className="text-slate-400">
                  {showDetails ? '−' : '+'}
                </span>
              </button>
              <div
                id="student-guidance-panel"
                role="region"
                aria-label="Student guidance"
                className={`transition-all duration-300 ${
                  showDetails
                    ? 'max-h-[1000px] opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-6 pt-4 text-sm leading-7 text-slate-700">
                  <p>
                    This mode keeps the interface simple and lets students jump
                    straight into gameplay. Open this panel only when you want a
                    quick refresher on how the simulation works.
                  </p>
                  <p className="mt-4">
                    Students can still explore how changing interest rates
                    affects inflation and unemployment, then click Next Quarter
                    to advance the economy.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-5 rounded-4xl bg-slate-50 p-6 border border-slate-200">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Instructor notes
              </p>
              <ul className="space-y-3 text-sm leading-7 text-slate-700">
                <li>
                  Use this mode when showing the simulation as part of a lesson.
                </li>
                <li>
                  Students can explore how changes to interest rates affect
                  inflation and unemployment.
                </li>
                <li>
                  Discuss each quarter before advancing the game to reinforce
                  key concepts.
                </li>
              </ul>
            </div>
          )}
        </section>

        <section>
          <FedGame />
        </section>
      </div>
    </main>
  );
};

export default FedGamePage;
