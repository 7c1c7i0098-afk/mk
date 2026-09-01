"use client";

export default function ShopError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-line bg-surface px-6 py-16 text-center">
      <h1 className="text-lg font-bold text-fg">حدث خطأ غير متوقع</h1>
      <p className="max-w-xs text-sm text-muted">
        تعذّر تحميل هذه الصفحة، يرجى المحاولة مرة أخرى.
      </p>
      <button
        type="button"
        onClick={reset}
        className="tap mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
