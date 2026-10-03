import bcrypt from 'bcryptjs';

const COST = 12;

/** bcrypt, cost 12 (architecture §5). Pure JavaScript — no native build in Alpine. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
