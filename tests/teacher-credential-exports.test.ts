import { describe, expect, it } from 'vitest';
import {
  buildCredentialCardsHtml,
  toCredentialsCsv,
} from '../lib/teacherCredentialExports';

describe('teacher credential exports', () => {
  it('builds csv rows for generated credentials', () => {
    const csv = toCredentialsCsv('ABC123', [
      { alias: 'brave_otter42', passcode: 'AB7K9Q2M' },
      { alias: 'quick_fox77', passcode: 'J9LM7P2R' },
    ]);

    expect(csv).toContain('classroomCode,alias,passcode');
    expect(csv).toContain('ABC123,brave_otter42,AB7K9Q2M');
    expect(csv).toContain('ABC123,quick_fox77,J9LM7P2R');
  });

  it('renders printable card html and escapes unsafe values', () => {
    const html = buildCredentialCardsHtml('ABC<123>', [
      { alias: 'alpha<script>', passcode: 'PA55<CODE>' },
    ]);

    expect(html).toContain('Student Credential Cards');
    expect(html).toContain('ABC&lt;123&gt;');
    expect(html).toContain('alpha&lt;script&gt;');
    expect(html).toContain('PA55&lt;CODE&gt;');
  });
});
