"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

/**
 * Re-fetches the current screen.
 *
 * A balance is the one number a customer will not take on trust after acting
 * elsewhere — approving a top-up, finishing a purchase — so the wallet offers an
 * explicit way to ask again. The spin is driven by the transition, so it stops
 * when the new data actually arrives rather than after a guessed delay.
 */
export function RefreshButton({ label = "تحديث" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="tap grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-fg disabled:opacity-70"
    >
      <RotateCw className={`size-4.5 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
