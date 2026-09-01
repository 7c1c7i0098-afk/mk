"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Thumb } from "@/components/ui/thumb";
import { cn } from "@/lib/utils";

export type SearchResult = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  categoryName: string;
};

export function SearchBar({
  className,
  placeholder = "ابحث عن منتج أو خدمة...",
}: {
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Debounced lookup — results appear as the user types.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close on outside click / Escape
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search">
        <label htmlFor="site-search" className="sr-only">
          البحث عن منتج
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-2"
            aria-hidden
          />
          <input
            id="site-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-14 w-full rounded-2xl border border-line bg-surface ps-12 pe-11 text-[15px] text-fg placeholder:text-muted outline-none transition focus:border-brand/60 focus:bg-surface-2 focus:ring-4 focus:ring-brand/10"
          />
          {loading ? (
            <Loader2
              className="absolute end-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-2"
              aria-hidden
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-2 transition hover:bg-surface-2 hover:text-fg"
              aria-label="مسح البحث"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              لا توجد نتائج مطابقة لبحثك
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line/70 overflow-y-auto">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={`/product/${result.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-surface-2"
                  >
                    <Thumb
                      src={result.image}
                      alt={result.name}
                      sizes="48px"
                      rounded="rounded-xl"
                      className="size-12 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {result.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {result.categoryName}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {results.length > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="block border-t border-line bg-surface-2/60 px-4 py-3 text-center text-sm font-medium text-brand transition hover:bg-surface-2"
            >
              عرض كل النتائج
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
