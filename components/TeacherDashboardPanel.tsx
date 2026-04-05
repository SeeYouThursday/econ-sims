'use client';

import { useState } from 'react';

type TeacherClassroom = {
  code: string;
  title: string;
  createdAt: string;
};

type ClassroomApiError = {
  error?: string;
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
  const [createdStudentsByClass, setCreatedStudentsByClass] = useState<
    Record<string, string[]>
  >({});
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);

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

      setCreatedStudentsByClass((current) => ({
        ...current,
        [selectedClassroomCode]: [
          ...(current[selectedClassroomCode] ?? []),
          studentAlias.trim().toLowerCase(),
        ],
      }));
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
          {selectedClassroomCode &&
          createdStudentsByClass[selectedClassroomCode] ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Recently created aliases
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {createdStudentsByClass[selectedClassroomCode].map((alias) => (
                  <span
                    key={alias}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {alias}
                  </span>
                ))}
              </div>
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
