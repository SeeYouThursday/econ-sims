'use client';

import { useState } from 'react';
import { UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/fed-simulator', label: 'Fed Simulator' },
  { href: '/stock', label: 'Stock Market' },
];

export default function SiteHeader({
  clerkEnabled,
}: {
  clerkEnabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { userId } = useAuth();
  const isSignedIn = Boolean(userId);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-black tracking-[0.2em] text-slate-900 sm:text-xl"
        >
          ECON SIMS
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/fed-simulator"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
          >
            Try Fed Simulator
          </Link>
          {clerkEnabled ? (
            isSignedIn ? (
              <>
                <Link
                  href="/teacher"
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Teacher Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Teacher Portal
                </Link>
              </>
            )
          ) : (
            <Link
              href="/teacher"
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Teacher Setup
            </Link>
          )}
        </div>

        <button
          type="button"
          aria-label={
            menuOpen ? 'Close navigation menu' : 'Open navigation menu'
          }
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 lg:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <div className="space-y-2 px-4 pb-4 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-3xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/fed-simulator"
              onClick={() => setMenuOpen(false)}
              className="block rounded-3xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
            >
              Try Fed Simulator
            </Link>
            {clerkEnabled ? (
              <>
                <Link
                  href="/sign-in"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-3xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Teacher Sign In
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-3xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Teacher Sign Up
                </Link>
              </>
            ) : (
              <Link
                href="/teacher"
                onClick={() => setMenuOpen(false)}
                className="block rounded-3xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Teacher Setup
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
