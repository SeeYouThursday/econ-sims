import type { ClassroomStudent } from '@/components/teacher-dashboard/types';
import { formatCents } from '@/lib/formatCents';

type ManageTab = 'single' | 'bulk' | 'roster';

type ManageStudentsPanelProps = {
  selectedClassroomStudents: ClassroomStudent[];
  manageTab: ManageTab;
  studentAlias: string;
  studentPasscode: string;
  showGeneratedPasscode: boolean;
  bulkCount: string;
  loadingRoster: boolean;
  creatingStudent: boolean;
  bulkCreating: boolean;
  exportingCredentials: boolean;
  studentActionKey: string | null;
  studentMessage: string | null;
  onManageTabChange: (tab: ManageTab) => void;
  onStudentPasscodeChange: (value: string) => void;
  onBulkCountChange: (value: string) => void;
  onFillGeneratedAlias: () => void;
  onTogglePasscodeVisibility: () => void;
  onFillGeneratedPasscode: () => void;
  onCreateStudentAlias: () => void;
  onBulkCreateCsv: () => void;
  onBulkCreateCards: () => void;
  onExportStudentCredentials: () => void;
  onPrintRosterCredentialCards: () => void;
  onRunStudentAction: (
    username: string,
    action: 'reset' | 'deactivate' | 'activate' | 'delete',
  ) => void;
};

export function ManageStudentsPanel({
  selectedClassroomStudents,
  manageTab,
  studentAlias,
  studentPasscode,
  showGeneratedPasscode,
  bulkCount,
  loadingRoster,
  creatingStudent,
  bulkCreating,
  exportingCredentials,
  studentActionKey,
  studentMessage,
  onManageTabChange,
  onStudentPasscodeChange,
  onBulkCountChange,
  onFillGeneratedAlias,
  onTogglePasscodeVisibility,
  onFillGeneratedPasscode,
  onCreateStudentAlias,
  onBulkCreateCsv,
  onBulkCreateCards,
  onExportStudentCredentials,
  onPrintRosterCredentialCards,
  onRunStudentAction,
}: ManageStudentsPanelProps) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          Manage students
        </p>
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        {(['single', 'bulk', 'roster'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onManageTabChange(tab)}
            className={`px-3 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${
              manageTab === tab
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'single' && 'Add Single'}
            {tab === 'bulk' && 'Bulk Generate'}
            {tab === 'roster' && 'Roster'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {manageTab === 'single' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                Student alias
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={studentAlias}
                  readOnly
                  placeholder="brave_otter42"
                  title="Generated student alias"
                  className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={onFillGeneratedAlias}
                  className="rounded-2xl border border-slate-300 px-2 py-2 text-[10px] font-black uppercase text-slate-700 transition hover:border-slate-400"
                >
                  Gen
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                Passcode
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type={showGeneratedPasscode ? 'text' : 'password'}
                  value={studentPasscode}
                  onChange={(event) =>
                    onStudentPasscodeChange(event.target.value)
                  }
                  placeholder="AB7K9Q2M"
                  title="Student passcode"
                  className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={onTogglePasscodeVisibility}
                  className="rounded-2xl border border-slate-300 px-2 py-2 text-[10px] font-black uppercase text-slate-700 transition hover:border-slate-400"
                >
                  {showGeneratedPasscode ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={onFillGeneratedPasscode}
                  className="rounded-2xl border border-slate-300 px-2 py-2 text-[10px] font-black uppercase text-slate-700 transition hover:border-slate-400"
                >
                  Gen
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onCreateStudentAlias}
              disabled={creatingStudent}
              className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {creatingStudent ? 'Creating…' : 'Add student'}
            </button>
            {studentMessage && (
              <p className="text-xs text-emerald-700">{studentMessage}</p>
            )}
          </div>
        )}

        {manageTab === 'bulk' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                How many students?
              </label>
              <input
                type="number"
                min={1}
                max={35}
                placeholder="25"
                title="Number of student credentials to generate"
                value={bulkCount}
                onChange={(event) => onBulkCountChange(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-slate-500"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onBulkCreateCsv}
                disabled={bulkCreating}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkCreating ? 'Working…' : '+ CSV'}
              </button>
              <button
                type="button"
                onClick={onBulkCreateCards}
                disabled={bulkCreating}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkCreating ? 'Working…' : '+ Print'}
              </button>
            </div>
            {studentMessage && (
              <p className="text-xs text-emerald-700">{studentMessage}</p>
            )}
          </div>
        )}

        {manageTab === 'roster' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onExportStudentCredentials}
                disabled={exportingCredentials || studentActionKey !== null}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingCredentials ? 'Working…' : 'Export CSV'}
              </button>
              <button
                type="button"
                onClick={onPrintRosterCredentialCards}
                disabled={
                  exportingCredentials ||
                  studentActionKey !== null ||
                  loadingRoster ||
                  selectedClassroomStudents.length === 0
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingCredentials ? 'Working…' : 'Print cards'}
              </button>
            </div>

            {loadingRoster ? (
              <p className="text-xs text-slate-600">Loading roster…</p>
            ) : selectedClassroomStudents.length === 0 ? (
              <p className="text-xs text-slate-600">No students yet.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {selectedClassroomStudents.map((student) => (
                  <div
                    key={student.studentId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {student.username}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatCents(student.totalValue)}
                          {student.isActive && (
                            <span className="ml-2">
                              {student.hasActiveSession
                                ? '● Active'
                                : '○ Inactive'}
                            </span>
                          )}
                          {!student.isActive && (
                            <span className="ml-2">Disabled</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onRunStudentAction(student.username, 'reset')
                          }
                          disabled={studentActionKey !== null}
                          title={`Reset ${student.username}`}
                          aria-label={`Reset ${student.username}`}
                          className="rounded-full border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                        >
                          R
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRunStudentAction(
                              student.username,
                              student.isActive ? 'deactivate' : 'activate',
                            )
                          }
                          disabled={studentActionKey !== null}
                          title={`${student.isActive ? 'Deactivate' : 'Activate'} ${student.username}`}
                          aria-label={`${student.isActive ? 'Deactivate' : 'Activate'} ${student.username}`}
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase transition ${
                            student.isActive
                              ? 'border-slate-300 text-slate-700 hover:border-slate-400'
                              : 'border-emerald-300 text-emerald-700 hover:border-emerald-400'
                          } disabled:opacity-60`}
                        >
                          {student.isActive ? 'D' : 'A'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRunStudentAction(student.username, 'delete')
                          }
                          disabled={studentActionKey !== null}
                          title={`Delete ${student.username}`}
                          aria-label={`Delete ${student.username}`}
                          className="rounded-full border border-rose-300 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700 transition hover:border-rose-400 disabled:opacity-60"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
