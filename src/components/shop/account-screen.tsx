import { BackButton } from "@/components/shop/back-button";

/**
 * The frame every account sub-screen shares.
 *
 * Back arrow on the start side, title on the true centre, and a spacer of the
 * arrow's exact width on the other side so the title does not drift when the
 * arrow is the only control.
 */
export function AccountScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/account" />
        <h1 className="text-glow flex-1 pb-0.5 text-center text-lg font-bold leading-[1.6] text-fg-strong">
          {title}
        </h1>
        <span className="size-6 shrink-0" aria-hidden />
      </div>

      {children}
    </div>
  );
}
