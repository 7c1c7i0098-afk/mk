import Link from "next/link";

/** Shared shell for every authentication screen. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center">
        <Link href="/" className="inline-block text-xl font-bold tracking-wide text-fg">
          PLUS<span className="text-brand">CARD</span>
        </Link>
      </div>

      <div className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-lg font-bold text-fg">{title}</h1>
          {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {children}
      </div>

      {footer && <div className="text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
