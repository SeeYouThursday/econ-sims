import React from 'react';
import Link from 'next/link';
import { BarChart3, GraduationCap, ShieldCheck, Gavel } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-100 mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-start md:justify-between lg:px-8">
        {/* Brand and Disclaimer */}
        <div className="space-y-6 md:w-1/3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold group-hover:bg-blue-700 transition-colors">
              G
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Mr. G&apos;s Civics Lab
            </span>
          </Link>

          <p className="text-sm leading-6 text-slate-500">
            Interactive financial and civic simulations designed for the modern
            classroom. Built for educators, by educators.
          </p>

          {/* Educational Disclaimer - Keep this prominent for FortiGuard */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium text-slate-600 uppercase tracking-tight">
                <span className="text-blue-600 font-bold">Safety Notice:</span>{' '}
                This is a strictly educational simulation using virtual game
                currency. No real-world financial transactions or assets are
                supported.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-10 grid grid-cols-2 gap-8 md:mt-0 md:w-1/2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Simulations
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/fed-sim"
                  className="text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  Fed Simulator
                </Link>
              </li>
              <li>
                <Link
                  href="/market"
                  className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Stock Market Game
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-slate-400" />
              Educators
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/waitlist"
                  className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Join Waitlist
                </Link>
              </li>
              {/* TODO: Future Dev */}
              <li className="hidden">
                <Link
                  href="/docs"
                  className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Curriculum Guide
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Gavel className="h-4 w-4 text-slate-400" />
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-slate-500 hover:text-blue-700 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="mx-auto max-w-7xl px-6 py-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Civics Lab. Supporting teachers and
          student.
        </p>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600 mr-2 animate-pulse" />
            Verified Educator Platform
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
