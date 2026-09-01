"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Appearance: داكن / فاتح / حسب الجهاز.
 *
 * The chosen preference is stored; "system" follows the operating system and
 * keeps following it while the app is open. The applied value lives on
 * <html data-theme>, which every colour token reads from.
 */
export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "pluscard.theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

/**
 * Page background per theme. The sticky header is painted with this exact
 * colour, and it is mirrored into `theme-color` so the status bar behind the
 * clock / signal / Wi-Fi / battery icons matches the header seamlessly. The
 * matching `color-scheme` on :root is what tells the platform to draw those
 * icons light on dark and dark on light.
 */
export const DARK_INK = "#111827";
export const LIGHT_INK = "#f5f7fb";

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "light" ? LIGHT_INK : DARK_INK);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // Adopt whatever the inline boot script already applied.
  useEffect(() => {
    const stored = readPreference();
    setPreferenceState(stored);
    setResolved(stored === "system" ? systemTheme() : stored);
  }, []);

  // Follow the operating system while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = query.matches ? "light" : "dark";
      setResolved(next);
      applyTheme(next);
    };

    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const applied = next === "system" ? systemTheme() : next;
    setResolved(applied);
    applyTheme(applied);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

/**
 * Runs before first paint so the saved theme is applied without a flash of the
 * wrong palette. It also sets `theme-color` up front — that is the colour the
 * browser paints behind the status bar, so painting it late would show a
 * mismatched strip above the sticky header for a frame.
 *
 * Kept dependency-free and tiny on purpose.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"dark";var r=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.dataset.theme=r;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",r==="light"?"${LIGHT_INK}":"${DARK_INK}");}catch(e){document.documentElement.dataset.theme="dark";}})();`;
