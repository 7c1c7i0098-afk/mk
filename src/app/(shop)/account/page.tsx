import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  Globe,
  Headset,
  Palette,
  Receipt,
  Send,
  Share2,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { AuthDivider, SocialButtons } from "@/components/auth/social-buttons";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { AdminEntry } from "@/components/shop/admin-entry";
import { MoneyText } from "@/components/shop/money-text";
import { formatBps } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";
import { totalSpent } from "@/lib/wallet/transfer";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "حسابي" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  // Guests get the authentication screen rather than an empty account.
  if (!user) {
    return (
      <div className="space-y-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-fg">
          <span className="h-4 w-1 rounded-full bg-brand" aria-hidden />
          حسابي
        </h1>

        <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 text-center">
          <p className="text-sm leading-relaxed text-muted">
            سجّل الدخول للوصول إلى محفظتك وطلباتك ومفضلتك.
            <br />
            يمكنك التصفّح والإضافة إلى السلة بدون حساب.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/login?next=/account"
              className="tap rounded-2xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-600"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register?next=/account"
              className="tap rounded-2xl border border-line bg-surface-2 py-3 text-sm font-bold text-fg hover:border-brand/40"
            >
              إنشاء حساب
            </Link>
          </div>

          <AuthDivider />
          <SocialButtons next="/account" />
        </div>

        <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-fg">المظهر</h2>
          <ThemeSelector />
        </section>
      </div>
    );
  }

  const isPlaceholderEmail = user.email.endsWith("@users.pluscard.local");
  const subtitle = user.phone ?? (isPlaceholderEmail ? null : user.email);
  const spent = await totalSpent(user.id);

  return (
    <div className="space-y-6">
      {/* Identity on the start side, money on the end side. */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-surface-2 text-xl font-bold text-brand">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate pb-0.5 text-lg font-bold leading-[1.6] text-fg">
              {user.name}
            </p>
            {subtitle && (
              <p dir="ltr" className="tnum truncate text-start text-sm text-muted">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <Link
          href="/wallet"
          aria-label={`رصيدك ${user.balance}`}
          className="tap flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 transition hover:border-brand/40"
        >
          <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
          <MoneyText value={user.balance} className="text-base font-bold text-fg" />
        </Link>
      </header>

      {user.discountBps > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-brand/40 bg-brand-soft px-4 py-3">
          <span className="text-sm text-brand">خصم خاص على كل المنتجات</span>
          <span className="num text-base font-bold text-brand">
            {formatBps(user.discountBps)}
          </span>
        </div>
      )}

      <nav aria-label="اختصارات" className="grid grid-cols-3 gap-2.5">
        <Shortcut href="/wallet" label="المحفظة" icon={Wallet} tone="text-brand" />
        <Shortcut href="/support" label="المساعدة" icon={Headset} tone="text-warn" />
        <Shortcut
          href="/account/transfer"
          label="تحويل رصيد"
          icon={Send}
          tone="text-success"
        />
      </nav>

      <Group title="الحساب والإعدادات">
        <Row href="/account/profile" label="المعلومات الشخصية" icon={UserRound} />
        {/* Not a link: it is the one number on this screen, and the country row
            in a settings list is exactly the shape a value belongs in. */}
        <Row
          label="الرصيد المنفق"
          icon={Receipt}
          value={<MoneyText value={spent} className="text-sm font-bold text-fg" />}
        />
        <Row href="/account/language" label="اللغة" icon={Globe} value="العربية" />
        <Row href="/account/appearance" label="المظهر" icon={Palette} />
      </Group>

      <Group title={`حول ${STORE_NAME}`}>
        <Row href="/account/terms" label="الشروط والأحكام" icon={FileText} />
        <Row href="/account/privacy" label="سياسة الخصوصية" icon={ShieldCheck} />
        <Row href="/account/social" label="منصات التواصل" icon={Share2} />
      </Group>

      {user.role === "ADMIN" && <AdminEntry />}

      <LogoutButton />
    </div>
  );
}

const STORE_NAME = "PLUS CARD";

/**
 * One of the three tiles: a coloured glyph inside an outlined square.
 *
 * The colour is on the icon alone, never as a fill — a tinted block would put
 * three loud panels on a screen that is otherwise all outlines. Green and amber
 * carry status meaning elsewhere in the app; here there is no status in sight,
 * and the three shortcuts read faster apart than they do as one grey row.
 */
function Shortcut({
  href,
  label,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  icon: typeof Wallet;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="tap flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-line px-2 py-4 text-center transition hover:border-brand/40"
    >
      <span className={`grid size-11 place-items-center rounded-xl border border-line ${tone}`}>
        <Icon className="size-5.5" aria-hidden />
      </span>
      <span className="pb-0.5 text-xs font-bold leading-[1.7] text-fg">{label}</span>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 pb-0.5 text-sm font-bold leading-[1.7] text-fg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A settings row. Each is its own card rather than a divided list, so the
 * groups above them read as groups instead of one long strip.
 *
 * Without `href` it renders as a plain row and loses the chevron: the arrow is
 * the promise of another screen, and a row that shows a value has none to give.
 */
function Row({
  href,
  label,
  icon: Icon,
  value,
}: {
  href?: string;
  label: string;
  icon: typeof Wallet;
  value?: React.ReactNode;
}) {
  const body = (
    <>
      <Icon className="size-5 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate pb-0.5 text-sm font-medium leading-[1.7] text-fg">
        {label}
      </span>
      {value !== undefined && (
        <span className="shrink-0 text-sm text-muted">{value}</span>
      )}
      {href && <ChevronLeft className="size-4 shrink-0 text-muted-2" aria-hidden />}
    </>
  );

  const shell = "flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={`tap ${shell} transition hover:border-brand/40`}>
      {body}
    </Link>
  );
}
