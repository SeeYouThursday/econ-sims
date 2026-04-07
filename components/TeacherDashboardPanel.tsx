'use client';

import { useCallback, useEffect, useState } from 'react';

type TeacherClassroom = {
  code: string;
  title: string;
  createdAt: string;
};

type ClassroomApiError = {
  error?: string;
};

type ClassroomStudent = {
  studentId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
  cash: number;
  holdingsValue: number;
  totalValue: number;
  hasActiveSession: boolean;
};

type ClassroomStudentListPayload = {
  students?: ClassroomStudent[];
};

type ClassroomAudit = {
  classroomCode: string;
  asOf: string;
  studentCount: number;
  activeSessionCount: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  topSymbols: Array<{ symbol: string; trades: number }>;
};

function isTeacherClassroom(value: unknown): value is TeacherClassroom {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TeacherClassroom>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ClassroomApiError;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

export default function TeacherDashboardPanel({
  initialClassrooms,
}: {
  initialClassrooms: TeacherClassroom[];
}) {
  const [classrooms, setClassrooms] = useState(initialClassrooms);
  const [title, setTitle] = useState('');
  const [selectedClassroomCode, setSelectedClassroomCode] = useState(
    initialClassrooms[0]?.code ?? '',
  );
  const [studentAlias, setStudentAlias] = useState('');
  const [studentPasscode, setStudentPasscode] = useState('');
  const [studentsByClass, setStudentsByClass] = useState<
    Record<string, ClassroomStudent[]>
  >({});
  const [auditByClass, setAuditByClass] = useState<
    Record<string, ClassroomAudit>
  >({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [studentActionKey, setStudentActionKey] = useState<string | null>(null);
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);

  const selectedClassroomStudents = selectedClassroomCode
    ? (studentsByClass[selectedClassroomCode] ?? [])
    : [];
  const selectedClassroomAudit = selectedClassroomCode
    ? auditByClass[selectedClassroomCode]
    : undefined;

  const loadClassroomRoster = useCallback(async (classroomCode: string) => {
    if (!classroomCode) {
      return;
    }

    setLoadingRoster(true);

    try {
      const params = new URLSearchParams({ classroomCode });
      const response = await fetch(
        `/api/stock-game/students?${params.toString()}`,
      );
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to load students.');
        return;
      }

      const roster =
        payload && typeof payload === 'object'
          ? ((payload as ClassroomStudentListPayload).students ?? [])
          : [];

      setStudentsByClass((current) => ({
        ...current,
        [classroomCode]: Array.isArray(roster) ? roster : [],
      }));
    } catch {
      setError('Unable to load students right now.');
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  const loadClassroomAudit = useCallback(async (classroomCode: string) => {
    if (!classroomCode) {
      return;
    }

    setLoadingMetrics(true);

    try {
      const response = await fetch('/api/stock-game/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomCode }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(
          getApiErrorMessage(payload) ?? 'Unable to load classroom metrics.',
        );
        return;
      }

      if (!payload || typeof payload !== 'object') {
        setError('Unexpected classroom metrics response from server.');
        return;
      }

      const candidate = payload as Partial<ClassroomAudit>;
      if (
        typeof candidate.classroomCode !== 'string' ||
        typeof candidate.asOf !== 'string' ||
        typeof candidate.studentCount !== 'number' ||
        typeof candidate.activeSessionCount !== 'number' ||
        typeof candidate.tradeCount !== 'number' ||
        typeof candidate.buyCount !== 'number' ||
        typeof candidate.sellCount !== 'number' ||
        !Array.isArray(candidate.topSymbols)
      ) {
        setError('Unexpected classroom metrics response from server.');
        return;
      }

      setAuditByClass((current) => ({
        ...current,
        [classroomCode]: candidate as ClassroomAudit,
      }));
    } catch {
      setError('Unable to load classroom metrics right now.');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClassroomCode) {
      return;
    }

    void loadClassroomRoster(selectedClassroomCode);
    void loadClassroomAudit(selectedClassroomCode);
  }, [loadClassroomAudit, loadClassroomRoster, selectedClassroomCode]);

  const createClassroom = async () => {
    if (!title.trim()) {
      setError('Enter a classroom title.');
      return;
    }

    setCreatingClassroom(true);
    setError(null);

    try {
      const response = await fetch('/api/teacher/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to create classroom.');
        return;
      }

      if (!isTeacherClassroom(payload)) {
        setError('Unexpected classroom response from server.');
        return;
      }

      setClassrooms((current) => [...current, payload]);
      setSelectedClassroomCode(payload.code);
      setStudentsByClass((current) => ({ ...current, [payload.code]: [] }));
      setAuditByClass((current) => ({
        ...current,
        [payload.code]: {
          classroomCode: payload.code,
          asOf: new Date().toISOString(),
          studentCount: 0,
          activeSessionCount: 0,
          tradeCount: 0,
          buyCount: 0,
          sellCount: 0,
          topSymbols: [],
        },
      }));
      setTitle('');
    } catch {
      setError('Unable to create classroom right now.');
    } finally {
      setCreatingClassroom(false);
    }
  };

  const createStudentAlias = async () => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (!studentAlias.trim()) {
      setError('Enter a student alias.');
      return;
    }

    if (!studentPasscode.trim()) {
      setError('Enter a student passcode.');
      return;
    }

    setCreatingStudent(true);
    setError(null);
    setStudentMessage(null);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          username: studentAlias,
          studentPasscode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to create student.');
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      setStudentAlias('');
      setStudentPasscode('');
      setStudentMessage(
        'Student alias created. Share alias, passcode, and class code.',
      );
    } catch {
      setError('Unable to create student right now.');
    } finally {
      setCreatingStudent(false);
    }
  };

  const runStudentAction = async (
    username: string,
    action: 'reset' | 'deactivate' | 'activate' | 'delete',
  ) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (
      action === 'delete' &&
      !window.confirm(
        `Delete ${username}? This will remove the alias and cannot be undone.`,
      )
    ) {
      return;
    }

    setError(null);
    setStudentMessage(null);
    setStudentActionKey(`${username}:${action}`);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          username,
          ...(action === 'delete' ? {} : { action }),
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to update student.');
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      if (action === 'reset') {
        setStudentMessage(`Reset portfolio for ${username}.`);
      } else if (action === 'delete') {
        setStudentMessage(`Deleted ${username}.`);
      } else if (action === 'deactivate') {
        setStudentMessage(`Deactivated ${username}.`);
      } else {
        setStudentMessage(`Reactivated ${username}.`);
      }
    } catch {
      setError('Unable to update student right now.');
    } finally {
      setStudentActionKey(null);
    }
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-4xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          Your classrooms
        </p>
        {classrooms.length === 0 ? (
          <p className="mt-4 text-sm leading-7 text-slate-600">
            No classrooms yet. Create your first classroom to start assigning
            student aliases without shared global credentials.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {classrooms.map((classroom) => (
              <div
                key={classroom.code}
                className="rounded-3xl border border-slate-200 bg-white px-4 py-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {classroom.title}
                    </p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Code {classroom.code}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Created {new Date(classroom.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            Create classroom
          </p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Classroom title
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Period 3 Economics"
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          />
          <button
            type="button"
            onClick={createClassroom}
            disabled={creatingClassroom}
            className="mt-4 w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {creatingClassroom ? 'Creating…' : 'Create classroom'}
          </button>
        </div>

        <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
              Classroom metrics
            </p>
            {selectedClassroomCode ? (
              <button
                type="button"
                onClick={() => void loadClassroomAudit(selectedClassroomCode)}
                disabled={loadingMetrics}
                title={
                  loadingMetrics
                    ? 'Refreshing metrics...'
                    : 'Refresh classroom metrics'
                }
                className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMetrics ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : null}
          </div>

          {!selectedClassroomCode ? (
            <p className="mt-3 text-sm text-slate-600">
              Select a classroom to view metrics.
            </p>
          ) : loadingMetrics && !selectedClassroomAudit ? (
            <p className="mt-3 text-sm text-slate-600">Loading metrics…</p>
          ) : selectedClassroomAudit ? (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Students</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedClassroomAudit.studentCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Active sessions</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedClassroomAudit.activeSessionCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Trades</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedClassroomAudit.tradeCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Buys</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedClassroomAudit.buyCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Sells</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedClassroomAudit.sellCount}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-700">Top symbols</p>
                {selectedClassroomAudit.topSymbols.length === 0 ? (
                  <p className="mt-1 text-slate-500">No trade activity yet.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedClassroomAudit.topSymbols.map((entry) => (
                      <span
                        key={`${entry.symbol}:${entry.trades}`}
                        className="rounded-full border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
                      >
                        {entry.symbol} · {entry.trades}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                Updated {new Date(selectedClassroomAudit.asOf).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Metrics are unavailable for this classroom right now.
            </p>
          )}
        </div>

        <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            Add students
          </p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Classroom code
          </label>
          <select
            title="Classroom code"
            aria-label="Classroom code"
            value={selectedClassroomCode}
            onChange={(event) => setSelectedClassroomCode(event.target.value)}
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          >
            <option value="">Select classroom</option>
            {classrooms.map((classroom) => (
              <option key={classroom.code} value={classroom.code}>
                {classroom.title} ({classroom.code})
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Student alias
          </label>
          <input
            value={studentAlias}
            onChange={(event) => setStudentAlias(event.target.value)}
            placeholder="student_01"
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          />

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Student passcode
          </label>
          <input
            type="password"
            value={studentPasscode}
            onChange={(event) => setStudentPasscode(event.target.value)}
            placeholder="••••••"
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          />

          <button
            type="button"
            onClick={createStudentAlias}
            disabled={creatingStudent}
            className="mt-4 w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {creatingStudent ? 'Creating…' : 'Create student alias'}
          </button>

          {studentMessage ? (
            <p className="mt-3 text-sm text-emerald-700">{studentMessage}</p>
          ) : null}
          {selectedClassroomCode ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Classroom roster
              </p>
              {loadingRoster ? (
                <p className="mt-2 text-sm text-slate-600">Loading roster…</p>
              ) : selectedClassroomStudents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  No students yet for this classroom.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedClassroomStudents.map((student) => (
                    <div
                      key={student.studentId}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {student.username}
                          </p>
                          <p className="text-slate-500">
                            Joined{' '}
                            {new Date(student.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">
                            ${student.totalValue.toFixed(2)}
                          </p>
                          <p className="text-slate-500">
                            {student.isActive
                              ? student.hasActiveSession
                                ? 'Active now'
                                : 'Active'
                              : 'Disabled'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/** Provide a reason in native tooltip text while actions are locked. */}
                        <button
                          type="button"
                          onClick={() =>
                            void runStudentAction(student.username, 'reset')
                          }
                          disabled={studentActionKey !== null}
                          title={
                            studentActionKey !== null
                              ? 'Finish the current student action first.'
                              : `Reset portfolio for ${student.username}`
                          }
                          className="rounded-full border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runStudentAction(
                              student.username,
                              student.isActive ? 'deactivate' : 'activate',
                            )
                          }
                          disabled={studentActionKey !== null}
                          title={
                            studentActionKey !== null
                              ? 'Finish the current student action first.'
                              : student.isActive
                                ? `Deactivate ${student.username}`
                                : `Reactivate ${student.username}`
                          }
                          className="rounded-full border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {student.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runStudentAction(student.username, 'delete')
                          }
                          disabled={studentActionKey !== null}
                          title={
                            studentActionKey !== null
                              ? 'Finish the current student action first.'
                              : `Delete ${student.username}`
                          }
                          className="rounded-full border border-rose-300 px-2.5 py-1 font-semibold text-rose-700 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="lg:col-span-2 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
