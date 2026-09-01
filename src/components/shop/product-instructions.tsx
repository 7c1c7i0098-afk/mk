import { ExternalLink } from "lucide-react";

export type InstructionContent = {
  description: string | null;
  usageInstructions: string | null;
  rechargeInstructions: string | null;
  redemptionInstructions: string | null;
  helpLink: string | null;
};

/**
 * Everything the admin wrote about this card, resolved per product/variant —
 * nothing here is hardcoded, so each product carries its own recharge and
 * redemption steps.
 */
export function ProductInstructions({ content }: { content: InstructionContent }) {
  const sections = [
    { title: "طريقة الاستخدام:", body: content.usageInstructions },
    { title: "طريقة الشحن:", body: content.rechargeInstructions },
    { title: "طريقة التفعيل والاسترداد:", body: content.redemptionInstructions },
  ].filter((section) => Boolean(section.body));

  const helpLink = safeExternalLink(content.helpLink);

  if (!content.description && sections.length === 0 && !helpLink) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="space-y-1.5">
        <h2 className="text-sm font-bold text-fg">الوصف:</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
          {content.description ?? "لا يوجد وصف لهذا المنتج حالياً."}
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-1.5 border-t border-line/70 pt-4">
          <h3 className="text-sm font-bold text-fg">{section.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
            {section.body}
          </p>
        </div>
      ))}

      {helpLink && (
        <a
          href={helpLink}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="tap inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand"
        >
          <ExternalLink className="size-3.5" />
          صفحة الشحن / الاسترداد
        </a>
      )}
    </section>
  );
}

/** Only http(s) links from the admin are rendered — never javascript: or data:. */
function safeExternalLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
