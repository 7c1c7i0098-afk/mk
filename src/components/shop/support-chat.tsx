"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Headphones, SendHorizontal } from "lucide-react";
import { sendSupportMessage, type SupportState } from "@/app/(shop)/support/actions";
import { formatDateTime } from "@/lib/dates";
import type { SupportThreadView } from "@/lib/support";
import { cn } from "@/lib/utils";

/**
 * The customer's side of the support conversation.
 *
 * Laid out like a messaging app: the customer's own lines on the end side, the
 * shop's on the start side, newest at the bottom, and the composer held at the
 * foot of the screen. The column is stretched to the viewport so the composer
 * sits at the bottom even when two messages are all there is — a box floating
 * halfway up an empty screen does not read as "write here".
 *
 * New replies arrive by polling rather than a socket — one refresh every ten
 * seconds while the screen is actually being looked at. A support thread sees a
 * message a minute at its busiest, and a socket for that would be a connection
 * held open on every phone for nothing.
 */
const POLL_MS = 10_000;

export function SupportChat({ thread }: { thread: SupportThreadView }) {
  const router = useRouter();
  const [state, formAction] = useActionState<SupportState, FormData>(sendSupportMessage, {});
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, closedAt, closedByCustomer } = thread;

  // Clear the box only once the server has actually taken the message.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    // A phone that was put down and picked up again should not wait for the
    // next tick to show what arrived meanwhile.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  useKeyboardInset();

  return (
    <div className="flex min-h-[calc(100dvh-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Headphones className="size-6" />
          </span>
          <p className="pb-0.5 text-sm font-bold leading-[1.7] text-fg">كيف نقدر نساعدك؟</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted">
            اكتب مشكلتك أو سؤالك وسيرد عليك فريق الدعم هنا. لو كانت المشكلة في طلب
            معيّن، أرفق رقم الطلب.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            // One stamp per burst — a time on every line turns the thread into
            // a log instead of a conversation.
            const showTime =
              !previous ||
              message.createdAt.getTime() - previous.createdAt.getTime() > 5 * 60_000;

            return (
              <li key={message.id} className="space-y-2.5">
                {showTime && (
                  <p className="tnum text-center text-[11px] text-muted-2">
                    {formatDateTime(message.createdAt)}
                  </p>
                )}

                <div className={cn("flex", message.fromStaff ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-[1.8]",
                      message.fromStaff
                        ? "rounded-ss-sm border border-line bg-surface text-fg"
                        : "rounded-se-sm bg-brand text-white",
                    )}
                  >
                    {message.fromStaff && (
                      <span className="mb-1 block text-[11px] font-bold text-brand">
                        فريق الدعم
                      </span>
                    )}
                    {message.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {closedAt && messages.length > 0 && (
        <p className="tnum text-center text-[11px] text-muted-2">
          {closedByCustomer ? "أغلقت المحادثة" : "أغلق فريق الدعم المحادثة"} ·{" "}
          {formatDateTime(closedAt)}
        </p>
      )}

      <div ref={endRef} />

      {state.error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      {/* mt-auto drops the composer to the foot of the stretched column; sticky
          keeps it there once the conversation is long enough to scroll. The
          bottom offset is a variable so the keyboard can lift it — see
          useKeyboardInset. */}
      <form
        ref={formRef}
        action={formAction}
        className="pc-composer sticky z-30 -mx-4 mt-auto flex items-end gap-2 border-t border-line bg-ink/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-6 md:px-6"
      >
        <textarea
          name="body"
          rows={1}
          required
          placeholder={closedAt ? "اكتب رسالة جديدة لإعادة فتح المحادثة…" : "اكتب رسالتك…"}
          /* text-base is not a style choice: iOS zooms the whole page in on any
             field under 16px, and the zoom is what makes the screen lurch. */
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-base leading-[1.6] text-fg outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
          onInput={(event) => {
            const box = event.currentTarget;
            box.style.height = "auto";
            box.style.height = `${box.scrollHeight}px`;
          }}
        />
        <SendButton />
      </form>
    </div>
  );
}

/**
 * Keeps the composer sitting on top of the on-screen keyboard.
 *
 * iOS does not shrink the layout viewport when the keyboard opens, so anything
 * anchored to the bottom ends up underneath it. The visual viewport does shrink,
 * and the difference between the two is exactly how much of the screen the
 * keyboard covers — that number becomes a CSS variable the composer sits on.
 *
 * While the keyboard is up the bottom navigation is hidden: it would otherwise
 * be stranded behind the keyboard, and the tabs are not reachable mid-message
 * anyway.
 */
function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const apply = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--pc-keyboard", `${Math.round(covered)}px`);
      // A few pixels of difference are toolbars, not a keyboard.
      root.toggleAttribute("data-keyboard", covered > 120);
    };

    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    apply();

    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      root.style.removeProperty("--pc-keyboard");
      root.removeAttribute("data-keyboard");
    };
  }, []);
}

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="إرسال"
      className="tap grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-50"
    >
      {/* Mirrored: the glyph points right, and "send" runs leftwards in Arabic. */}
      <SendHorizontal className="size-5 -scale-x-100" />
    </button>
  );
}
