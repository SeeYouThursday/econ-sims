import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import YearSummary from '../../components/YearSummary';

describe('YearSummary', () => {
  it('renders the year number', () => {
    render(
      <YearSummary
        currentYear={2}
        quarterCount={3}
        summary="Year 2 has completed 3 quarters."
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders the quarter count as N/4', () => {
    render(
      <YearSummary
        currentYear={1}
        quarterCount={2}
        summary="Q2 done."
      />,
    );
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('renders the summary text', () => {
    const summary = 'Year 3 has completed 1 quarter.';
    render(
      <YearSummary currentYear={3} quarterCount={1} summary={summary} />,
    );
    expect(screen.getByText(summary)).toBeInTheDocument();
  });

  it('renders inflation percentage when startInflation is provided', () => {
    render(
      <YearSummary
        currentYear={1}
        quarterCount={1}
        summary="Start."
        startInflation={3.14}
      />,
    );
    expect(screen.getByText('3.14%')).toBeInTheDocument();
  });

  it('renders a dash when startInflation is undefined', () => {
    render(
      <YearSummary currentYear={1} quarterCount={1} summary="Start." />,
    );
    // Two dashes expected: one for Inflation, one for Jobs
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders unemployment percentage when startUnemployment is provided', () => {
    render(
      <YearSummary
        currentYear={1}
        quarterCount={1}
        summary="Start."
        startUnemployment={5.0}
      />,
    );
    expect(screen.getByText('5.00%')).toBeInTheDocument();
  });

  it('renders the "Year summary" label', () => {
    render(
      <YearSummary currentYear={1} quarterCount={1} summary="Hello." />,
    );
    expect(screen.getByText(/year summary/i)).toBeInTheDocument();
  });
});
