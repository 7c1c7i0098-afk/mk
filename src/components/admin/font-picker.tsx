"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { saveSiteFont, type SettingsState } from "@/app/admin/settings/actions";
import { SITE_FONTS, type SiteFontKey } from "@/lib/site-font";
import { cn } from "@/lib/utils";

/**
 * Choosing the storefront typeface.
 *
 * Each option previews itself in its own face — the point of the screen is the
 * shape of the letters, so a list of names in one font would be useless. The
 * preview text is a real category row from the storefront rather than a pangram,
 * because that is where the choice actually shows.
 */

const FONT_VARS: Record<SiteFontKey, string> = {
  plex: "var(--font-plex)",
  cairo: "var(--font-cairo)",
  tajawal: "var(--font-tajawal)",
  almarai: "var(--font-almarai)",
  kufi: "var(--font-kufi)",
  alexandria: "var(--font-alexandria)",
  readex: "var(--font-readex)",
  changa: "var(--font-changa)",
  messiri: "var(--font-messiri)",
  baloo: "var(--font-baloo)",
  noto: "var(--font-noto)",
};

export function FontPicker({ current }: { current: SiteFontKey }) {
  const [chosen, setChosen] = useState<SiteFontKey>(current);
  const [state, formAction] = useActionState<SettingsState, FormData>(saveSiteFont, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
          {state.message}
        </p>
      )}

      <input type="hidden" name="font" value={chosen} />

      <ul role="radiogroup" aria-label="خط الموقع" className="space-y-2">
        {SITE_FONTS.map((font) => {
          const picked = chosen === font.key;

          return (
            <li key={font.key}>
              <button
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => setChosen(font.key)}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition",
                  picked
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-ink hover:border-brand/40",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-fg">{font.label}</span>
                    <span className="text-[11px] text-muted-2">{font.note}</span>
                  </div>

                  {/* Shown in the face it selects, and deliberately containing
                      the letters that differ most between Arabic typefaces: a
                      final ي, a final ى, and digits. Some faces draw the final
                      yeh without its dots, which is invisible in a preview that
                      does not include one. */}
                  <p
                    style={{ fontFamily: FONT_VARS[font.key] }}
                    className="truncate text-base font-bold text-fg"
                  >
                    ببجي · فري فاير · شحن رصيد · 1,250
                  </p>
                  <p
                    style={{ fontFamily: FONT_VARS[font.key] }}
                    className="truncate text-xs text-muted"
                  >
                    المتاجر · الألعاب · التعليم · ليبيا للاتصالات
                  </p>
                </div>

                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
                    picked ? "border-brand" : "border-line",
                  )}
                >
                  {picked && <Check className="size-3 text-brand" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <SaveButton disabled={chosen === current} />
    </form>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="tap rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
    >
      {pending ? "جارٍ الحفظ…" : disabled ? "هذا الخط مطبَّق" : "تطبيق الخط"}
    </button>
  );
}
