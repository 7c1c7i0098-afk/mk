"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { usePageTransition } from "@/components/shop/page-transition";

/**
 * Back arrow — points right, the "back" direction in an RTL layout.
 *
 * A bare glyph with no frame. The negative margin keeps a 40px touch target
 * while letting the arrow sit flush against the title beside it, so the tap
 * area stays finger-sized without drawing a box around it.
 *
 * Tapping it slides the current page off to the left first and moves history
 * only once that finishes, so the screen is seen leaving rather than being
 * replaced. The wrapper owns the timing; this button only asks to leave.
 */
export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  const { leave } = usePageTransition();

  return (
    <button
      type="button"
      aria-label="رجوع"
      onClick={() => {
        leave(() => {
          if (window.history.length > 1) router.back();
          else router.push(fallbackHref);
        });
      }}
      className="tap -m-2 grid size-10 shrink-0 place-items-center text-fg transition hover:text-brand"
    >
      <ArrowRight className="size-6" strokeWidth={2.25} />
    </button>
  );
}
