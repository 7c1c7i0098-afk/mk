import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

/**
 * Server-side authorization for every admin page and mutation.
 * Never trust the client: each admin route handler and server action calls one
 * of these before touching data.
 */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Returns null when the caller is not an admin — for API routes / actions. */
export async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("غير مصرّح لك بهذا الإجراء");
  }
}

/** Throws for server actions, which surface the message to the form. */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!user) throw new NotAuthorizedError();
  return user;
}
