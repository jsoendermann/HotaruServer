import { randomBytes } from 'crypto';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export default function freshId(length: number = 15): string {
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
