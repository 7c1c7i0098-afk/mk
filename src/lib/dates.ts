/**
 * Date formatting for customer-facing screens.
 *
 * Arabic month names with Latin digits: "31 أغسطس 2026 3:40 م". The digits are
 * forced to Latin because every other number in PLUS CARD — prices, balances,
 * order numbers — is rendered that way, and a statement that mixes numeral
 * systems line to line is harder to scan than one that picks either.
 */

// Composed from two formatters rather than one: the single-formatter output
// joins date and time with "في", and the house style is a comma.
const DATE_PART = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_PART = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  hour: "numeric",
  minute: "2-digit",
});

const SHORT = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  dateStyle: "short",
  timeStyle: "short",
});

/** "31 أغسطس 2026 3:40 م" — for a customer reading their own history. */
export function formatDateTime(value: Date): string {
  const [day, month, year] = [
    value.getDate(),
    DATE_PART.formatToParts(value).find((part) => part.type === "month")?.value ?? "",
    value.getFullYear(),
  ];

  return `${day} ${month} ${year} ${TIME_PART.format(value)}`;
}

/** "31/8/2026, 3:40 م" — for dense admin tables. */
export function formatCompact(value: Date): string {
  return SHORT.format(value);
}
