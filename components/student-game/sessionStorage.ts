import { StudentSession } from './types';

const SESSION_KEY = 'stockGameSession';

function isStudentSession(value: unknown): value is StudentSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StudentSession>;
  return (
    typeof candidate.token === 'string' &&
    typeof candidate.classroomCode === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.expiresAt === 'string'
  );
}

export function getSessionStorageKey() {
  return SESSION_KEY;
}

export function loadStudentSession(): StudentSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStudentSession(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStudentSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
}
