import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportCard from '../../components/ReportCard';
import type { EconomicData } from '../../types';

// ---------------------------------------------------------------------------
// Helpers to build history arrays producing specific average errors
// ---------------------------------------------------------------------------

/** Build a history array where every quarter has exactly the target values. */
function makeHistory(inf: number, unp: number, length = 16): EconomicData[] {
  return Array.from({ length }, (_, i) => ({
    q: i + 1,
    inf,
    unp,
    rate: 4.0,
  }));
}

describe('ReportCard', () => {
  it('awards grade A for total error < 1.2 (perfect policy)', () => {
    // avgInf = 2.0, avgUnp = 5.0 → totalError = 0
    const history = makeHistory(2.0, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Economic Legend')).toBeInTheDocument();
  });

  it('awards grade B for total error between 1.2 and 2.5', () => {
    // avgInf = 3.5 (error 1.5) + avgUnp = 5.0 (error 0) → totalError = 1.5
    const history = makeHistory(3.5, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('Steady Hand')).toBeInTheDocument();
  });

  it('awards grade C for total error between 2.5 and 4.0', () => {
    // avgInf = 5.0 (error 3.0) + avgUnp = 5.0 (error 0) → totalError = 3.0
    const history = makeHistory(5.0, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('The Survivor')).toBeInTheDocument();
  });

  it('awards grade F for total error >= 4.0', () => {
    // avgInf = 7.0 (error 5.0) + avgUnp = 5.0 (error 0) → totalError = 5.0
    const history = makeHistory(7.0, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('Term Expired')).toBeInTheDocument();
  });

  it('displays the average inflation percentage', () => {
    const history = makeHistory(3.0, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    // avgInf = 3.0 → displayed as "3.0%"
    expect(screen.getByText('3.0%')).toBeInTheDocument();
  });

  it('displays the average unemployment percentage', () => {
    const history = makeHistory(2.0, 6.5);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    // avgUnp = 6.5 → displayed as "6.5%"
    expect(screen.getByText('6.5%')).toBeInTheDocument();
  });

  it('calls onRestart when "Try Again" is clicked', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    const history = makeHistory(2.0, 5.0);
    render(<ReportCard history={history} onRestart={onRestart} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('handles a single-entry history without crashing', () => {
    const history: EconomicData[] = [{ q: 1, inf: 2.0, unp: 5.0, rate: 4.0 }];
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('grade boundary: error exactly at 1.2 awards B (not A)', () => {
    // totalError = 1.2: avgInf = 3.2, avgUnp = 5.0 → |3.2-2.0| + |5.0-5.0| = 1.2
    const history = makeHistory(3.2, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('grade boundary: error exactly at 2.5 awards C (not B)', () => {
    // totalError = 2.5: avgInf = 4.5, avgUnp = 5.0 → |4.5-2.0| + 0 = 2.5
    const history = makeHistory(4.5, 5.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('grade boundary: error exactly at 4.0 awards F (not C)', () => {
    // totalError = 4.0: avgInf = 2.0, avgUnp = 9.0 → 0 + |9.0-5.0| = 4.0
    const history = makeHistory(2.0, 9.0);
    render(<ReportCard history={history} onRestart={vi.fn()} />);
    expect(screen.getByText('F')).toBeInTheDocument();
  });
});
