import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/RevFedGame', () => ({
  default: () => <div data-testid="fed-game-stub">Fed Game Stub</div>,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Fed simulator page', () => {
  it('renders the fed game component inside a main element', async () => {
    const fedPageModule = await import('../app/fed-simulator/page');
    const FedGamePage = fedPageModule.default;

    const html = renderToStaticMarkup(<FedGamePage />);

    expect(html).toContain('<main');
    expect(html).toContain('data-testid="fed-game-stub"');
  });
});
