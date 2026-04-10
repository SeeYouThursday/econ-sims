import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { isClerkConfigured } from '@/lib/clerk';
import { redeemTeacherInvitation } from '@/lib/teacherStore';

type Props = {
  searchParams: Promise<{ invite?: string }>;
};

export default async function InviteAcceptPage({ searchParams }: Props) {
  const { invite } = await searchParams;

  if (!invite) {
    redirect('/sign-up');
  }

  if (!isClerkConfigured()) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
        <div className="max-w-lg rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Teacher access
          </p>
          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Auth is not configured.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Clerk keys must be set before teacher accounts can be created.
          </p>
        </div>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/invite/accept?invite=${invite}`);
  }

  let errorMessage: string | null = null;

  try {
    await redeemTeacherInvitation(invite, userId);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Unable to redeem invitation.';
  }

  if (!errorMessage) {
    redirect('/teacher');
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-100 px-4 py-12">
      <div className="max-w-lg rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          Teacher sign-up
        </p>
        <h1 className="mt-4 text-2xl font-black text-slate-900">
          Invitation could not be redeemed
        </h1>
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href="/sign-up"
            className="block w-full rounded-3xl border border-slate-300 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Back to start
          </Link>
          <Link
            href="/teacher"
            className="block w-full rounded-3xl bg-slate-900 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
          >
            Go to teacher dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
