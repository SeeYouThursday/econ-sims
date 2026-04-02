import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/RevFedGame', () => ({
  default: () => <div data-testid="fed-game-stub">Fed Game Stub</div>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Fed simulator page', () => {
  it('renders student-mode heading and guidance controls with aria linkage', async () => {
    const module = await import('../app/fed-simulator/page');
    const FedGamePage = module.default;

    const html = renderToStaticMarkup(<FedGamePage />);

    expect(html).toContain('Student mode: jump straight into the game');
    expect(html).toContain('Show student guidance');
    expect(html).toContain('aria-controls="student-guidance-panel"');
    expect(html).toContain('id="student-guidance-panel"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Student guidance"');
    expect(html).toContain('aria-expanded="false"');
  });
});
