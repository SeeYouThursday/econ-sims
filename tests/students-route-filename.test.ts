import { describe, expect, it } from 'vitest';
import { buildStudentsCsvFilename } from '../app/api/stock-game/students/route';

describe('students csv filename', () => {
  it('uses classroom code when it matches the filename allowlist', () => {
    expect(buildStudentsCsvFilename('ABC_123-XY')).toBe(
      'abc_123-xy-student-credentials.csv',
    );
  });

  it('falls back to a constant filename for unsafe classroom codes', () => {
    expect(buildStudentsCsvFilename('ABC"\r\nX')).toBe(
      'student-credentials.csv',
    );
    expect(buildStudentsCsvFilename('=evil')).toBe('student-credentials.csv');
    expect(buildStudentsCsvFilename('class room')).toBe(
      'student-credentials.csv',
    );
  });
});
