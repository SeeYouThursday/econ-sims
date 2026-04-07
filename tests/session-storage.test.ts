import { afterEach, describe, expect, it } from 'vitest';
import {
  clearStudentSession,
  getSessionStorageKey,
  loadStudentSession,
  saveStudentSession,
} from '../components/student-game/sessionStorage';
import type { StudentSession } from '../components/student-game/types';

type StorageDouble = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  dump: () => Record<string, string>;
};

function createStorageDouble(
  initial: Record<string, string> = {},
): StorageDouble {
  const state = new Map<string, string>(Object.entries(initial));

  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => {
      state.set(key, value);
    },
    removeItem: (key) => {
      state.delete(key);
    },
    dump: () => Object.fromEntries(state.entries()),
  };
}

function setBrowserGlobals(storage: StorageDouble) {
  Object.defineProperty(globalThis, 'window', {
    value: {},
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

function clearBrowserGlobals() {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
}

describe('student session storage', () => {
  afterEach(() => {
    clearBrowserGlobals();
  });

  it('uses namespaced versioned session key', () => {
    expect(getSessionStorageKey()).toBe(
      'econ-sims:stock-game:student-session:v1',
    );
  });

  it('saves and loads session from the current key', () => {
    const storage = createStorageDouble();
    setBrowserGlobals(storage);

    const session: StudentSession = {
      token: 'token_1',
      classroomCode: 'ABC123',
      username: 'student_01',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    saveStudentSession(session);
    const loaded = loadStudentSession();

    expect(loaded).toEqual(session);
    expect(storage.dump()[getSessionStorageKey()]).toBeTruthy();
  });

  it('clear removes current key', () => {
    const session: StudentSession = {
      token: 'token_2',
      classroomCode: 'XYZ999',
      username: 'student_03',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const storage = createStorageDouble({
      [getSessionStorageKey()]: JSON.stringify(session),
    });
    setBrowserGlobals(storage);

    clearStudentSession();

    expect(storage.dump()[getSessionStorageKey()]).toBeUndefined();
  });
});
