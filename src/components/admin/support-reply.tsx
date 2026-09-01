"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { replyToSupport, type ReplyState } from "@/app/admin/support/actions";

/**
 * The reply box under a support thread.
 *
 * Polls while the tab is in front so an admin sitting on an open conversation
 * sees the customer's next message without reloading — the same ten-second
 * cadence the customer's screen uses.
 */
const POLL_MS = 10_000;

export function SupportReply({ userId, closed }: { userId: string; closed: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ReplyState, FormData>(replyToSupport, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return (
    <div className="space-y-2">
      {state.error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="userId" value={userId} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder={closed ? "الرد يعيد فتح المحادثة…" : "اكتب ردّك للعميل…"}
          className="min-h-11 flex-1 resize-y rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-[1.7] text-fg outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
        />
        <SendButton />
      </form>

    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="إرسال الرد"
      className="tap grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-50"
    >
      <SendHorizontal className="size-5 -scale-x-100" />
    </button>
  );
}
