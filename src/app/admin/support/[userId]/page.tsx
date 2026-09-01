import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCheck, ChevronRight } from "lucide-react";
import { SupportCloseThread } from "@/components/admin/support-close-thread";
import { SupportReply } from "@/components/admin/support-reply";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getThread, markRead } from "@/lib/support";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ userId: string }> };

/**
 * One customer's conversation, from the shop's side.
 *
 * The admin layout has already established the role; this page only has to
 * find the customer. Opening it marks their messages read, which is what
 * clears the badge in the inbox.
 */
export default async function AdminSupportThreadPage({ params }: PageProps) {
  const { userId } = await params;

  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, publicId: true, balance: true },
  });
  if (!customer) notFound();

  const { messages, closedAt, closedByCustomer } = await getThread(customer.id, { asStaff: true });
  await markRead(customer.id, false);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/support"
          aria-label="رجوع إلى المحادثات"
          className="tap grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted hover:text-fg"
        >
          <ChevronRight className="size-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg">{customer.name}</p>
          <p className="truncate text-xs text-muted">
            {customer.email}
            {customer.publicId && <span className="num"> · #{customer.publicId}</span>}
          </p>
        </div>

        <Link
          href={`/admin/users?q=${encodeURIComponent(customer.email)}`}
          className="tap shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-fg"
        >
          ملف العميل
        </Link>

        {messages.length > 0 && (
          <SupportCloseThread userId={customer.id} closed={closedAt !== null} />
        )}
      </div>

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          لا توجد رسائل في هذه المحادثة
        </p>
      ) : (
        <ul className="space-y-2.5">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn("flex", message.fromStaff ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] space-y-1 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-[1.8]",
                  message.fromStaff
                    ? "bg-brand text-white"
                    : "border border-line bg-surface text-fg",
                )}
              >
                {message.body}
                <p
                  className={cn(
                    "tnum text-[10px]",
                    message.fromStaff ? "text-white/70" : "text-muted-2",
                  )}
                >
                  {formatDateTime(message.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {closedAt && (
        <p className="tnum flex items-center justify-center gap-1.5 text-[11px] text-muted-2">
          <CheckCheck className="size-3.5 shrink-0" aria-hidden />
          {closedByCustomer ? "أغلق العميل المحادثة" : "أغلقتم المحادثة"} ·{" "}
          {formatDateTime(closedAt)}
        </p>
      )}

      <SupportReply userId={customer.id} closed={closedAt !== null} />
    </div>
  );
}
