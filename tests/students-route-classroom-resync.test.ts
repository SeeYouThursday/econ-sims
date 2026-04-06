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
    }));

    vi.doMock('@/lib/teacherStore', () => ({
      assertTeacherOwnsClassroom: vi.fn(async () => ({
        code: 'ABC123',
        title: 'Period 1',
      })),
    }));

    vi.doMock('@/lib/stockGameStore', () => ({
      createStudent,
      deleteStudent: vi.fn(),
      ensureTeacherClassroom,
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

    expect(response.status).toBe(201);
    expect(createStudent).toHaveBeenCalledTimes(2);
    expect(ensureTeacherClassroom).toHaveBeenCalledTimes(2);
  });
});
