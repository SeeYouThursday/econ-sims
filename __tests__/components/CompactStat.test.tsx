import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompactStat from '../../components/CompactStat';

describe('CompactStat', () => {
  it('renders the title text', () => {
    render(
      <CompactStat title="INFLATION" val={3.2} color="bg-red-500" icon={null} />,
    );
    expect(screen.getByText(/INFLATION/i)).toBeInTheDocument();
  });

  it('formats the value to one decimal place with a percent sign', () => {
    render(
      <CompactStat title="UNEMPLOYMENT" val={4.756} color="bg-blue-600" icon={null} />,
    );
    expect(screen.getByText('4.8%')).toBeInTheDocument();
  });

  it('renders zero value correctly', () => {
    render(<CompactStat title="RATE" val={0} color="bg-slate-500" icon={null} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('applies the provided color class to the container', () => {
    const { container } = render(
      <CompactStat title="RATE" val={5.0} color="bg-green-500" icon={null} />,
    );
    expect(container.firstChild).toHaveClass('bg-green-500');
  });

  it('renders the icon when provided', () => {
    render(
      <CompactStat
        title="TEST"
        val={1.0}
        color="bg-gray-400"
        icon={<span data-testid="custom-icon">★</span>}
      />,
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
