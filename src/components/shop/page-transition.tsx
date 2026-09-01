"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Slides whole pages, never element by element.
 *
 * Three movements, all 500ms and all physical (the site is RTL, but these
 * directions are deliberately NOT mirrored):
 *  - opening a category, a product, an order or an account screen: it enters
 *    LEFT → RIGHT;
 *  - going back: the previous page enters RIGHT → LEFT;
 *  - pressing the back arrow: the page on screen leaves RIGHT → LEFT first,
 *    and only then does history move.
 *
 * Keying on the pathname remounts the wrapper per navigation, which replays the
 * animation without touching router state, the cart or authentication. Small
 * in-page actions (quantity +/-) never trigger it, because the pathname does
 * not change.
 */
const ANIMATED_ROUTES = [
  /^\/category\//,
  /^\/product\//,
  /^\/orders\/./,
  /^\/account\/./,
  /^\/support$/,
];

/** Must match --pc-page-transition in globals.css. */
const EXIT_MS = 500;

type Transition = {
  /** Plays the leaving slide, then runs `go`. */
  leave: (go: () => void) => void;
};

/* Navigating without the animation is the correct fallback for a back arrow
   rendered outside this provider — it must never swallow the navigation. */
const TransitionContext = createContext<Transition>({ leave: (go) => go() });

export function usePageTransition() {
  return useContext(TransitionContext);
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Set by the browser/Next router just before a history-driven navigation, so
  // it is already true by the time the new pathname renders.
  const poppedRef = useRef(false);
  const [nav, setNav] = useState({ pathname, back: false });
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onPopState = () => {
      poppedRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // Adjusting state during render (rather than in an effect) so the direction
  // is known on the very first frame of the new page — an effect would start
  // the animation with the wrong class and then restart it.
  if (nav.pathname !== pathname) {
    setNav({ pathname, back: poppedRef.current });
    poppedRef.current = false;
    // The page that was leaving is gone; whatever arrives must enter clean.
    if (exiting) setExiting(false);
  }

  const leave = useCallback((go: () => void) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go();
      return;
    }
    if (timerRef.current !== null) return; // already leaving — ignore a second tap
    setExiting(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      go();
    }, EXIT_MS);
  }, []);

  const animated = ANIMATED_ROUTES.some((pattern) => pattern.test(pathname));

  return (
    <TransitionContext.Provider value={{ leave }}>
      <div className="page-transition-host">
        {/* Exactly one animation class at a time: `page-exit` and the entrance
            rules set the same `animation-name`, so applying both would leave
            the cascade to decide the direction. */}
        <div
          key={pathname}
          className={cn(
            exiting
              ? "page-exit"
              : animated && (nav.back ? "page-enter-rtl" : "page-enter-ltr"),
          )}
        >
          {children}
        </div>
      </div>
    </TransitionContext.Provider>
  );
}
