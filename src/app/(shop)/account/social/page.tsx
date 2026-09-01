import type { Metadata } from "next";
import { ExternalLink, MessageCircle } from "lucide-react";
import { AccountScreen } from "@/components/shop/account-screen";
import { getSocialLinks } from "@/lib/site-content";

export const metadata: Metadata = { title: "منصات التواصل" };

export default async function SocialPage() {
  const links = await getSocialLinks();

  return (
    <AccountScreen title="منصات التواصل">
      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MessageCircle className="size-6" />
          </span>
          <p className="pb-0.5 text-sm font-bold leading-[1.7] text-fg">لم تُضَف قنوات بعد</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted">
            حتى ذلك الحين، صفحة المساعدة داخل التطبيق هي أسرع طريق لنا.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {links.map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-3 px-4 py-4 transition hover:bg-surface-2"
                >
                  <span className="flex-1 text-sm font-medium text-fg">{link.label}</span>
                  <span dir="ltr" className="truncate text-xs text-muted">
                    {link.handle}
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-muted-2" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AccountScreen>
  );
}
