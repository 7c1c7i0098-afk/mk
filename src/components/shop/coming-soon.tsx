/**
 * Placeholder for customer pages that are implemented in a later stage.
 * It lives inside the (shop) group on purpose: the header, bottom navigation
 * and floating cart bar stay available while navigating.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold text-fg">
        <span className="h-4 w-1 rounded-full bg-brand" aria-hidden />
        {title}
      </h1>
      <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}
