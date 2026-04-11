import { describe, expect, it } from 'vitest';
import {
  parseCredentialCsv,
  sanitizeClassroomCodeForFilename,
} from '../lib/studentCredentialCsv';

describe('student credential csv helpers', () => {
  it('parses quoted CSV fields correctly', () => {
    const csv = [
      'classroomCode,alias,passcode,active,createdAt',
      'ABC123,"student,1","""=SUM(1,1)",true,2026-01-01T00:00:00.000Z',
    ].join('\n');

    expect(parseCredentialCsv(csv)).toEqual([
      {
        alias: 'student,1',
        passcode: '"=SUM(1,1)',
      },
    ]);
  });

  it('parses multiline quoted passcode fields', () => {
    const csv = [
      'classroomCode,alias,passcode,active,createdAt',
      'ABC123,student_2,"line1\nline2",true,2026-01-01T00:00:00.000Z',
    ].join('\n');

    expect(parseCredentialCsv(csv)).toEqual([
      {
        alias: 'student_2',
        passcode: 'line1\nline2',
      },
    ]);
  });

  it('sanitizes classroom code for browser download filenames', () => {
    expect(sanitizeClassroomCodeForFilename('ABC_123-XY')).toBe('abc_123-xy');
    expect(sanitizeClassroomCodeForFilename('ABC"\r\nX')).toBe('classroom');
    expect(sanitizeClassroomCodeForFilename('with space')).toBe('classroom');
  });
});
