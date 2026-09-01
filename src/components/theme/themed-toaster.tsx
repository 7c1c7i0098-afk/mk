"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";

/**
 * Toasts follow the active appearance, and rise from the foot of the screen.
 *
 * The offset lifts them clear of the fixed bottom navigation — 4rem of bar plus
 * the iOS home indicator — so a message never lands on top of the tabs. Both
 * offsets are set because sonner switches to `mobileOffset` under 600px, which
 * is every phone the storefront is actually read on.
 */
export function ThemedToaster() {
  const { resolved } = useTheme();

  return (
    <Toaster
      dir="rtl"
      theme={resolved}
      position="bottom-center"
      offset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      mobileOffset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))", left: "1rem", right: "1rem" }}
      toastOptions={{
        style: {
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          color: "var(--color-fg)",
          fontFamily: "var(--font-sans)",
        },
      }}
    />
  );
}
