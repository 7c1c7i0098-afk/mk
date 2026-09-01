"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The customer's account number, with one-tap copy so they can quote it to
 * support. It identifies the account and nothing more — every privileged action
 * is still authorised by the session on the server.
 */
export function AccountId({ publicId }: { publicId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure origin / denied) — the id stays readable.
    }
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink px-4 py-3">
      <span className="shrink-0 text-sm text-muted">معرّف الحساب</span>

      <div className="flex min-w-0 items-center gap-2">
        <span dir="ltr" className="num truncate text-sm font-bold tracking-widest text-fg">
          {publicId}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="نسخ معرّف الحساب"
          className="tap grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted hover:border-brand/40 hover:text-brand"
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
