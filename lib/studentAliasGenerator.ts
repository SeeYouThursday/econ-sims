const SAFE_ALIAS_ADJECTIVES = [
  'brave',
  'calm',
  'clever',
  'curious',
  'eager',
  'gentle',
  'happy',
  'kind',
  'lively',
  'merry',
  'nimble',
  'quick',
  'steady',
  'sunny',
  'wise',
] as const;

const SAFE_ALIAS_ANIMALS = [
  'otter',
  'panda',
  'falcon',
  'badger',
  'rabbit',
  'fox',
  'lynx',
  'koala',
  'turtle',
  'dolphin',
  'heron',
  'gecko',
  'wombat',
  'walrus',
] as const;

function pickRandom<T>(items: readonly T[], random: () => number) {
  const index = Math.floor(random() * items.length);
  return items[index] ?? items[0];
}

const PASSCODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateStudentAlias(random: () => number = Math.random) {
  const adjective = pickRandom(SAFE_ALIAS_ADJECTIVES, random);
  const animal = pickRandom(SAFE_ALIAS_ANIMALS, random);
  const suffix = 10 + Math.floor(random() * 90);
  return `${adjective}_${animal}${suffix}`;
}

export function generateStudentPasscode(
  length = 8,
  random: () => number = Math.random,
) {
  const normalizedLength = Math.max(4, Math.min(16, Math.trunc(length)));
  let passcode = '';

  for (let index = 0; index < normalizedLength; index += 1) {
    const randomIndex = Math.floor(random() * PASSCODE_ALPHABET.length);
    passcode += PASSCODE_ALPHABET[randomIndex] ?? PASSCODE_ALPHABET[0];
  }

  return passcode;
}
