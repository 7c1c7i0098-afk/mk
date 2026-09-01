import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
      <p className="num text-5xl font-bold text-brand">404</p>
      <h1 className="text-lg font-bold text-fg">الصفحة غير موجودة</h1>
      <Link
        href="/"
        className="tap mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
