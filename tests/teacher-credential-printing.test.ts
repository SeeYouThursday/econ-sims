import { describe, expect, it, vi } from 'vitest';
import { writeAndPrintCredentialCards } from '../lib/teacherCredentialExports';

type MockPopup = Pick<Window, 'document' | 'location' | 'focus' | 'print'>;
type MockDocument = Pick<Document, 'open' | 'write' | 'close'>;

describe('teacher credential printing', () => {
  it('writes printable html and triggers focus + print after the popup loads', () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const addEventListener = vi.fn(
      ((event: string, handler: () => void) => {
        listeners.set(event, handler);
      }) as (event: string, listener: () => void) => void,
    );
    const removeEventListener = vi.fn(
      ((event: string) => {
        listeners.delete(event);
      }) as (event: string, listener: () => void) => void,
    );

    const popup: MockPopup & {
      addEventListener: (event: string, listener: () => void) => void;
      removeEventListener: (event: string, listener: () => void) => void;
    } = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      } as unknown as MockDocument as Document,
      location: { href: '' } as Location,
      focus: vi.fn(),
      print: vi.fn(),
      addEventListener,
      removeEventListener,
    };

    writeAndPrintCredentialCards(
      popup,
      'ABC123',
      [{ alias: 'brave_otter42', passcode: 'AB7K9Q2M' }],
      400,
    );

    expect(popup.document.open).toHaveBeenCalledOnce();
    expect(popup.document.write).toHaveBeenCalledOnce();
    expect(popup.document.close).toHaveBeenCalledOnce();
    expect(popup.focus).not.toHaveBeenCalled();
    expect(popup.print).not.toHaveBeenCalled();

    listeners.get('load')?.();

    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(popup.removeEventListener).toHaveBeenCalledWith(
      'load',
      expect.any(Function),
    );

    vi.useRealTimers();
  });

  it('falls back to blob navigation and prints after the popup loads', () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const addEventListener = vi.fn(
      ((event: string, handler: () => void) => {
        listeners.set(event, handler);
      }) as (event: string, listener: () => void) => void,
    );
    const removeEventListener = vi.fn(
      ((event: string) => {
        listeners.delete(event);
      }) as (event: string, listener: () => void) => void,
    );

    const popup: MockPopup & {
      addEventListener: (event: string, listener: () => void) => void;
      removeEventListener: (event: string, listener: () => void) => void;
    } = {
      document: {
        open: vi.fn(() => {
          throw new Error('blocked');
        }),
        write: vi.fn(),
        close: vi.fn(),
      } as unknown as MockDocument as Document,
      location: { href: '' } as Location,
      focus: vi.fn(),
      print: vi.fn(),
      addEventListener,
      removeEventListener,
    };

    const createObjectURL = vi.fn(() => 'blob:cards');
    const revokeObjectURL = vi.fn();

    writeAndPrintCredentialCards(
      popup,
      'ABC123',
      [{ alias: 'brave_otter42', passcode: 'AB7K9Q2M' }],
      400,
      setTimeout,
      { createObjectURL, revokeObjectURL },
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(popup.location.href).toBe('blob:cards');
    expect(popup.print).not.toHaveBeenCalled();

    listeners.get('load')?.();

    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cards');

    vi.useRealTimers();
  });
});
