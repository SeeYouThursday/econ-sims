'use client';

import { useState } from 'react';
import { UserButton, Show } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, GraduationCap } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/fed-simulator', label: 'Fed Simulator' },
  { href: '/stock', label: 'Stock Market' },
];

/**
 * Refined Actions using Clerk Core 3 <Show /> pattern
 */
function ClerkHeaderActions({
  showTeacherApprovalLink,
  mobile,
  onNavigate,
}: {
  showTeacherApprovalLink?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* CASE: User is Authenticated */}
      <Show when="signed-in">
        <div
          className={`flex ${mobile ? 'flex-col gap-2' : 'items-center gap-4'}`}
        >
          <Link
            href="/teacher"
            onClick={onNavigate}
            className={`${
              mobile ? 'block w-full px-4 py-3' : 'px-5 py-2'
            } rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900`}
          >
            Dashboard
          </Link>

          {showTeacherApprovalLink && (
            <Link
              href="/admin/teacher-approval"
              onClick={onNavigate}
              className={`${
                mobile ? 'block w-full px-4 py-3' : 'px-4 py-2'
              } rounded-xl border border-emerald-200 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50`}
            >
              Admin
            </Link>
          )}

          <div className={mobile ? 'px-4 py-2' : ''}>
            <UserButton />
          </div>
        </div>
      </Show>

      {/* CASE: User is Not Authenticated */}
      <Show when="signed-out">
        <div
          className={`flex ${mobile ? 'flex-col gap-2' : 'items-center gap-3'}`}
        >
          <Link
            href="/sign-in"
            onClick={onNavigate}
            className={`${
              mobile ? 'block w-full px-4 py-3 text-center' : 'px-4 py-2'
            } text-sm font-bold text-slate-600 hover:text-slate-900 transition`}
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            onClick={onNavigate}
            className={`${
              mobile ? 'block w-full px-4 py-3 text-center' : 'px-5 py-2'
            } rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700`}
          >
            Teacher Sign Up
          </Link>
        </div>
      </Show>
    </>
  );
}

export default function SiteHeader({
  clerkEnabled,
  showTeacherApprovalLink,
}: {
  clerkEnabled?: boolean;
  showTeacherApprovalLink?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo Section - Institutional Branding */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* <div className="bg-blue-600 p-2 rounded-xl shadow-sm group-hover:bg-blue-700 transition"> */}
          {/* <GraduationCap className="text-white h-5 w-5" /> */}
          <Image
            src="/alt-logo.png"
            height="32"
            width="32"
            alt="Mr. G's Civics Lab Logo"
            className="rounded-xl h-8 w-8 object-contain"
          />
          {/* </div> */}
          <div className="flex flex-col leading-none justify-center -mt-1.5">
            <span className="text-lg font-black tracking-tight text-slate-900">
              Civics Lab
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
              Verified Educator
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-bold text-slate-500 transition hover:text-blue-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Action Zone */}
        <div className="hidden items-center gap-4 lg:flex border-l border-slate-100 pl-6">
          {clerkEnabled ? (
            <ClerkHeaderActions
              showTeacherApprovalLink={showTeacherApprovalLink}
            />
          ) : (
            <Link
              href="/sign-up"
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Join Waitlist
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 transition hover:bg-slate-50 lg:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Responsive Mobile Menu */}
      {menuOpen && (
        <div className="border-t border-slate-100 bg-white lg:hidden">
          <div className="space-y-1 px-4 pb-8 pt-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-4 border-t border-slate-100 pt-4" />
            {clerkEnabled ? (
              <ClerkHeaderActions
                showTeacherApprovalLink={showTeacherApprovalLink}
                mobile
                onNavigate={() => setMenuOpen(false)}
              />
            ) : (
              <Link
                href="/sign-up"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white text-center"
              >
                Join Waitlist
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
