import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdvisorPanel from '../../components/AdvisorPanel';

describe('AdvisorPanel', () => {
  it('renders the toggle button', () => {
    render(
      <AdvisorPanel showHints={true} advice="Keep rates steady." onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /advisor advice/i })).toBeInTheDocument();
  });

  it('shows the advice text when showHints is true', () => {
    render(
      <AdvisorPanel showHints={true} advice="Raise rates!" onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Raise rates!')).toBeInTheDocument();
  });

  it('hides the advice text when showHints is false', () => {
    render(
      <AdvisorPanel showHints={false} advice="Raise rates!" onToggle={vi.fn()} />,
    );
    expect(screen.queryByText('Raise rates!')).not.toBeInTheDocument();
  });

  it('calls onToggle when the button is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<AdvisorPanel showHints={true} advice="Some advice" onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: /advisor advice/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('updates shown advice text when the prop changes', () => {
    const { rerender } = render(
      <AdvisorPanel showHints={true} advice="First advice" onToggle={vi.fn()} />,
    );
    expect(screen.getByText('First advice')).toBeInTheDocument();

    rerender(
      <AdvisorPanel showHints={true} advice="Updated advice" onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Updated advice')).toBeInTheDocument();
    expect(screen.queryByText('First advice')).not.toBeInTheDocument();
  });
});
