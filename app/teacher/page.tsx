import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isClerkConfigured } from '@/lib/clerk';
import TeacherDashboardPanel from '@/components/TeacherDashboardPanel';
import { listTeacherClassrooms } from '@/lib/teacherStore';

export default async function TeacherPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Teacher dashboard
          </p>
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            Clerk setup is still required.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Once Clerk is configured, teachers will sign in here and manage
            classrooms without sharing global credentials.
          </p>
        </div>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/teacher');
  }

  const classrooms = await listTeacherClassrooms(userId);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          Teacher dashboard
        </p>
        <h1 className="mt-4 text-3xl font-black text-slate-900">
          Teacher account is connected.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          Clerk now handles teacher sign-in. Student aliases and classroom game
          flows remain separate so you can keep student data minimal for
          FERPA/COPPA alignment.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/stock"
            className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-900 transition hover:border-slate-300"
          >
            Open stock lesson
          </Link>
          <Link
            href="/sign-in"
            className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-300"
          >
            Manage teacher session
          </Link>
        </div>
        <TeacherDashboardPanel initialClassrooms={classrooms} />
      </div>
    </main>
  );
}
