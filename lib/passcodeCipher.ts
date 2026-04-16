import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function getPrimaryPasscodeEncryptionSecret() {
  return process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY?.trim() ?? '';
}

function derivePasscodeEncryptionKey(secret: string) {
  if (!secret) {
    return null;
  }

  return createHash('sha256').update(secret).digest();
}

function getDecryptablePasscodeSecrets() {
  const primarySecret = getPrimaryPasscodeEncryptionSecret();
  const legacyDatabaseSecret = process.env.DATABASE_URL?.trim() ?? '';

  return [primarySecret, legacyDatabaseSecret].filter(
    (secret, index, array) => secret.length > 0 && array.indexOf(secret) === index,
  );
}

export function hasRecoverablePasscodeEncryptionKey() {
  return getPrimaryPasscodeEncryptionSecret().length > 0;
}

export function encryptRecoverablePasscode(passcode: string) {
  const key = derivePasscodeEncryptionKey(getPrimaryPasscodeEncryptionSecret());
  if (!key) {
    return null;
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(passcode, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptRecoverablePasscode(ciphertext: string | null) {
  if (!ciphertext) {
    return null;
  }

  const buffer = Buffer.from(ciphertext, 'base64');
  if (buffer.length <= IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    return null;
  }

  const iv = buffer.subarray(0, IV_LENGTH_BYTES);
  const authTag = buffer.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const encrypted = buffer.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  for (const secret of getDecryptablePasscodeSecrets()) {
    const key = derivePasscodeEncryptionKey(secret);
    if (!key) {
      continue;
    }

    try {
      const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      continue;
    }
  }

  return null;
}
