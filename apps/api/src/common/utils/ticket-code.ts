import { randomBytes } from 'crypto';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateTicketCode(): string {
  const bytes = randomBytes(6);
  let suffix = '';
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length];
  return `TKT-${suffix}`;
}
