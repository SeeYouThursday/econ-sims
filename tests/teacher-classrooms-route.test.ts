import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentTeacherUserId = 'teacher_123';

describe('teacher classroom routes', () => {
  beforeEach(async () => {
    currentTeacherUserId = 'teacher_123';
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: currentTeacherUserId })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: currentTeacherUserId,
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
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
      startingCash: number;
      durationDays: number;
    };
    expect(created.title).toBe('Period 3 Economics');
    expect(created.code).toHaveLength(6);
    expect(created.startingCash).toBe(10000);
    expect(created.durationDays).toBe(30); // default

    const listRes = await classroomsRoute.GET();
    expect(listRes.status).toBe(200);

    const classrooms = (await listRes.json()) as Array<{
      code: string;
      title: string;
      startingCash: number;
      durationDays: number;
    }>;
    expect(classrooms).toHaveLength(1);
    expect(classrooms[0]?.code).toBe(created.code);
    expect(classrooms[0]?.startingCash).toBe(10000);
    expect(classrooms[0]?.durationDays).toBe(30);
  });

  it('allows setting and updating classroom starting cash and applies it to new students', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Period 1 Economics',
          startingCash: 25000,
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      code: string;
      startingCash: number;
    };
    expect(created.startingCash).toBe(25000);

    const createStudentRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: created.code,
          username: 'student_cash_1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createStudentRes.status).toBe(201);
    const createdStudent = (await createStudentRes.json()) as {
      startingCash: number;
    };
    expect(createdStudent.startingCash).toBe(25000);

    const updateRes = await classroomsRoute.PATCH(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: created.code,
          startingCash: 5000,
        }),
      }),
    );

    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { startingCash: number };
    expect(updated.startingCash).toBe(5000);

    const createStudentRes2 = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: created.code,
          username: 'student_cash_2',
          studentPasscode: 'pass5678',
        }),
      }),
    );

    expect(createStudentRes2.status).toBe(201);
    const createdStudent2 = (await createStudentRes2.json()) as {
      startingCash: number;
    };
    expect(createdStudent2.startingCash).toBe(5000);
  });

  it('lets a signed-in teacher create a student in an owned classroom without a shared passcode', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');

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
          studentPasscode: '=SUM(1,1)',
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
    expect('studentPasscode' in (rosterPayload.students[0] ?? {})).toBe(false);
    expect(rosterPayload.piiIncluded).toBe(false);

    const studentLoginRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_a1',
          studentPasscode: '=SUM(1,1)',
        }),
      }),
    );

    expect(studentLoginRes.status).toBe(200);
    const studentLoginPayload = (await studentLoginRes.json()) as {
      classroomCode: string;
      username: string;
      token: string;
    };
    expect(studentLoginPayload.classroomCode).toBe(classroom.code);
    expect(studentLoginPayload.username).toBe('student_a1');
    expect(studentLoginPayload.token).toBeTypeOf('string');

    const exportRes = await studentsRoute.GET(
      new Request(
        `http://localhost/api/stock-game/students?classroomCode=${classroom.code}&format=csv`,
      ),
    );

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('text/csv');
    const csvBody = await exportRes.text();
    expect(csvBody).toContain('classroomCode,alias,passcode,active,createdAt');
    expect(csvBody).toContain(
      `${classroom.code},student_a1,"'=SUM(1,1)",true,`,
    );

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
    expect(auditPayload.activeSessionCount).toBe(1);
    expect(auditPayload.tradeCount).toBe(0);
    expect(auditPayload.topSymbols).toEqual([]);
    expect(auditPayload.piiIncluded).toBe(false);
  });

  it('rejects student creation when a different signed-in teacher uses another classroom code', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createClassroomRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Original Teacher Class' }),
      }),
    );
    expect(createClassroomRes.status).toBe(201);
    const classroom = (await createClassroomRes.json()) as { code: string };

    currentTeacherUserId = 'teacher_456';

    const createStudentRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_cross_1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createStudentRes.status).toBe(403);
    await expect(createStudentRes.json()).resolves.toEqual({
      error: 'Teacher does not own this classroom.',
    });
  });

  it('treats repeated student deletes as successful for teacher workflows', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createClassroomRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Period 5 Economics' }),
      }),
    );
    const classroom = (await createClassroomRes.json()) as { code: string };

    const createStudentRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_b1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createStudentRes.status).toBe(201);

    const deleteRes = await studentsRoute.DELETE(
      new Request('http://localhost/api/stock-game/students', {
        method: 'DELETE',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_b1',
        }),
      }),
    );
    expect(deleteRes.status).toBe(200);

    const deleteAgainRes = await studentsRoute.DELETE(
      new Request('http://localhost/api/stock-game/students', {
        method: 'DELETE',
        body: JSON.stringify({
          classroomCode: classroom.code,
          username: 'student_b1',
        }),
      }),
    );

    expect(deleteAgainRes.status).toBe(200);
    const deleteAgainPayload = (await deleteAgainRes.json()) as {
      classroomCode: string;
      username: string;
      deleted: boolean;
    };
    expect(deleteAgainPayload.classroomCode).toBe(classroom.code);
    expect(deleteAgainPayload.username).toBe('student_b1');
    expect(deleteAgainPayload.deleted).toBe(true);
  });

  it('supports bulk student creation in a single POST request', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createClassroomRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Period 2 Economics' }),
      }),
    );
    const classroom = (await createClassroomRes.json()) as { code: string };

    const bulkCreateRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          students: [
            { username: 'brave_otter42', studentPasscode: 'AB7K9Q2M' },
            { username: 'quick_fox77', studentPasscode: 'J9LM7P2R' },
            { username: 'wise_lynx84', studentPasscode: 'Q8TR6V2N' },
          ],
        }),
      }),
    );

    expect(bulkCreateRes.status).toBe(201);
    const bulkPayload = (await bulkCreateRes.json()) as {
      classroomCode: string;
      createdCount: number;
      students: Array<{ username: string }>;
    };

    expect(bulkPayload.classroomCode).toBe(classroom.code);
    expect(bulkPayload.createdCount).toBe(3);
    expect(bulkPayload.students).toHaveLength(3);

    const rosterRes = await studentsRoute.GET(
      new Request(
        `http://localhost/api/stock-game/students?classroomCode=${classroom.code}`,
      ),
    );
    expect(rosterRes.status).toBe(200);

    const rosterPayload = (await rosterRes.json()) as {
      studentCount: number;
      students: Array<{ username: string }>;
    };
    expect(rosterPayload.studentCount).toBe(3);
    expect(rosterPayload.students.map((student) => student.username)).toEqual(
      expect.arrayContaining(['brave_otter42', 'quick_fox77', 'wise_lynx84']),
    );
  });

  it('supports reset-all classroom action for teacher-owned classes', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createClassroomRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Period 4 Economics',
          startingCash: 7500,
        }),
      }),
    );
    const classroom = (await createClassroomRes.json()) as { code: string };

    const bulkCreateRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: classroom.code,
          students: [
            { username: 'alpha_otter41', studentPasscode: 'AB7K9Q2M' },
            { username: 'bravo_lynx84', studentPasscode: 'J9LM7P2R' },
          ],
        }),
      }),
    );
    expect(bulkCreateRes.status).toBe(201);

    const resetAllRes = await studentsRoute.PATCH(
      new Request('http://localhost/api/stock-game/students', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: classroom.code,
          action: 'reset-all',
        }),
      }),
    );

    expect(resetAllRes.status).toBe(200);
    const resetPayload = (await resetAllRes.json()) as {
      classroomCode: string;
      action: string;
      studentCount: number;
      startingCash: number;
    };

    expect(resetPayload.classroomCode).toBe(classroom.code);
    expect(resetPayload.action).toBe('reset-all');
    expect(resetPayload.studentCount).toBe(2);
    expect(resetPayload.startingCash).toBe(7500);
  });

  it('supports creating classrooms with custom duration days', async () => {
    const classroomsRoute = await import('../app/api/teacher/classrooms/route');

    const createRes = await classroomsRoute.POST(
      new Request('http://localhost/api/teacher/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Summer Intensive',
          startingCash: 15000,
          durationDays: 60,
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      code: string;
      title: string;
      startingCash: number;
      durationDays: number;
    };
    expect(created.title).toBe('Summer Intensive');
    expect(created.startingCash).toBe(15000);
    expect(created.durationDays).toBe(60);

    const listRes = await classroomsRoute.GET();
    expect(listRes.status).toBe(200);
    const classrooms = (await listRes.json()) as Array<{
      code: string;
      durationDays: number;
    }>;
    const foundClassroom = classrooms.find((c) => c.code === created.code);
    expect(foundClassroom?.durationDays).toBe(60);
  });
});
