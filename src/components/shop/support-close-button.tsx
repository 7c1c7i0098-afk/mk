"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { closeSupportThread } from "@/app/(shop)/support/actions";

/**
 * Ends the conversation and clears it from the customer's screen.
 *
 * Confirmed first, because it is not undoable from here: the messages stay in
 * the shop's copy but the customer's own view starts empty. The confirmation
 * says exactly that rather than a bare "are you sure?".
 */
export function SupportCloseButton() {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  function close() {
    start(async () => {
      const result = await closeSupportThread();
      setAsking(false);
      if (result.error) toast.error(result.error);
      else toast.success("تم إغلاق المحادثة");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label="إغلاق المحادثة"
        className="tap -m-2 grid size-10 shrink-0 place-items-center text-muted transition hover:text-danger"
      >
        <X className="size-6" strokeWidth={2.25} />
      </button>

      {asking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
          onClick={() => !pending && setAsking(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xs space-y-4 rounded-3xl border border-line bg-surface p-5 text-center"
          >
            <p className="pb-0.5 text-sm font-bold leading-[1.7] text-fg">إغلاق المحادثة؟</p>
            <p className="text-xs leading-relaxed text-muted">
              ستُمسح الرسائل من شاشتك وتبدأ محادثة جديدة. يمكنك مراسلتنا مرة أخرى في
              أي وقت.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                disabled={pending}
                className="tap rounded-xl border border-line bg-surface-2 py-2.5 text-sm font-semibold text-fg disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="tap rounded-xl bg-danger py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending ? "جارٍ…" : "إغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
