"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Six single-digit inputs with auto-advance, backspace-to-previous and paste
 * support. The boxes stay left-to-right even inside the RTL layout, because
 * digits read that way.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
    // onComplete is intentionally excluded — it fires once per completed code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function setDigit(index: number, digit: string) {
    const next = value.padEnd(6, " ").split("");
    next[index] = digit;
    onChange(next.join("").replace(/\s/g, " ").trimEnd().replace(/\s/g, ""));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, 6);
    onChange(next);

    if (index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = value.split("");
      if (chars[index]) {
        chars[index] = "";
        onChange(chars.join("").replace(/\s/g, ""));
      } else if (index > 0) {
        chars[index - 1] = "";
        onChange(chars.join("").replace(/\s/g, ""));
        refs.current[index - 1]?.focus();
      }
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div dir="ltr" className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit.trim()}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`الرقم ${index + 1} من رمز التحقق`}
          className={cn(
            "num size-12 rounded-2xl border bg-surface text-center text-lg font-bold text-fg outline-none transition",
            "focus:border-brand/60 focus:bg-surface-2 focus:ring-4 focus:ring-brand/10",
            invalid ? "border-danger" : "border-line",
            disabled && "opacity-60",
          )}
        />
      ))}
    </div>
  );
}
