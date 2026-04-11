import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminAccessError, requireTeacherAdminUser } from '@/lib/adminAccess';
import TeacherApprovalAdminClient from './TeacherApprovalAdminClient';

export default async function TeacherApprovalAdminPage() {
  let accessError: AdminAccessError | null = null;

  try {
    await requireTeacherAdminUser();
  } catch (error) {
    if (error instanceof AdminAccessError) {
      accessError = error;
    } else {
      throw error;
    }
  }

  if (accessError) {
    if (accessError.status === 401) {
      redirect('/sign-in?redirect_url=/admin/teacher-approval');
    }

    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Admin tools
          </p>
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            Access restricted
          </h1>
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {accessError.message}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/teacher"
              className="block w-full rounded-3xl border border-slate-300 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Return to dashboard
            </Link>
            <Link
              href="/"
              className="block w-full rounded-3xl bg-slate-900 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <TeacherApprovalAdminClient />;
}
