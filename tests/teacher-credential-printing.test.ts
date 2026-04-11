import { describe, expect, it, vi } from 'vitest';
import { writeAndPrintCredentialCards } from '../lib/teacherCredentialExports';

describe('teacher credential printing', () => {
  it('writes printable html and triggers focus + print on delay', () => {
    vi.useFakeTimers();

    const popup = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };

    writeAndPrintCredentialCards(
      popup as unknown as Pick<Window, 'document' | 'focus' | 'print'>,
      'ABC123',
      [{ alias: 'brave_otter42', passcode: 'AB7K9Q2M' }],
      400,
    );

    expect(popup.document.open).toHaveBeenCalledOnce();
    expect(popup.document.write).toHaveBeenCalledOnce();
    expect(popup.document.close).toHaveBeenCalledOnce();
    expect(popup.focus).not.toHaveBeenCalled();
    expect(popup.print).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);

    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('falls back to blob navigation when popup document writing fails', () => {
    vi.useFakeTimers();

    const popup = {
      document: {
        open: vi.fn(() => {
          throw new Error('blocked');
        }),
        write: vi.fn(),
        close: vi.fn(),
      },
      location: { href: '' },
      focus: vi.fn(),
      print: vi.fn(),
    };

    const createObjectURL = vi.fn(() => 'blob:cards');
    const revokeObjectURL = vi.fn();

    writeAndPrintCredentialCards(
      popup as unknown as Pick<
        Window,
        'document' | 'location' | 'focus' | 'print'
      >,
      'ABC123',
      [{ alias: 'brave_otter42', passcode: 'AB7K9Q2M' }],
      400,
      setTimeout,
      { createObjectURL, revokeObjectURL },
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(popup.location.href).toBe('blob:cards');

    vi.advanceTimersByTime(650);

    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cards');

    vi.useRealTimers();
  });
});
