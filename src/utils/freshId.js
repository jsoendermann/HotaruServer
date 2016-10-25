import { randomBytes } from 'crypto';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function freshId(length = 15) { // eslint-disable-line import/prefer-default-export
  if (length < 1) {
    throw new Error('Ids must be at least one character long');
  }

  let id = '';

  const random = randomBytes(length);

  let cursor = 0;
  for (let i = 0; i < length; i += 1) {
    cursor += random[i];
    id += ALPHANUM[cursor % ALPHANUM.length];
  }

  return id;
}
