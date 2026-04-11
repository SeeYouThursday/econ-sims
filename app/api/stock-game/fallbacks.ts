import { StockGameError } from '@/lib/stockGameStore';
import { listStudentAliasesByClassroom } from '@/lib/studentAliasStore';

const CLASSROOM_NOT_FOUND_MESSAGE = 'Classroom was not found.';

export function isClassroomNotFoundError(
  error: unknown,
): error is StockGameError {
  return (
    error instanceof StockGameError &&
    error.status === 404 &&
    error.message === CLASSROOM_NOT_FOUND_MESSAGE
  );
}

export function logStockGameFallback(
  scope: 'students' | 'audit',
  reason: string,
  details: Record<string, unknown>,
) {
  console.warn(`[stock-game][${scope}] fallback`, {
    reason,
    ...details,
  });
}

export async function safeListStudentAliasesWithFallback(
  scope: 'students' | 'audit',
  classroomCode: string,
) {
  try {
    return await listStudentAliasesByClassroom(classroomCode);
  } catch (error) {
    logStockGameFallback(scope, 'alias_registry_unavailable', {
      classroomCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      aliases: [],
      storage: 'memory' as const,
    };
  }
}
