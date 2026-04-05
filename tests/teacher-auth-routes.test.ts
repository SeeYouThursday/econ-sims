import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('teacher-protected stock game routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  });

  it('rejects student creation without a signed-in teacher when Clerk is enabled', async () => {
    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: null })),
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');
    const response = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: 'DEMO101',
          teacherPasscode: 'teacher-demo',
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('Teacher sign-in is required');
  });

  it('rejects teacher audit access without a signed-in teacher when Clerk is enabled', async () => {
    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: null })),
    }));

    const auditRoute = await import('../app/api/stock-game/audit/route');
    const response = await auditRoute.POST(
      new Request('http://localhost/api/stock-game/audit', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: 'DEMO101',
          teacherPasscode: 'teacher-demo',
        }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('Teacher sign-in is required');
  });
});
