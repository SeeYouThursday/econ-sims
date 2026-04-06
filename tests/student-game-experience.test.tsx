import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../components/StudentSignInPanel', () => ({
  default: ({ onSignedIn }: { onSignedIn?: (session: unknown) => void }) => (
    <button
      data-testid="sign-in-stub"
      onClick={() =>
        onSignedIn?.({
          token: 'token_1',
          classroomCode: 'ABC123',
          username: 'student_01',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      }
    >
      Sign in stub
    </button>
  ),
}));

vi.mock('../components/student-game/StudentDashboard', () => ({
  default: ({
    session,
  }: {
    session: { username: string; classroomCode: string };
  }) => (
    <div data-testid="dashboard-stub">
      {session.username}::{session.classroomCode}
    </div>
  ),
}));

describe('StudentGameExperience', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders sign-in panel when no session exists', async () => {
    vi.doMock('../components/student-game/sessionStorage', () => ({
      loadStudentSession: vi.fn(() => null),
      clearStudentSession: vi.fn(),
    }));

    const module =
      await import('../components/student-game/StudentGameExperience');
    const StudentGameExperience = module.default;

    const html = renderToStaticMarkup(<StudentGameExperience />);

    expect(html).toContain('data-testid="sign-in-stub"');
    expect(html).not.toContain('data-testid="dashboard-stub"');
  });

  it('renders dashboard when valid session exists', async () => {
    vi.doMock('../components/student-game/sessionStorage', () => ({
      loadStudentSession: vi.fn(() => ({
        token: 'token_1',
        classroomCode: 'ABC123',
        username: 'student_01',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })),
      clearStudentSession: vi.fn(),
    }));

    const module =
      await import('../components/student-game/StudentGameExperience');
    const StudentGameExperience = module.default;

    const html = renderToStaticMarkup(<StudentGameExperience />);

    expect(html).toContain('data-testid="dashboard-stub"');
    expect(html).toContain('student_01::ABC123');
  });
});
