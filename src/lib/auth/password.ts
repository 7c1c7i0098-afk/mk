import { compare, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

/**
 * Password policy: at least 8 characters containing a letter and a digit.
 * Kept deliberately reasonable — long passphrases pass without symbol rules.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  if (!/[A-Za-z؀-ۿ]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل";
  }
  if (!/\d/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  }
  return null;
}
