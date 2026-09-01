import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * The customer-facing account number.
 *
 * It identifies an account; it never authorises anything. Every admin action
 * that takes one still re-checks the caller's session role on the server, so
 * knowing somebody's id grants nothing.
 *
 * The alphabet drops 0/O, 1/I/L and U so an id read over the phone or copied
 * off a screenshot cannot be mistyped into a different account. Eight
 * characters over 30 symbols is ~6.5e11 combinations.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 8;

export function randomPublicId(): string {
  let id = "";
  for (let i = 0; i < LENGTH; i += 1) id += ALPHABET[randomInt(ALPHABET.length)];
  return id;
}

/**
 * Normalises whatever an admin pasted into the search box, so lowercase input,
 * stray spaces and dashes still find the account.
 *
 * There is no lookalike remapping to do: the ambiguous characters are excluded
 * from ALPHABET, so a real id never contains one and anything containing one
 * simply will not match.
 */
export function normalisePublicId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

/** Allocates an id that is not already taken. The unique index is the backstop. */
export async function generateUniquePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomPublicId();
    const taken = await prisma.user.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("could not allocate a unique public id");
}
