"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteBanner, saveBanner, toggleBanner } from "@/app/admin/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  ActionForm,
  AdminField,
  AdminToggle,
  ConfirmForm,
  SubmitButton,
  inputClass,
} from "@/components/admin/ui";
import { Thumb } from "@/components/ui/thumb";

export type AdminBanner = {
  id: string;
  image: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Full editor for the homepage slider. Everything the storefront shows comes
 * from these rows, so adding, reordering or hiding a banner never needs a code
 * change.
 */
export function BannerManager({ banners }: { banners: AdminBanner[] }) {
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [creating, setCreating] = useState(false);
  const showForm = creating || editing !== null;

  function close() {
    setEditing(null);
    setCreating(false);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-fg">لوحة الإعلانات</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="tap ms-auto flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg hover:border-brand/40"
          >
            <Plus className="size-3.5" />
            إضافة إعلان
          </button>
        )}
      </div>

      {showForm && (
        <ActionForm
          key={editing?.id ?? "new"}
          action={saveBanner}
          className="space-y-4 rounded-2xl border border-line bg-surface p-4"
          onDone={close}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="العنوان">
              <input name="title" defaultValue={editing?.title ?? ""} className={inputClass} />
            </AdminField>

            <AdminField label="الوصف">
              <input name="subtitle" defaultValue={editing?.subtitle ?? ""} className={inputClass} />
            </AdminField>

            <AdminField label="نص الزر" hint="اتركه فارغاً لإخفاء الزر">
              <input name="ctaText" defaultValue={editing?.ctaText ?? ""} className={inputClass} />
            </AdminField>

            <AdminField label="رابط الزر" hint="مسار داخلي مثل /category/games أو رابط https">
              <input
                name="ctaLink"
                dir="ltr"
                defaultValue={editing?.ctaLink ?? ""}
                className={inputClass}
              />
            </AdminField>

            <AdminField label="ترتيب العرض" hint="الأصغر يظهر أولاً">
              <input
                name="sortOrder"
                type="number"
                dir="ltr"
                defaultValue={editing?.sortOrder ?? 0}
                className={inputClass}
              />
            </AdminField>

            <div className="flex items-end pb-3">
              <AdminToggle name="isActive" label="مفعّل" defaultChecked={editing?.isActive ?? true} />
            </div>
          </div>

          <ImageUpload kind="banners" initialPath={editing?.image} label="صورة الإعلان" />

          <div className="flex gap-2">
            <SubmitButton>حفظ الإعلان</SubmitButton>
            <button
              type="button"
              onClick={close}
              className="tap rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg"
            >
              إلغاء
            </button>
          </div>
        </ActionForm>
      )}

      {banners.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          لا توجد إعلانات بعد
        </p>
      ) : (
        <ul className="space-y-2">
          {banners.map((banner) => (
            <li
              key={banner.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            >
              <Thumb
                src={banner.image}
                alt={banner.title ?? "إعلان"}
                sizes="80px"
                rounded="rounded-xl"
                className="size-14 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">
                  {banner.title ?? "بدون عنوان"}
                </p>
                <p className="truncate text-xs text-muted">{banner.subtitle ?? "—"}</p>
                <p className="num truncate text-[11px] text-muted-2">ترتيب {banner.sortOrder}</p>
              </div>

              <ConfirmForm
                action={toggleBanner}
                id={banner.id}
                message={banner.isActive ? "إخفاء هذا الإعلان؟" : "إظهار هذا الإعلان؟"}
              >
                <button
                  type="submit"
                  className={`tap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                    banner.isActive
                      ? "border border-success/40 bg-success/10 text-success"
                      : "border border-line bg-surface-2 text-muted"
                  }`}
                >
                  {banner.isActive ? "مفعّل" : "معطّل"}
                </button>
              </ConfirmForm>

              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(banner);
                }}
                className="tap rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-fg"
              >
                تعديل
              </button>

              <ConfirmForm
                action={deleteBanner}
                id={banner.id}
                message={`حذف الإعلان "${banner.title ?? "بدون عنوان"}"؟`}
              >
                <button
                  type="submit"
                  aria-label="حذف الإعلان"
                  className="tap grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
