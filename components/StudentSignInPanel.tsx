'use client';

import Link from 'next/link';
import { useState } from 'react';

type LoginResponse = {
  token: string;
  classroomCode: string;
  username: string;
  expiresAt: string;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { error?: string };
  return typeof candidate.error === 'string' ? candidate.error : null;
}

export default function StudentSignInPanel() {
  const [classroomCode, setClassroomCode] = useState('');
  const [username, setUsername] = useState('');
  const [studentPasscode, setStudentPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<LoginResponse | null>(null);

  const signIn = async () => {
    if (!classroomCode.trim() || !username.trim() || !studentPasscode.trim()) {
      setError('Enter class code, alias, and passcode.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/stock-game/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode,
          username,
          studentPasscode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok || !payload || typeof payload !== 'object') {
        setError(getErrorMessage(payload) ?? 'Unable to sign in right now.');
        return;
      }

      const candidate = payload as Partial<LoginResponse>;
      if (
        typeof candidate.token !== 'string' ||
        typeof candidate.classroomCode !== 'string' ||
        typeof candidate.username !== 'string' ||
        typeof candidate.expiresAt !== 'string'
      ) {
        setError('Unexpected sign-in response from server.');
        return;
      }

      const authSession: LoginResponse = {
        token: candidate.token,
        classroomCode: candidate.classroomCode,
        username: candidate.username,
        expiresAt: candidate.expiresAt,
      };

      setSession(authSession);
      localStorage.setItem('stockGameSession', JSON.stringify(authSession));
      setStudentPasscode('');
    } catch {
      setError('Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
        Student sign-in
      </p>
      <h1 className="mt-4 text-3xl font-black text-slate-900">
        Join your classroom trading game
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Enter the class code, your student alias, and your passcode from your
        teacher.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Class code
          </label>
          <input
            value={classroomCode}
            onChange={(event) => setClassroomCode(event.target.value)}
            placeholder="ABC123"
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Student alias
          </label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="student_01"
            className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold text-slate-700">
          Student passcode
        </label>
        <input
          type="password"
          value={studentPasscode}
          onChange={(event) => setStudentPasscode(event.target.value)}
          placeholder="••••••"
          className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <button
        type="button"
        onClick={signIn}
        disabled={submitting}
        className="mt-5 w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {submitting ? 'Signing in…' : 'Sign in to class'}
      </button>

      {session ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Signed in as <strong>{session.username}</strong> in class{' '}
          <strong>{session.classroomCode}</strong>. Session expires{' '}
          {new Date(session.expiresAt).toLocaleString()}.
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Teachers create aliases from the teacher dashboard. Need one?
        <div className="mt-2">
          <Link
            href="/teacher"
            className="font-semibold text-slate-900 underline underline-offset-4"
          >
            Open teacher dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
