import { SignIn } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/clerk';

export default function SignInPage() {
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
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </main>
  );
}
