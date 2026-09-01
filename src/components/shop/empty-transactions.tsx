/**
 * The empty-history illustration.
 *
 * Drawn inline as SVG rather than shipped as an image: it inherits the theme's
 * own tokens, stays sharp at any density, and costs no extra request. The paper
 * and its arrows carry the meaning — a statement with nothing on it — while the
 * badge states the count outright for anyone who reads the number before the
 * picture.
 */
export function EmptyTransactions() {
  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label="لا توجد معاملات"
      className="h-44 w-44"
    >
      {/* soft disc behind the paper */}
      <circle cx="112" cy="112" r="76" className="fill-surface-2" />

      {/* the statement */}
      <g>
        <rect x="66" y="56" width="92" height="112" rx="10" className="fill-brand" />
        {/* folded corner, lighter than the sheet */}
        <path d="M140 56h18v18a10 10 0 0 1-10-10V56z" className="fill-brand-600" opacity="0.9" />

        {/* ruled lines */}
        <rect x="80" y="76" width="46" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
        <rect x="80" y="92" width="30" height="7" rx="3.5" fill="#ffffff" opacity="0.4" />
        <rect x="80" y="140" width="52" height="7" rx="3.5" fill="#ffffff" opacity="0.4" />
        <rect x="80" y="154" width="34" height="7" rx="3.5" fill="#ffffff" opacity="0.28" />

        {/* the two movements a wallet knows: in and out */}
        <path
          d="M84 112h44l-9-9m9 9-9 9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M140 126H96l9 9m-9-9 9-9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
      </g>

      {/* the count, said plainly */}
      <g>
        <circle cx="66" cy="62" r="24" className="fill-warn" />
        <text
          x="66"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="26"
          fontWeight="700"
        >
          0
        </text>

        {/* three spark strokes, top-left */}
        <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.85">
          <line x1="36" y1="30" x2="42" y2="38" />
          <line x1="26" y1="46" x2="35" y2="49" />
          <line x1="52" y1="22" x2="54" y2="32" />
        </g>
      </g>
    </svg>
  );
}
