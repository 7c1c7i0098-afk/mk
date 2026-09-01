"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "داكن", icon: Moon },
  { value: "light", label: "فاتح", icon: Sun },
  { value: "system", label: "حسب الجهاز", icon: Monitor },
];

/** Full appearance picker — lives in الحساب, not in the homepage header. */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="المظهر"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-ink p-2"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(option.value)}
            className={cn(
              "tap flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition",
              active
                ? "bg-brand text-white shadow-card"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
