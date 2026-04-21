import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  Users,
  BarChart3,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

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
    <main className="bg-white text-slate-900">
      {/* Hero Section - Inverted to White for Trust & Readability */}
      <section className="relative overflow-hidden bg-white pt-20 pb-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-6">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Classroom economics, reimagined
                </span>
              </div>

              <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
                Teach macroeconomics with{' '}
                <span className="text-blue-600">interactive</span> simulations.
              </h1>

              <p className="mt-8 text-lg leading-8 text-slate-600">
                Built for educators, Civics Lab makes economic concepts visible
                through hands-on gameplay, clear visuals, and real market data.
                Help learners explore how policy choices affect prices, jobs,
                and growth.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/fed-simulator"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-blue-700"
                >
                  Try the Fed simulator
                </Link>
                <Link
                  href="/waitlist"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-slate-900 transition hover:bg-slate-50"
                >
                  Join Waitlist
                </Link>
              </div>

              {/* Trust Signal for FortiGuard */}
              <div className="mt-8 flex items-center gap-2 text-slate-500">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium">
                  Non-commercial educational platform. No real currency
                  involved.
                </p>
              </div>
            </div>

            {/* Visual Hero - Replacing the dark box with our UI Render */}
            <div className="relative">
              <div className="relative rounded-3xl border border-slate-100 bg-slate-50/50 p-2 shadow-2xl">
                <Image
                  src="/hero-dashboard.png" // The master scene I generated
                  alt="Civics Lab Student Simulation Dashboard"
                  width={800}
                  height={450}
                  className="rounded-2xl border border-slate-200 shadow-sm"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section - Clean & High Contrast */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-base font-bold uppercase tracking-widest text-blue-600">
              Designed for teaching
            </h2>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Everything you need for a memorable lesson.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition hover:shadow-md"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white mb-6">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA - Dark accent for contrast at the bottom */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-black sm:text-4xl">
            Ready to bring economic intuition to life?
          </h2>
          <p className="mt-6 text-lg text-slate-400">
            Join a growing community of educators simplifying macroeconomics.
          </p>
          <div className="mt-10">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-blue-500"
            >
              Get Started for Free <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Page;
