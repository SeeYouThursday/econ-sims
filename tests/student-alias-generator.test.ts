import { describe, expect, it } from 'vitest';
import {
  generateStudentAlias,
  generateStudentPasscode,
} from '../lib/studentAliasGenerator';

describe('student alias generator', () => {
  it('builds a safe alias with adjective_animal and numeric suffix', () => {
    const alias = generateStudentAlias();

    expect(alias).toMatch(/^[a-z]+_[a-z]+\d{2}$/);
    expect(alias.length).toBeGreaterThanOrEqual(3);
    expect(alias.length).toBeLessThanOrEqual(24);
  });

  it('always includes at least one number for server-side alias validation', () => {
    for (let index = 0; index < 50; index += 1) {
      const alias = generateStudentAlias();
      expect(/[0-9]/.test(alias)).toBe(true);
    }
  });

  it('generates passcodes with allowed uppercase letters and digits', () => {
    const passcode = generateStudentPasscode();

    expect(passcode).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('respects a custom passcode length within bounds', () => {
    const passcode = generateStudentPasscode(12);
    expect(passcode).toHaveLength(12);
  });
});
