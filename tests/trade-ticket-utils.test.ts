import { describe, expect, it } from 'vitest';
import {
  buildTradeSubmission,
  calculateEstimatedOrderValue,
  normalizeTradeSymbol,
} from '../components/student-game/tradeTicketUtils';

describe('trade ticket utils', () => {
  it('normalizes trade symbols to uppercase trimmed values', () => {
    expect(normalizeTradeSymbol(' aapl ')).toBe('AAPL');
  });

  it('uses the fetched quote price when building a trade submission', () => {
    const result = buildTradeSubmission({
      symbol: ' aapl ',
      side: 'buy',
      shares: '3',
      quote: {
        symbol: 'AAPL',
        latestPrice: 205.32,
        asOf: '2026-04-07',
      },
    });

    expect(result).toEqual({
      symbol: 'AAPL',
      side: 'buy',
      shares: 3,
    });
  });

  it('calculates estimated order value from shares and fetched quote', () => {
    const total = calculateEstimatedOrderValue('4', {
      symbol: 'MSFT',
      latestPrice: 125.5,
      asOf: '2026-04-07',
    });

    expect(total).toBe(502);
  });

  it('returns null estimated value when no quote is loaded', () => {
    expect(calculateEstimatedOrderValue('4', null)).toBeNull();
  });
});
