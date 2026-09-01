import "server-only";

import { prisma } from "@/lib/db";

/**
 * The in-app support conversation.
 *
 * One thread per customer, and the shop is always the other side, so a thread
 * has no id beyond the customer it belongs to. Every function here takes the
 * customer's id from the caller's already-checked session — nothing accepts a
 * thread id from a form, so no request can read or write somebody else's
 * conversation.
 */

/** Longer than this and the composer is being used as a file upload. */
export const MAX_MESSAGE_LENGTH = 2000;

export type SupportMessageView = {
  id: string;
  fromStaff: boolean;
  body: string;
  createdAt: Date;
};

export type SupportThreadView = {
  messages: SupportMessageView[];
  closedAt: Date | null;
  /** True when the customer closed it themselves rather than the shop. */
  closedByCustomer: boolean;
};

/**
 * The conversation, oldest first.
 *
 * Unpaginated on purpose: a support thread is read from the top like a chat,
 * and a "show earlier" control on a conversation that is almost always under a
 * dozen lines would be furniture nobody uses.
 *
 * `asStaff` decides whether the customer's own clear is respected. The shop
 * always sees everything; the customer sees only what came after they last
 * cleared their screen.
 */
export async function getThread(
  userId: string,
  options?: { asStaff?: boolean },
): Promise<SupportThreadView> {
  const thread = await prisma.supportThread.findUnique({
    where: { userId },
    select: { closedAt: true, closedById: true, clearedAt: true },
  });

  const clearedAt = options?.asStaff ? null : thread?.clearedAt;

  const messages = await prisma.supportMessage.findMany({
    where: { userId, ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromStaff: true, body: true, createdAt: true },
  });

  return {
    messages,
    closedAt: thread?.closedAt ?? null,
    closedByCustomer: thread?.closedById === userId,
  };
}

/**
 * Ends the conversation.
 *
 * Either side may do it and neither is locked out afterwards — the next message
 * reopens the thread. Closing marks a topic finished and takes it out of the
 * shop's queue; it is not a mute.
 *
 * `clearForCustomer` is what the customer's own button does: it hides
 * everything said so far from their screen so they start clean. The shop's copy
 * is untouched, deliberately — the customer is tidying their view, not deleting
 * the record of what was agreed.
 */
export async function closeThread(
  userId: string,
  closedById: string,
  options?: { clearForCustomer?: boolean },
) {
  const now = new Date();
  const cleared = options?.clearForCustomer ? { clearedAt: now } : {};

  await prisma.supportThread.upsert({
    where: { userId },
    create: { userId, closedAt: now, closedById, ...cleared },
    update: { closedAt: now, closedById, ...cleared },
  });
}

/**
 * Adds a line to a customer's thread.
 *
 * `staffId` is only ever set by the admin path; the customer action calls this
 * with `fromStaff: false` and no staff id, so a customer cannot post a message
 * that renders as if the shop had written it.
 */
export async function addMessage(input: {
  userId: string;
  body: string;
  fromStaff: boolean;
  staffId?: string;
}) {
  const body = input.body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!body) return null;

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        userId: input.userId,
        body,
        fromStaff: input.fromStaff,
        staffId: input.fromStaff ? (input.staffId ?? null) : null,
      },
      select: { id: true },
    }),
    // A new message reopens a closed conversation, whichever side sent it.
    prisma.supportThread.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId },
      update: { closedAt: null, closedById: null },
    }),
  ]);

  return message;
}

/**
 * Marks the other side's messages as seen.
 *
 * `fromStaff` says whose messages are being read: the customer opening the
 * thread clears the shop's, the admin opening it clears the customer's.
 */
export async function markRead(userId: string, fromStaff: boolean) {
  await prisma.supportMessage.updateMany({
    where: { userId, fromStaff, readAt: null },
    data: { readAt: new Date() },
  });
}

/** How many shop replies the customer has not opened yet. */
export async function unreadForCustomer(userId: string) {
  return prisma.supportMessage.count({
    where: { userId, fromStaff: true, readAt: null },
  });
}

export type SupportConversation = {
  userId: string;
  name: string;
  email: string;
  publicId: string | null;
  lastBody: string;
  lastAt: Date;
  lastFromStaff: boolean;
  unread: number;
  closed: boolean;
};

/**
 * Every conversation, newest first, for the admin's inbox.
 *
 * Built from the messages rather than from the users: a customer who has never
 * written has no conversation to answer, and listing them all would bury the
 * few that need a reply.
 */
export async function listConversations(): Promise<SupportConversation[]> {
  const threads = await prisma.supportMessage.groupBy({
    by: ["userId"],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 100,
  });

  if (threads.length === 0) return [];

  const userIds = threads.map((thread) => thread.userId);

  const [users, unreadCounts, latest, closedThreads] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, publicId: true },
    }),
    prisma.supportMessage.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, fromStaff: false, readAt: null },
      _count: { _all: true },
    }),
    prisma.supportMessage.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, body: true, createdAt: true, fromStaff: true },
      // Enough rows to be sure the newest of each thread is in here.
      take: userIds.length * 4,
    }),
    prisma.supportThread.findMany({
      where: { userId: { in: userIds }, closedAt: { not: null } },
      select: { userId: true },
    }),
  ]);

  const byUser = new Map(users.map((user) => [user.id, user]));
  const unreadByUser = new Map(unreadCounts.map((row) => [row.userId, row._count._all]));
  const closed = new Set(closedThreads.map((thread) => thread.userId));
  const lastByUser = new Map<string, (typeof latest)[number]>();
  for (const message of latest) {
    if (!lastByUser.has(message.userId)) lastByUser.set(message.userId, message);
  }

  return threads.flatMap((thread) => {
    const user = byUser.get(thread.userId);
    const last = lastByUser.get(thread.userId);
    if (!user || !last) return [];

    return [
      {
        userId: user.id,
        name: user.name,
        email: user.email,
        publicId: user.publicId,
        lastBody: last.body,
        lastAt: last.createdAt,
        lastFromStaff: last.fromStaff,
        unread: unreadByUser.get(user.id) ?? 0,
        closed: closed.has(user.id),
      },
    ];
  });
}

/** Customers waiting on a reply — the badge on the admin's navigation. */
export async function openConversationCount() {
  const rows = await prisma.supportMessage.groupBy({
    by: ["userId"],
    where: { fromStaff: false, readAt: null },
  });
  return rows.length;
}
