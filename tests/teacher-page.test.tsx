import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('Teacher page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('renders setup guidance when Clerk is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;

    const teacherPageModule = await import('../app/teacher/page');
    const TeacherPage = teacherPageModule.default;

    const html = renderToStaticMarkup(await TeacherPage());

    expect(html).toContain('Clerk setup is still required.');
    expect(html).toContain('Teacher dashboard');
  });
});
