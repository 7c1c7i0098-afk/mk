import { FontPicker } from "@/components/admin/font-picker";
import { appleConfigured, googleConfigured } from "@/lib/auth/oauth";
import { getSiteFont } from "@/lib/site-font-server";
import { isEmailConfigured } from "@/lib/mailer";
import { prisma } from "@/lib/db";

/** Read-only overview of stored settings and external integrations. */
export default async function AdminSettingsPage() {
  const [settings, font] = await Promise.all([
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
    getSiteFont(),
  ]);

  const integrations = [
    { label: "تسجيل الدخول عبر Google", ready: googleConfigured(), env: "GOOGLE_CLIENT_ID" },
    { label: "تسجيل الدخول عبر Apple", ready: appleConfigured(), env: "APPLE_CLIENT_ID" },
    { label: "إرسال رموز التحقق بالبريد", ready: isEmailConfigured(), env: "RESEND_API_KEY" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-fg">الإعدادات</h1>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h2 className="text-sm font-bold text-fg">خط الموقع</h2>
          <p className="text-[11px] text-muted-2">
            يُطبَّق على المتجر ولوحة التحكم معاً — كل خيار معروض بخطّه نفسه
          </p>
        </div>

        <FontPicker current={font} />
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-fg">التكاملات</h2>
        <ul className="divide-y divide-line">
          {integrations.map((integration) => (
            <li key={integration.env} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{integration.label}</p>
                <p dir="ltr" className="truncate text-start text-[11px] text-muted-2">
                  {integration.env}
                </p>
              </div>
              <span
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                  integration.ready
                    ? "border border-success/40 bg-success/10 text-success"
                    : "border border-line bg-surface-2 text-muted"
                }`}
              >
                {integration.ready ? "مفعّل" : "غير مُعد"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-fg">
          إعدادات المتجر
        </h2>
        <ul className="divide-y divide-line">
          {settings.map((setting) => (
            <li key={setting.key} className="flex items-center gap-3 px-4 py-3">
              <span dir="ltr" className="flex-1 truncate text-start text-xs text-muted">
                {setting.key}
              </span>
              <span className="truncate text-sm text-fg">{setting.value || "—"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
