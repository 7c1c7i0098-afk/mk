/**
 * The empty basket screen.
 *
 * Drawn inline rather than shipped as an image: it is a flat illustration of a
 * handful of shapes, so an SVG in the bundle costs less than a network round
 * trip, stays sharp on every screen, and lets the ground shadow pick up the
 * theme (a white ellipse would vanish on a light background).
 */
export function EmptyCart() {
  return (
    <div className="flex min-h-[76dvh] flex-col items-center justify-center gap-7">
      <svg
        viewBox="0 0 400 320"
        role="img"
        aria-label="سلة فارغة"
        className="w-full max-w-[280px]"
      >
        {/* Ground. */}
        <ellipse cx="200" cy="284" rx="116" ry="13" fill="var(--pc-illus-plate)" opacity="0.75" />

        {/* What should have been in the basket, drifting above it. */}
        <g stroke="#5C5CE0" strokeWidth="8" strokeLinecap="round">
          <path d="M52 54 L68 70" />
          <path d="M126 32 L120 52" />
        </g>
        <circle cx="94" cy="88" r="24" fill="#F4511E" />
        <circle cx="292" cy="54" r="11" fill="#4FC3F7" />
        <circle cx="322" cy="106" r="15" fill="#5C5CE0" />

        {/* Handle, tucked behind the rim. */}
        <path
          d="M132 148 C132 68, 268 68, 268 148"
          fill="none"
          stroke="#4FC3F7"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* Basket: body, a darker right facet for volume, then the light rim. */}
        <path
          d="M86 168 L314 168 L288 252 Q282 270 264 270 L136 270 Q118 270 112 252 Z"
          fill="#17A6F0"
        />
        <path
          d="M226 168 L314 168 L288 252 Q282 270 264 270 L226 270 Z"
          fill="#0A7DC4"
        />
        <rect x="70" y="138" width="260" height="30" rx="15" fill="#7FD4FF" />

        <g fill="#131A38">
          <rect x="150" y="190" width="20" height="56" rx="10" />
          <rect x="190" y="190" width="20" height="56" rx="10" />
          <rect x="230" y="190" width="20" height="56" rx="10" />
        </g>
      </svg>

      <p className="pb-1 text-xl font-semibold leading-[1.7] text-muted">السلة فارغة</p>
    </div>
  );
}
