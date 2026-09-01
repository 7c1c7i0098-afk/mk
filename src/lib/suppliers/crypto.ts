import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Envelope encryption for supplier credentials.
 *
 * API keys are the one class of data in PLUS CARD that is neither hashed (we
 * must be able to replay them) nor safe in the clear (a database copy would
 * hand an attacker every supplier account). They are sealed here with
 * AES-256-GCM and only ever opened server-side, inside the request that is
 * about to call the supplier.
 *
 * `server-only` at the top is deliberate: importing this file from a client
 * component is a build error, not a runtime surprise.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";
/** Fixed, non-secret salt — the secrecy lives entirely in the key material. */
const KEY_SALT = "pluscard.supplier.credentials.v1";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const material = process.env.SUPPLIER_ENCRYPTION_KEY || process.env.AUTH_SECRET;

  if (!material || material.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SUPPLIER_ENCRYPTION_KEY (or AUTH_SECRET) must be at least 32 characters in production.",
      );
    }
    cachedKey = scryptSync("pluscard-development-secret-key-0001", KEY_SALT, 32);
    return cachedKey;
  }

  cachedKey = scryptSync(material, KEY_SALT, 32);
  return cachedKey;
}

/** Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const sealed = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    sealed.toString("base64url"),
  ].join(".");
}

/**
 * Opens an envelope. Returns null for anything that does not decrypt cleanly —
 * a rotated key, a truncated column, a tampered row — so a bad secret degrades
 * into "this supplier cannot authenticate" instead of throwing into a page.
 */
export function decryptSecret(envelope: string | null | undefined): string | null {
  if (!envelope) return null;

  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const sealed = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;

    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(sealed), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * A stable, non-reversible fingerprint an admin can use to confirm *which*
 * key is stored without the key itself ever coming back to the browser.
 */
export function secretHint(plaintext: string): string {
  if (!plaintext) return "";
  const digest = createHash("sha256").update(plaintext).digest("hex");
  return `••••${digest.slice(0, 6)}`;
}

/** Constant-time compare, used when confirming a re-entered secret. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
