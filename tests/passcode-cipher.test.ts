import { afterEach, describe, expect, it, vi } from 'vitest';

describe('passcode cipher', () => {
  const originalEncryptionKey =
    process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY;
    } else {
      process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY = originalEncryptionKey;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    vi.resetModules();
  });

  it('round-trips a passcode with the dedicated encryption key', async () => {
    process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY =
      'test-passcode-key-1234567890';
    process.env.DATABASE_URL = 'postgres://unused-fallback';

    const { decryptRecoverablePasscode, encryptRecoverablePasscode } =
      await import('../lib/passcodeCipher');

    const ciphertext = encryptRecoverablePasscode('AB7K9Q2M');

    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toBe('AB7K9Q2M');
    expect(decryptRecoverablePasscode(ciphertext)).toBe('AB7K9Q2M');
  });

  it('can still decrypt ciphertext created with the legacy DATABASE_URL-derived secret', async () => {
    delete process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY;
    process.env.DATABASE_URL = 'postgres://legacy-secret';

    const crypto = await import('crypto');
    const legacyKey = crypto
      .createHash('sha256')
      .update('postgres://legacy-secret')
      .digest();
    const iv = Buffer.alloc(12, 7);
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    const encrypted = Buffer.concat([
      cipher.update('ZXCV1234', 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const legacyCiphertext = Buffer.concat([iv, authTag, encrypted]).toString(
      'base64',
    );

    process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY =
      'test-passcode-key-1234567890';

    const { decryptRecoverablePasscode } = await import('../lib/passcodeCipher');

    expect(decryptRecoverablePasscode(legacyCiphertext)).toBe('ZXCV1234');
  });

  it('returns null when no dedicated encryption key is configured', async () => {
    delete process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY;
    process.env.DATABASE_URL = 'postgres://still-not-good-enough';

    const { decryptRecoverablePasscode, encryptRecoverablePasscode } =
      await import('../lib/passcodeCipher');

    expect(encryptRecoverablePasscode('NOPE1234')).toBeNull();
    expect(decryptRecoverablePasscode('not-a-real-ciphertext')).toBeNull();
  });
});
