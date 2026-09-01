"use client";

import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/admin/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  ActionForm,
  AdminField,
  AdminToggle,
  SubmitButton,
  inputClass,
  textareaClass,
} from "@/components/admin/ui";

type Product = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  usageInstructions: string | null;
  rechargeInstructions: string | null;
  redemptionInstructions: string | null;
  helpLink: string | null;
  region: string | null;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
};

export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <ActionForm
        action={saveProduct}
        className="space-y-4"
        onDone={() => router.push("/admin/products")}
      >
        {product && <input type="hidden" name="id" value={product.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="اسم المنتج">
            <input name="name" defaultValue={product?.name ?? ""} required className={inputClass} />
          </AdminField>

          <AdminField label="الفئة">
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              required
              className={inputClass}
            >
              <option value="" disabled>
                اختر الفئة
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="الرابط (slug)" hint="اتركه فارغاً ليُولّد من الاسم">
            <input name="slug" dir="ltr" defaultValue={product?.slug ?? ""} className={inputClass} />
          </AdminField>

          <AdminField label="المنطقة" hint="اختياري — مثل USA أو Turkey">
            <input name="region" defaultValue={product?.region ?? ""} className={inputClass} />
          </AdminField>

          <AdminField label="ترتيب العرض">
            <input
              name="sortOrder"
              type="number"
              defaultValue={product?.sortOrder ?? 0}
              className={inputClass}
            />
          </AdminField>

          <div className="flex items-end pb-3">
            <AdminToggle name="isActive" label="مفعّل" defaultChecked={product?.isActive ?? true} />
          </div>
        </div>

        {/* Everything below is shown on the customer-facing details screen.
            Each product carries its own text — nothing is hardcoded in the
            app, and a denomination may override any of it. */}
        <AdminField label="الوصف" hint="يظهر تحت عنوان «الوصف:» في صفحة تفاصيل المنتج">
          <textarea
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
            className={textareaClass}
          />
        </AdminField>

        <AdminField label="طريقة الاستخدام" hint="كيف يستخدم العميل الكود بعد الشراء">
          <textarea
            name="usageInstructions"
            rows={4}
            defaultValue={product?.usageInstructions ?? ""}
            className={textareaClass}
          />
        </AdminField>

        <AdminField label="طريقة الشحن" hint="خطوات شحن الرصيد بالكود">
          <textarea
            name="rechargeInstructions"
            rows={4}
            defaultValue={product?.rechargeInstructions ?? ""}
            className={textareaClass}
          />
        </AdminField>

        <AdminField label="طريقة التفعيل والاسترداد" hint="خطوات تفعيل أو استرداد البطاقة">
          <textarea
            name="redemptionInstructions"
            rows={4}
            defaultValue={product?.redemptionInstructions ?? ""}
            className={textareaClass}
          />
        </AdminField>

        <AdminField
          label="رابط المساعدة / الاسترداد"
          hint="اختياري — رابط https خارجي موثوق"
        >
          <input
            name="helpLink"
            type="url"
            dir="ltr"
            placeholder="https://"
            defaultValue={product?.helpLink ?? ""}
            className={inputClass}
          />
        </AdminField>

        <ImageUpload kind="products" initialPath={product?.image} label="صورة المنتج" />

        <div className="flex gap-2">
          <SubmitButton>حفظ المنتج</SubmitButton>
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="tap rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg"
          >
            إلغاء
          </button>
        </div>
      </ActionForm>
    </section>
  );
}
