/**
 * Guards against open redirects: only same-site absolute paths are accepted,
 * never "//evil.com", "https://evil.com" or backslash tricks.
 */
const DEFAULT_DESTINATION = "/";

/** True when the value contains whitespace or a control character. */
function hasUnsafeCharacter(value: string) {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirect(target: string | null | undefined, fallback = DEFAULT_DESTINATION) {
  if (!target) return fallback;

  const value = target.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://")) return fallback;
  if (hasUnsafeCharacter(value)) return fallback;

  return value;
}
