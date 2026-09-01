"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Copies the card code to the clipboard.
 *
 * Two paths, because the modern one is not always there. `navigator.clipboard`
 * only exists in a secure context — HTTPS or localhost — so on a phone opening
 * the site over the local network by IP it is simply `undefined`, and the
 * button did nothing but apologise. The fallback selects the code in an
 * off-screen field and runs the old `execCommand("copy")`, which works on plain
 * HTTP.
 *
 * The fallback is deliberately synchronous and tried without awaiting anything
 * first: browsers only allow a copy inside the task that the tap started, and
 * an `await` would have already ended it.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function succeed() {
    setCopied(true);
    toast.success("تم نسخ رمز البطاقة");
    setTimeout(() => setCopied(false), 2000);
  }

  function fallback() {
    if (legacyCopy(value)) succeed();
    else toast.error("تعذّر النسخ — انسخ الرمز يدوياً من الشاشة");
  }

  function copy() {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(succeed, fallback);
      return;
    }
    fallback();
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "tap grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition hover:bg-brand/20",
        className,
      )}
    >
      {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5" />}
    </button>
  );
}

/**
 * The pre-clipboard-API way to copy, kept for insecure origins.
 *
 * `execCommand("copy")` copies the selection of the *focused* element, so the
 * field has to be focused and selected, not merely present — focusing it is the
 * step that is easy to leave out and that makes the whole thing silently copy
 * nothing.
 *
 * The field is parked off-screen rather than hidden, because `display: none`
 * and `visibility: hidden` make it unselectable. `readOnly` keeps the on-screen
 * keyboard from flashing open on a phone, and iOS ignores `select()` on a
 * read-only field, hence the explicit Range as well.
 */
function legacyCopy(text: string): boolean {
  const previouslyFocused = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.contentEditable = "true";
  // 16px stops iOS from zooming the page in when the field takes focus.
  field.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none;";
  document.body.appendChild(field);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  let copied = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(field);
    selection?.removeAllRanges();
    selection?.addRange(range);

    field.focus({ preventScroll: true });
    field.setSelectionRange(0, text.length);

    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  field.remove();

  // Put back whatever the customer had selected and focused before the tap.
  if (previousRange) {
    selection?.removeAllRanges();
    selection?.addRange(previousRange);
  }
  if (previouslyFocused instanceof HTMLElement) {
    previouslyFocused.focus({ preventScroll: true });
  }

  return copied;
}
