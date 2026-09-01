"use client";

import { useTransition } from "react";
import { CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { closeSupportThreadAsAdmin } from "@/app/admin/support/actions";

/**
 * Marks a conversation handled.
 *
 * The shop's close is not the customer's: it takes the thread out of the queue
 * and nothing else. The customer's screen keeps every message, and either side
 * writing again reopens it.
 */
export function SupportCloseThread({ userId, closed }: { userId: string; closed: boolean }) {
  const [pending, start] = useTransition();

  if (closed) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted-2">
        <CheckCheck className="size-3.5" aria-hidden />
        مغلقة
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await closeSupportThreadAsAdmin(userId);
          if (result.error) toast.error(result.error);
          else toast.success("تم إغلاق المحادثة");
        })
      }
      className="tap flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted transition hover:text-danger disabled:opacity-50"
    >
      <X className="size-3.5" aria-hidden />
      {pending ? "جارٍ…" : "إغلاق المحادثة"}
    </button>
  );
}
