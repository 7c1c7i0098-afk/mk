import Link from "next/link";

export default function ShopNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-line bg-surface px-6 py-16 text-center">
      <p className="num text-4xl font-bold text-brand">404</p>
      <h1 className="text-lg font-bold text-fg">الصفحة غير موجودة</h1>
      <p className="max-w-xs text-sm text-muted">
        الرابط الذي تحاول فتحه غير متوفر أو تمت إزالته.
      </p>
      <Link
        href="/"
        className="tap mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
