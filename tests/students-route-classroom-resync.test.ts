import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('students route classroom resync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  });

  it('re-syncs and retries once when classroom is missing during student creation', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    const ensureTeacherClassroom = vi.fn(async () => ({
      code: 'ABC123',
      ownerTeacherId: 'teacher_123',
    }));

    const createStudent = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new MockStockGameError('Classroom was not found.', 404);
      })
      .mockResolvedValue({
        studentId: 'student_1',
        classroomCode: 'ABC123',
        username: 'student_01',
      });

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent,
      createStudentsBatch: vi.fn(),
      deleteStudent: vi.fn(),
      ensureTeacherClassroom,
      listStudentsForClassroom: vi.fn(),
      manageClassroomStudents: vi.fn(),
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      verifyStudentAliasPasscodeStorage: vi.fn(),
      upsertStudentAlias: vi.fn(async () => undefined),
      upsertStudentAliasesBulk: vi.fn(async () => undefined),
      deleteStudentAlias: vi.fn(),
      setStudentAliasActive: vi.fn(),
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [],
        storage: 'neon',
      })),
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: 'ABC123',
          username: 'student_01',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createStudent).toHaveBeenCalledTimes(2);
    expect(ensureTeacherClassroom).toHaveBeenCalledTimes(2);
  });

  it('fails student creation when alias persistence fails', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    const deleteStudent = vi.fn(async () => ({
      classroomCode: 'ABC123',
      username: 'student_01',
      deleted: true,
      storage: 'memory',
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      verifyStudentAliasPasscodeStorage: vi.fn(),
      upsertStudentAlias: vi.fn(async () => {
        throw new MockStockGameError(
          'Unable to encrypt student passcode for storage.',
          500,
        );
      }),
      upsertStudentAliasesBulk: vi.fn(),
      deleteStudentAlias: vi.fn(),
      setStudentAliasActive: vi.fn(),
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [],
        storage: 'neon',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent: vi.fn(async () => ({
        studentId: 'student_1',
        classroomCode: 'ABC123',
        username: 'student_01',
        studentPasscode: 'pass1234',
        // startingCash is integer cents (AGENTS.md §3); 1_000_000 = $10,000.
        startingCash: 1_000_000,
        createdAt: '2026-01-01T00:00:00.000Z',
        storage: 'memory',
      })),
      createStudentsBatch: vi.fn(),
      deleteStudent,
      ensureTeacherClassroom: vi.fn(async () => ({
        code: 'ABC123',
        ownerTeacherId: 'teacher_123',
      })),
      listStudentsForClassroom: vi.fn(),
      manageClassroomStudents: vi.fn(),
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: 'ABC123',
          username: 'student_01',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to encrypt student passcode for storage.',
    });
    expect(deleteStudent).toHaveBeenCalledWith({
      classroomCode: 'ABC123',
      teacherPasscode: undefined,
      teacherUserId: 'teacher_123',
      username: 'student_01',
    });
  });

  it('returns an actionable error when credential storage is not configured', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      verifyStudentAliasPasscodeStorage: vi.fn(() => {
        throw new MockStockGameError(
          'Missing STOCK_GAME_PASSCODE_ENCRYPTION_KEY for student credential storage.',
          500,
        );
      }),
      upsertStudentAlias: vi.fn(),
      upsertStudentAliasesBulk: vi.fn(),
      deleteStudentAlias: vi.fn(),
      setStudentAliasActive: vi.fn(),
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [],
        storage: 'neon',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent: vi.fn(),
      createStudentsBatch: vi.fn(),
      deleteStudent: vi.fn(),
      ensureTeacherClassroom: vi.fn(async () => ({
        code: 'ABC123',
        ownerTeacherId: 'teacher_123',
      })),
      listStudentsForClassroom: vi.fn(),
      manageClassroomStudents: vi.fn(),
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: 'ABC123',
          username: 'student_01',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error:
        'Missing STOCK_GAME_PASSCODE_ENCRYPTION_KEY for student credential storage.',
    });
  });

  it('re-syncs and retries once when classroom is missing during roster load', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    const ensureTeacherClassroom = vi.fn(async () => ({
      code: 'ABC123',
      ownerTeacherId: 'teacher_123',
    }));

    const listStudentsForClassroom = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new MockStockGameError('Classroom was not found.', 404);
      })
      .mockResolvedValue({
        classroomCode: 'ABC123',
        studentCount: 0,
        students: [],
      });

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent: vi.fn(),
      deleteStudent: vi.fn(),
      ensureTeacherClassroom,
      listStudentsForClassroom,
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.GET(
      new Request(
        'http://localhost/api/stock-game/students?classroomCode=ABC123',
      ),
    );

    expect(response.status).toBe(200);
    expect(listStudentsForClassroom).toHaveBeenCalledTimes(2);
    expect(ensureTeacherClassroom).toHaveBeenCalledTimes(2);
  });

  it('re-syncs and retries once when classroom is missing during audit load', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    const ensureTeacherClassroom = vi.fn(async () => ({
      code: 'ABC123',
      ownerTeacherId: 'teacher_123',
    }));

    const getTeacherAudit = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new MockStockGameError('Classroom was not found.', 404);
      })
      .mockResolvedValue({
        classroomCode: 'ABC123',
        asOf: new Date().toISOString(),
        studentCount: 0,
        activeSessionCount: 0,
        tradeCount: 0,
        buyCount: 0,
        sellCount: 0,
        topSymbols: [],
      });

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      ensureTeacherClassroom,
      getTeacherAudit,
      StockGameError: MockStockGameError,
    }));

    const auditRoute = await import('../app/api/stock-game/audit/route');

    const response = await auditRoute.POST(
      new Request('http://localhost/api/stock-game/audit', {
        method: 'POST',
        body: JSON.stringify({ classroomCode: 'ABC123' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(getTeacherAudit).toHaveBeenCalledTimes(2);
    expect(ensureTeacherClassroom).toHaveBeenCalledTimes(2);
  });

  it('returns alias-based roster fallback and logs warning when stock roster remains unavailable', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    const ensureTeacherClassroom = vi.fn(async () => ({
      code: 'ABC123',
      ownerTeacherId: 'teacher_123',
    }));

    const listStudentsForClassroom = vi.fn(async () => {
      throw new MockStockGameError('Classroom was not found.', 404);
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // silence warning output in test logs
    });

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [
          {
            id: 'alias_1',
            classroomCode: 'ABC123',
            username: 'student_01',
            studentPasscode: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            isActive: true,
          },
        ],
        storage: 'neon',
      })),
      upsertStudentAlias: vi.fn(),
      deleteStudentAlias: vi.fn(),
      setStudentAliasActive: vi.fn(),
      verifyStudentAliasPasscodeStorage: vi.fn(),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent: vi.fn(),
      deleteStudent: vi.fn(),
      ensureTeacherClassroom,
      listStudentsForClassroom,
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.GET(
      new Request(
        'http://localhost/api/stock-game/students?classroomCode=ABC123',
      ),
    );

    expect(response.status).toBe(200);
    expect(listStudentsForClassroom).toHaveBeenCalledTimes(2);

    const payload = (await response.json()) as {
      studentCount: number;
      storage: string;
      students: Array<{
        username: string;
        cash: number;
        totalValue: number;
      }>;
    };

    expect(payload.studentCount).toBe(1);
    expect(payload.storage).toBe('neon');
    expect(payload.students[0]?.username).toBe('student_01');
    expect(payload.students[0]?.cash).toBe(0);
    expect(payload.students[0]?.totalValue).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[stock-game][students] fallback',
      expect.objectContaining({
        reason: 'stock_roster_unavailable',
        classroomCode: 'ABC123',
      }),
    );

    warnSpy.mockRestore();
  });

  it('returns alias-based audit fallback and logs warning when stock audit remains unavailable', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    const ensureTeacherClassroom = vi.fn(async () => ({
      code: 'ABC123',
      ownerTeacherId: 'teacher_123',
    }));

    const getTeacherAudit = vi.fn(async () => {
      throw new MockStockGameError('Classroom was not found.', 404);
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // silence warning output in test logs
    });

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [
          {
            id: 'alias_1',
            classroomCode: 'ABC123',
            username: 'student_01',
            studentPasscode: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            isActive: true,
          },
          {
            id: 'alias_2',
            classroomCode: 'ABC123',
            username: 'student_02',
            studentPasscode: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            isActive: true,
          },
        ],
        storage: 'neon',
      })),
      verifyStudentAliasPasscodeStorage: vi.fn(),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      ensureTeacherClassroom,
      getTeacherAudit,
      StockGameError: MockStockGameError,
    }));

    const auditRoute = await import('../app/api/stock-game/audit/route');

    const response = await auditRoute.POST(
      new Request('http://localhost/api/stock-game/audit', {
        method: 'POST',
        body: JSON.stringify({ classroomCode: 'ABC123' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(getTeacherAudit).toHaveBeenCalledTimes(2);

    const payload = (await response.json()) as {
      studentCount: number;
      storage: string;
      tradeCount: number;
    };

    expect(payload.studentCount).toBe(2);
    expect(payload.storage).toBe('neon');
    expect(payload.tradeCount).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[stock-game][audit] fallback',
      expect.objectContaining({
        reason: 'stock_audit_unavailable',
        classroomCode: 'ABC123',
      }),
    );

    warnSpy.mockRestore();
  });

  it('prefers alias-store passcodes when stock roster data is present', async () => {
    class MockStockGameError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.status = status;
      }
    }

    vi.doMock('@clerk/nextjs/server', () => ({
      auth: vi.fn(async () => ({ userId: 'teacher_123' })),
      clerkClient: vi.fn(async () => ({
        users: {
          getUser: vi.fn(async () => ({
            id: 'teacher_123',
            publicMetadata: {
              role: 'teacher',
              teacherApproved: true,
            },
          })),
        },
      })),
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/studentAliasStore', () => ({
      listStudentAliasesByClassroom: vi.fn(async () => ({
        aliases: [
          {
            id: 'alias_1',
            classroomCode: 'ABC123',
            username: 'student_01',
            studentPasscode: 'ALIAS999',
            createdAt: '2026-01-01T00:00:00.000Z',
            isActive: true,
          },
        ],
        storage: 'neon',
      })),
      verifyStudentAliasPasscodeStorage: vi.fn(),
      upsertStudentAlias: vi.fn(),
      upsertStudentAliasesBulk: vi.fn(),
      deleteStudentAlias: vi.fn(),
      setStudentAliasActive: vi.fn(),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent: vi.fn(),
      createStudentsBatch: vi.fn(),
      deleteStudent: vi.fn(),
      ensureTeacherClassroom: vi.fn(async () => ({
        code: 'ABC123',
        ownerTeacherId: 'teacher_123',
      })),
      listStudentsForClassroom: vi.fn(async () => ({
        classroomCode: 'ABC123',
        asOf: '2026-01-02T00:00:00.000Z',
        studentCount: 1,
        students: [
          {
            studentId: 'stock_1',
            username: 'student_01',
            studentPasscode: null,
            createdAt: '2026-01-02T00:00:00.000Z',
            isActive: true,
            cash: 1000,
            holdingsValue: 500,
            totalValue: 1500,
            hasActiveSession: false,
          },
        ],
        piiIncluded: true,
        storage: 'memory',
      })),
      manageClassroomStudents: vi.fn(),
      manageStudent: vi.fn(),
      StockGameError: MockStockGameError,
    }));

    const studentsRoute = await import('../app/api/stock-game/students/route');

    const response = await studentsRoute.GET(
      new Request(
        'http://localhost/api/stock-game/students?classroomCode=ABC123&format=csv',
      ),
    );

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain(
      'ABC123,student_01,ALIAS999,true,2026-01-02T00:00:00.000Z',
    );
  });
});
