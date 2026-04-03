import Link from 'next/link';
import { BookOpen, Users, Sparkles, BarChart3 } from 'lucide-react';

const featureCards = [
  {
    title: 'Engaging class simulations',
    description:
      'Invite students to experiment with monetary policy and market behavior in a low-stakes, interactive environment.',
    icon: BookOpen,
  },
  {
    title: 'Teacher-friendly prep',
    description:
      'No installation required. Launch lessons instantly from any browser and reinforce key economics concepts with real-time visuals.',
    icon: Users,
  },
  {
    title: 'Data-driven learning',
    description:
      'Use real market data and macroeconomic indicators to make lessons feel modern, relevant, and memorable.',
    icon: BarChart3,
  },
];

const Page = () => {
  return (
    <main className="bg-slate-100 text-slate-900">
      <section className="relative overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_left,rgba(67,56,202,0.45),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.25),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-sky-200">
                Classroom economics, reimagined
              </p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Teach macroeconomics and markets with interactive simulations.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
                Built for teachers and students, this site makes economic
                concepts visible through hands-on gameplay, clear visuals, and
                real market data. Launch lessons, spark discussion, and help
                learners explore how policy choices affect prices, jobs, and
                growth.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/fed-simulator"
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-sky-300"
                >
                  Try the Fed simulator
                </Link>
                <Link
                  href="/stock"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/15"
                >
                  Try the stock lesson
                </Link>
              </div>
            </div>

            <div className="rounded-4xl border border-white/10 bg-slate-950/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
              <div className="space-y-6">
                <div className="rounded-4xl border border-white/10 bg-slate-900/80 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-300">
                    Featured lesson
                  </p>
                  <h2 className="mt-4 text-2xl font-black text-white">
                    Federal Reserve Policy Lab
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Students act as the Fed Chair, set interest rates, and watch
                    inflation and unemployment respond over time.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-4xl bg-slate-800/95 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                      Student-ready
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      Playful, clear, and easy to explore.
                    </p>
                  </div>
                  <div className="rounded-4xl bg-slate-800/95 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                      Teacher-ready
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      Supports discussion, prediction, and reflection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
        id="why-teachers"
      >
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-500">
              Designed for teaching
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              A memorable learning path for students and instructors.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              Students can explore cause and effect with real economic signals,
              while teachers gain a polished demo they can use in class, remote
              sessions, or flipped learning.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Student engagement
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Active gameplay helps students connect abstract models to
                  concrete outcomes.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Flexible pacing
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Use the simulation as a live demo, homework task, or
                  discussion starter.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-white">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-400">
                Ready for your next lesson
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Bring economic intuition to life with a modern classroom
                experience.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
                Teachers can guide students through data, decisions, and
                consequences in a safe sandbox where every choice has a visible
                impact.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/fed-simulator"
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-sky-300"
                >
                  Launch the Fed simulator
                </Link>
                <Link
                  href="/stock"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/15"
                >
                  Try the stock lesson
                </Link>
              </div>
            </div>
            <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-2xl">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-slate-300">
                  <Sparkles size={20} />
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    Student success
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  Teach with confidence and keep students curious.
                </p>
                <ul className="space-y-4 text-slate-300">
                  <li className="flex gap-3">
                    <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-400 text-slate-950">
                      ✓
                    </span>
                    <span>
                      Support inquiry-based learning with immediate feedback.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-400 text-slate-950">
                      ✓
                    </span>
                    <span>
                      Introduce markets, inflation, and jobs through play.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-400 text-slate-950">
                      ✓
                    </span>
                    <span>
                      Keep lessons accessible for in-person or remote teaching.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Page;
