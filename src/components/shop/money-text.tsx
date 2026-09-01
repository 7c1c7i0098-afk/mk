import { CURRENCY_SYMBOL, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * A money figure, laid out for Arabic: the sign on the right of the number,
 * "د.ل" on its left — "د.ل 38.00+" as the eye scans left to right.
 *
 * Built from nested runs because the parts want different directions. The outer
 * run follows the page's RTL flow, so its first child lands rightmost; the
 * number itself is isolated left-to-right so its digits keep their order. The
 * sign is a sibling rather than part of the number string, which is what lets it
 * sit on the number's right instead of being dragged to the left by the
 * left-to-right isolate.
 */
export function MoneyText({
  value,
  sign,
  className,
}: {
  value: number;
  /** Show an explicit + or − beside the figure. */
  sign?: boolean;
  className?: string;
}) {
  const prefix = sign && value !== 0 ? (value > 0 ? "+" : "-") : "";

  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      {/* No gap inside: the sign belongs against the digits, not spaced off them. */}
      <span className="inline-flex items-baseline">
        {prefix && <span>{prefix}</span>}
        <span dir="ltr" className="num">
          {formatAmount(value)}
        </span>
      </span>
      <span>{CURRENCY_SYMBOL}</span>
    </span>
  );
}
