import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Arabic-friendly slug: keeps arabic letters, collapses everything else to "-". */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** First two visible characters of a name — used for image placeholders. */
export function initials(name: string): string {
  return [...name.trim()].slice(0, 2).join("");
}
