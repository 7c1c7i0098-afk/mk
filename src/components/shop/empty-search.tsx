import Link from "next/link";
import { LifeBuoy } from "lucide-react";

/**
 * What a search finds when it finds nothing.
 *
 * Drawn inline for the same reason as the empty basket: a handful of flat
 * shapes cost less in the bundle than a network round trip, stay sharp at any
 * size, and take the theme with them.
 *
 * It offers two ways out rather than apologising twice. Someone who searched
 * for a card the shop does not carry is one tap from asking for it — which is
 * the only useful thing this screen can do, and the shop wants to hear it.
 */
export function EmptySearch({ term }: { term: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-14">
      <svg
        viewBox="0 0 320 220"
        role="img"
        aria-label="لا توجد نتائج"
        className="w-full max-w-[220px]"
      >
        {/* Ground. */}
        <ellipse cx="160" cy="196" rx="96" ry="12" fill="var(--pc-illus-plate)" opacity="0.7" />

        {/* Cards fanned out behind the glass — the shelf that was searched. */}
        <rect
          x="52"
          y="66"
          width="86"
          height="112"
          rx="14"
          fill="#0A7DC4"
          transform="rotate(-14 95 122)"
        />
        <rect
          x="182"
          y="66"
          width="86"
          height="112"
          rx="14"
          fill="#17A6F0"
          transform="rotate(13 225 122)"
        />
        <rect x="117" y="58" width="86" height="120" rx="14" fill="#7FD4FF" />
        <g fill="#131A38">
          <rect x="133" y="86" width="54" height="8" rx="4" />
          <rect x="133" y="104" width="36" height="8" rx="4" />
        </g>

        {/* The magnifier, empty. */}
        <circle
          cx="196"
          cy="128"
          r="40"
          fill="none"
          stroke="#5C5CE0"
          strokeWidth="12"
        />
        <path
          d="M226 158 L258 190"
          stroke="#5C5CE0"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </svg>

      <div className="space-y-1.5 text-center">
        <p className="pb-0.5 text-base font-bold leading-[1.7] text-fg">
          ما لقينا شيئاً بهذا الاسم
        </p>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted">
          جرّب اسماً أقصر أو تهجئة أخرى — أو اطلب منّا إضافة{" "}
          <span className="font-semibold text-fg">{term}</span>.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/"
          className="tap rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          تصفّح كل الفئات
        </Link>
        <Link
          href="/support"
          className="tap flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition hover:border-brand/40"
        >
          <LifeBuoy className="size-4 text-brand" aria-hidden />
          اطلبها منّا
        </Link>
      </div>
    </div>
  );
}
