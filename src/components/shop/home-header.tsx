"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { SearchBar } from "@/components/shop/search-bar";
import { CURRENCY_SYMBOL, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

type HomeHeaderProps = {
  /** Null for guests — the header then shows the existing login state. */
  balance: number | null;
  /** The authenticated customer's name, or null for guests. Never invented. */
  name: string | null;
};

/** Scroll distance that swaps the full header for the compact one. */
const COLLAPSE_AT = 80;
const RESTORE_AT = 24;

/**
 * Homepage-only header, in two states.
 *
 * Top of the page: greeting + customer name on the right (the start side in
 * RTL), balance pill on the left, large search field underneath.
 *
 * Scrolled down: greeting, name and search collapse away and a compact sticky
 * bar slides in — balance pill on the LEFT, right side left empty for the logo
 * that is coming later.
 *
 * That bar is one single pane of frosted glass. It starts at the very top of
 * the screen and its own padding — not a second element — fills the safe area
 * behind the clock, signal and battery, so the status-bar band and the header
 * share one background, one blur and one edge, with nothing dividing them.
 *
 * The tint is deliberately heavy (90%): content passing underneath stays only
 * faintly visible, and the pane's resting colour lands on the page background,
 * which is exactly the `theme-color` the browser paints behind the status bar.
 * That match is what stops the status bar reading as a separate darker strip.
 */
export function HomeHeader({ balance, name }: HomeHeaderProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Hysteresis between the two thresholds keeps the swap from flickering when
  // the user rests the page right on the boundary.
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setCollapsed((current) => (current ? y > RESTORE_AT : y > COLLAPSE_AT));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const firstName = name?.trim().split(/\s+/)[0] ?? null;

  return (
    <>
      {/* ── Full header — ordinary page content, scrolls away with the page ── */}
      <div
        className={cn(
          "flex flex-col gap-4 transition-opacity duration-300 ease-[var(--ease-smooth)] motion-reduce:transition-none",
          collapsed && "pointer-events-none opacity-0",
        )}
        aria-hidden={collapsed}
      >
        <div className="flex items-start justify-between gap-3">
          {/* start side (right in RTL): greeting above the name */}
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">👋 أهلاً بك</p>
            {firstName ? (
              <p className="truncate text-xl font-bold leading-tight text-fg sm:text-2xl">
                {firstName}
              </p>
            ) : (
              <Link
                href="/login"
                className="tap inline-block truncate text-xl font-bold leading-tight text-brand sm:text-2xl"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>

          {/* end side (left in RTL): balance pill + favorites */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/favorites"
              aria-label="المفضلة"
              className="tap grid size-10 place-items-center rounded-full border border-line bg-surface text-muted hover:border-brand/40 hover:bg-surface-2 hover:text-brand"
            >
              <Heart className="size-5" />
            </Link>
            <BalancePill balance={balance} />
          </div>
        </div>

        <SearchBar placeholder="ابحث عن منتج أو خدمة..." />
      </div>

      {/* ── Compact sticky header — appears once the page is scrolled ── */}
      <div
        aria-hidden={!collapsed}
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-transform duration-300 ease-[var(--ease-smooth)] motion-reduce:transition-none",
          collapsed ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-6">
          {/* Physical LEFT, in an RTL document — order-last puts it there. */}
          <div className="order-last">
            <BalancePill balance={balance} tabIndex={collapsed ? 0 : -1} />
          </div>

          {/* Physical RIGHT: the PLUS CARD wordmark. dir="ltr" keeps the latin
              letters in order inside the RTL document. */}
          {/* Physical RIGHT: reserved for the logo, which does not exist yet.
              Intentionally empty — no placeholder, icon, initials or wordmark. */}
          <div className="h-10 w-28" aria-hidden />
        </div>
      </div>
    </>
  );
}

/** Rounded balance pill with a small green dot, or the login pill for guests. */
function BalancePill({
  balance,
  tabIndex,
}: {
  balance: number | null;
  tabIndex?: number;
}) {
  if (balance === null) {
    return (
      <Link
        href="/login"
        tabIndex={tabIndex}
        className="tap flex h-10 items-center rounded-full border border-brand/40 bg-brand-soft px-4 text-sm font-semibold text-brand"
      >
        تسجيل الدخول
      </Link>
    );
  }

  return (
    <Link
      href="/wallet"
      tabIndex={tabIndex}
      aria-label={`رصيدك ${formatAmount(balance)} ${CURRENCY_SYMBOL}`}
      className="tap flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 hover:border-brand/40 hover:bg-surface-2"
    >
      <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
      <span className="num text-base font-bold tracking-tight text-fg">
        {formatAmount(balance)}
      </span>
      <span className="text-sm font-medium text-muted">{CURRENCY_SYMBOL}</span>
    </Link>
  );
}
