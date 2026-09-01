"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategory, saveCategory, toggleCategory } from "@/app/admin/actions";
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

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const showForm = creating || editing !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-fg">الفئات</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="tap ms-auto flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="size-4" />
            فئة جديدة
          </button>
        )}
      </div>

      {showForm && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-4 text-sm font-bold text-fg">
            {editing ? `تعديل: ${editing.name}` : "فئة جديدة"}
          </h2>

          <ActionForm
            key={editing?.id ?? "new"}
            action={saveCategory}
            className="space-y-4"
            onDone={() => {
              setEditing(null);
              setCreating(false);
            }}
          >
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="اسم الفئة">
                <input
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                  className={inputClass}
                />
              </AdminField>

              <AdminField label="الرابط (slug)" hint="اتركه فارغاً ليُولّد من الاسم">
                <input
                  name="slug"
                  dir="ltr"
                  defaultValue={editing?.slug ?? ""}
                  className={inputClass}
                />
              </AdminField>

              <AdminField label="ترتيب العرض">
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={editing?.sortOrder ?? 0}
                  className={inputClass}
                />
              </AdminField>

              <div className="flex items-end pb-3">
                <AdminToggle
                  name="isActive"
                  label="مفعّلة"
                  defaultChecked={editing?.isActive ?? true}
                />
              </div>
            </div>

            <ImageUpload kind="categories" initialPath={editing?.image} label="صورة الفئة" />

            <div className="flex gap-2">
              <SubmitButton>حفظ</SubmitButton>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setCreating(false);
                }}
                className="tap rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg"
              >
                إلغاء
              </button>
            </div>
          </ActionForm>
        </section>
      )}

      <ul className="space-y-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
          >
            <Thumb
              src={category.image}
              alt={category.name}
              sizes="56px"
              rounded="rounded-xl"
              className="size-14 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{category.name}</p>
              <p dir="ltr" className="truncate text-start text-xs text-muted">
                /{category.slug}
              </p>
              <p className="num text-[11px] text-muted-2">
                {category._count.products} منتج · ترتيب {category.sortOrder}
              </p>
            </div>

            <ConfirmForm
              action={toggleCategory}
              id={category.id}
              message={
                category.isActive ? "إخفاء هذه الفئة من المتجر؟" : "إظهار هذه الفئة في المتجر؟"
              }
            >
              <button
                type="submit"
                className={`tap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                  category.isActive
                    ? "border border-success/40 bg-success/10 text-success"
                    : "border border-line bg-surface-2 text-muted"
                }`}
              >
                {category.isActive ? "مفعّلة" : "معطّلة"}
              </button>
            </ConfirmForm>

            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(category);
              }}
              aria-label={`تعديل ${category.name}`}
              className="tap grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg"
            >
              <Pencil className="size-4" />
            </button>

            <ConfirmForm
              action={deleteCategory}
              id={category.id}
              message={`حذف الفئة "${category.name}" نهائياً؟`}
            >
              <button
                type="submit"
                aria-label={`حذف ${category.name}`}
                className="tap grid size-9 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </ConfirmForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
