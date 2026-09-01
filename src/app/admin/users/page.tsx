import Link from "next/link";
import { Search } from "lucide-react";
import { UserAdmin, type AuditEntry } from "@/components/admin/user-admin";
import { inputClass } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { normalisePublicId } from "@/lib/public-id";

type PageProps = { searchParams: Promise<{ q?: string }> };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Look a customer up by their account id, then manage their wallet and
 * discounts. The page is server-rendered behind `requireAdminPage`, and every
 * mutation it offers re-checks the admin role again on the server.
 */
export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdminPage();

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const publicId = normalisePublicId(query);

  const match = query
    ? await prisma.user.findFirst({
        where: {
          OR: [
            ...(publicId ? [{ publicId }] : []),
            { email: query.toLowerCase() },
          ],
        },
        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
          balance: true,
          discountBps: true,
          status: true,
          role: true,
          createdAt: true,
          discounts: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              percentBps: true,
              productId: true,
              product: { select: { name: true } },
            },
          },
        },
      })
    : null;

  const [audit, products, recent] = await Promise.all([
    match
      ? prisma.adminActionLog.findMany({
          where: { targetUserId: match.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceBefore: true,
            balanceAfter: true,
            discountBeforeBps: true,
            discountAfterBps: true,
            productName: true,
            note: true,
            createdAt: true,
            admin: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    match
      ? prisma.product.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    query
      ? Promise.resolve([])
      : prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            publicId: true,
            name: true,
            email: true,
            balance: true,
            discountBps: true,
            role: true,
            status: true,
          },
        }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-fg">المستخدمون</h1>

      {/* Plain GET form: the search is server-side and the result is linkable. */}
      <form method="get" role="search" className="space-y-2">
        <label htmlFor="user-q" className="block text-sm font-medium text-fg">
          البحث بمعرّف المستخدم
        </label>
        <div className="flex gap-2">
          <input
            id="user-q"
            name="q"
            defaultValue={query}
            dir="ltr"
            placeholder="مثال: 646A2P77"
            className={`${inputClass} tracking-widest`}
          />
          <button
            type="submit"
            className="tap grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white hover:bg-brand-600"
            aria-label="بحث"
          >
            <Search className="size-4.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-2">
          يمكن البحث بالمعرّف أو بالبريد الإلكتروني. المعرّف للتعريف فقط ولا يمنح أي صلاحية.
        </p>
      </form>

      {query && !match && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          لا يوجد مستخدم بهذا المعرّف
        </p>
      )}

      {match && (
        <>
          <Link href="/admin/users" className="inline-block text-xs text-brand hover:underline">
            ← عرض كل المستخدمين
          </Link>

          <UserAdmin
            user={{
              id: match.id,
              publicId: match.publicId,
              name: match.name,
              email: match.email,
              balance: match.balance,
              discountBps: match.discountBps,
              status: match.status,
              role: match.role,
              createdAt: dateFormat.format(match.createdAt),
              discounts: match.discounts.map((discount) => ({
                id: discount.id,
                percentBps: discount.percentBps,
                productId: discount.productId,
                productName: discount.product?.name ?? "منتج محذوف",
              })),
            }}
            audit={audit.map(
              (entry): AuditEntry => ({
                id: entry.id,
                type: entry.type,
                amount: entry.amount,
                balanceBefore: entry.balanceBefore,
                balanceAfter: entry.balanceAfter,
                discountBeforeBps: entry.discountBeforeBps,
                discountAfterBps: entry.discountAfterBps,
                productName: entry.productName,
                note: entry.note,
                createdAt: dateFormat.format(entry.createdAt),
                adminName: entry.admin?.name ?? null,
              }),
            )}
            products={products}
          />
        </>
      )}

      {!query && (
        <ul className="space-y-2">
          {recent.map((user) => (
            <li key={user.id}>
              <Link
                href={`/admin/users?q=${encodeURIComponent(user.publicId ?? user.email)}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
                  <p dir="ltr" className="truncate text-start text-xs text-muted">
                    {user.email}
                  </p>
                  <p dir="ltr" className="num truncate text-start text-[11px] tracking-widest text-brand">
                    {user.publicId ?? "—"}
                  </p>
                </div>

                {user.discountBps > 0 && (
                  <span className="num rounded-lg border border-brand/40 bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">
                    -{user.discountBps / 100}%
                  </span>
                )}

                {user.role === "ADMIN" && (
                  <span className="rounded-lg border border-brand/40 bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">
                    مدير
                  </span>
                )}

                {user.status === "SUSPENDED" && (
                  <span className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-[10px] text-danger">
                    موقوف
                  </span>
                )}

                <span className="num shrink-0 text-sm font-bold text-brand">
                  {formatMoney(user.balance)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
