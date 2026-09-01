import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { listConversations } from "@/lib/support";

/**
 * The support inbox.
 *
 * Ordered by the newest message rather than by unread count on purpose: a
 * conversation that was answered an hour ago and got a follow-up should sit
 * above one that has been unread and idle since yesterday.
 */
export default async function AdminSupportPage() {
  const conversations = await listConversations();
  const waiting = conversations.filter((thread) => thread.unread > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-fg">
          <span className="h-4 w-1 rounded-full bg-brand" aria-hidden />
          الدعم
        </h1>
        {waiting > 0 && (
          <span className="rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn">
            <span className="num">{waiting}</span> بانتظار الرد
          </span>
        )}
      </div>

      {conversations.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface px-6 py-14 text-center text-sm text-muted">
          لا توجد محادثات دعم بعد
        </p>
      ) : (
        <ul className="space-y-2.5">
          {conversations.map((thread) => (
            <li key={thread.userId}>
              <Link
                href={`/admin/support/${thread.userId}`}
                className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand/40"
              >
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"
                >
                  <MessageCircle className="size-5" />
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-fg">{thread.name}</p>
                    {thread.publicId && (
                      <span className="num shrink-0 text-[11px] text-muted-2">
                        #{thread.publicId}
                      </span>
                    )}
                    {thread.unread > 0 && (
                      <span className="num shrink-0 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                        {thread.unread}
                      </span>
                    )}
                    {thread.closed && (
                      <span className="shrink-0 rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-2">
                        مغلقة
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {thread.lastFromStaff && <span className="text-muted-2">أنت: </span>}
                    {thread.lastBody}
                  </p>
                  <p className="tnum truncate text-[11px] text-muted-2">
                    {formatDateTime(thread.lastAt)}
                  </p>
                </div>

                <ChevronLeft className="size-4 shrink-0 text-muted-2" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
