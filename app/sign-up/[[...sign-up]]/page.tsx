import Link from 'next/link';
import { SignUp, Waitlist } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/clerk';
import { allowsTeacherSelfSignUp } from '@/lib/teacherAccess';

export default async function SignUpPage() {
  const teacherSelfSignUpEnabled = allowsTeacherSelfSignUp();

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
            Add your Clerk publishable and secret keys before enabling teacher
            account creation.
          </p>
        </div>
      </main>
    );
  }

  if (teacherSelfSignUpEnabled) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl="/teacher"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            Teacher Access
          </p>
          <h1 className="mt-3 text-xl font-black text-slate-900">
            Join the waitlist
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Teacher sign-up is currently invite-only. Join the waitlist and an
            administrator can approve your account for classroom access.
          </p>
        </div>

        <Waitlist signInUrl="/sign-in" />

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <Link
              href="/sign-in"
              className="block w-full rounded-3xl bg-slate-900 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
            >
              Go to Teacher Sign In
            </Link>
            <Link
              href="/"
              className="block w-full rounded-3xl border border-slate-300 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
