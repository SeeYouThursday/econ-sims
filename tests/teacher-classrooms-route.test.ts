import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('teacher classroom routes', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
    }));

    const teacherStore = await import('../lib/teacherStore');
    teacherStore.__resetTeacherStore();

    const stockGameStore = await import('../lib/stockGameStore');
    await stockGameStore.__resetStockGameState();
  });

  it('creates and lists teacher-owned classrooms', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');

    const createRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Period 3 Economics' }),
      }),
    );

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      code: string;
      title: string;
    };
    expect(created.title).toBe('Period 3 Economics');
    expect(created.code).toHaveLength(6);

    const listRes = await classroomsRoute.GET();
    expect(listRes.status).toBe(200);

    const classrooms = (await listRes.json()) as Array<{
      code: string;
      title: string;
    }>;
    expect(classrooms).toHaveLength(1);
    expect(classrooms[0]?.code).toBe(created.code);
  });

  it('lets a signed-in teacher create a student in an owned classroom without a shared passcode', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createClassroomRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'AP Macro' }),
      }),
    );
    const classroom = (await createClassroomRes.json()) as { code: string };

    const createStudentRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createStudentRes.status).toBe(201);
    const payload = (await createStudentRes.json()) as {
      classroomCode: string;
      username: string;
    };
    expect(payload.classroomCode).toBe(classroom.code);
    expect(payload.username).toBe('student_a1');

    const rosterRes = await studentsRoute.GET(
      new Request(
        `http://localhost/api/stock-game/students?classroomCode=${classroom.code}`,
      ),
    );

    expect(rosterRes.status).toBe(200);
    const rosterPayload = (await rosterRes.json()) as {
      classroomCode: string;
      studentCount: number;
      students: Array<{ username: string }>;
      piiIncluded: boolean;
    };

    expect(rosterPayload.classroomCode).toBe(classroom.code);
    expect(rosterPayload.studentCount).toBe(1);
    expect(rosterPayload.students[0]?.username).toBe('student_a1');
    expect(rosterPayload.piiIncluded).toBe(false);

    const auditRoute = await import('../app/api/stock-game/audit/route');
    const auditRes = await auditRoute.POST(
      new Request('http://localhost/api/stock-game/audit', {
        method: 'POST',
        body: JSON.stringify({ classroomCode: classroom.code }),
      }),
    );

    expect(auditRes.status).toBe(200);
    const auditPayload = (await auditRes.json()) as {
      classroomCode: string;
      studentCount: number;
      activeSessionCount: number;
      tradeCount: number;
      topSymbols: Array<{ symbol: string; trades: number }>;
      piiIncluded: boolean;
    };

    expect(auditPayload.classroomCode).toBe(classroom.code);
    expect(auditPayload.studentCount).toBe(1);
    expect(auditPayload.activeSessionCount).toBe(0);
    expect(auditPayload.tradeCount).toBe(0);
    expect(auditPayload.topSymbols).toEqual([]);
    expect(auditPayload.piiIncluded).toBe(false);
  });
});
