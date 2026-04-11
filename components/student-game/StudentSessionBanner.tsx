import { StudentSession } from './types';

export default function StudentSessionBanner({
  session,
  onSignOut,
}: {
  session: StudentSession;
  onSignOut: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Signed in student
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {session.username} in {session.classroomCode}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Session expires {new Date(session.expiresAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400"
        >
          Switch student
        </button>
      </div>
    </div>
  );
}
