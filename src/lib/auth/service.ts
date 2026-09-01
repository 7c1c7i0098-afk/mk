import { prisma } from "@/lib/db";
import { generateUniquePublicId } from "@/lib/public-id";

export type OAuthProfile = {
  provider: "google" | "apple";
  /** Stable provider subject id — never a display name. */
  providerAccountId: string;
  email: string | null;
  /** Whether the provider asserts that it verified this email address. */
  emailVerified: boolean;
  name: string | null;
  image: string | null;
};

/**
 * Resolves a federated identity to a PLUS CARD account.
 *
 * Order matters for safety:
 *   1. an existing link on (provider, providerAccountId) — the only stable key
 *   2. an existing local account with the same address, but ONLY when the
 *      provider verified that address; otherwise a stranger could claim it
 *   3. otherwise a fresh account
 */
export async function resolveOAuthUser(profile: OAuthProfile) {
  const linked = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: { user: true },
  });

  if (linked) return linked.user;

  const email = profile.email?.toLowerCase() ?? null;

  if (email && profile.emailVerified) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.authAccount.create({
        data: {
          userId: existing.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email,
        },
      });
      // A federated sign-in with a verified address also verifies the account.
      if (!existing.emailVerifiedAt) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: new Date(), image: existing.image ?? profile.image },
        });
      }
      return existing;
    }
  }

  // No trustworthy link — create a new account.
  const placeholderEmail = email ?? `${profile.provider}_${profile.providerAccountId}@users.pluscard.local`;

  return prisma.user.create({
    data: {
      publicId: await generateUniquePublicId(),
      name: profile.name?.trim() || "مستخدم PLUS CARD",
      email: placeholderEmail,
      emailVerifiedAt: profile.emailVerified ? new Date() : null,
      image: profile.image,
      accounts: {
        create: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email,
        },
      },
    },
  });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}
