import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/clerk';
import { isInviteOnlyTeacherAccess } from '@/lib/teacherAccess';

export default function SignInPage() {
  const inviteOnlyTeacherAccess = isInviteOnlyTeacherAccess();

  if (!isClerkConfigured()) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
        <div className="max-w-lg rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Teacher authentication
          </p>
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            Clerk is not configured yet.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Add your Clerk publishable and secret keys to enable secure teacher
            sign-in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          forceRedirectUrl="/teacher"
        />
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Need teacher access?
          </p>
          <Link
            href="/sign-up"
            className="mt-3 block rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 hover:bg-white"
          >
            Teacher Sign Up / Waitlist
          </Link>
        </div>
        {inviteOnlyTeacherAccess && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
              Invite-only teacher access
            </p>
            <p className="mt-2 text-sm text-amber-900">
              Teachers must first receive an invitation link before they can use
              the dashboard.
            </p>
          </div>
        )}
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Are you a student?
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Students join classrooms using a classroom code and student
            credentials provided by their teacher.
          </p>
          <Link
            href="/stock"
            className="mt-3 block rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 hover:bg-white"
          >
            Go to Stock Market Simulator
          </Link>
        </div>
      </div>
    </main>
  );
}
