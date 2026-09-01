import { NextResponse, type NextRequest } from "next/server";
import { apiError, apiFailure } from "@/lib/api";
import { requireAdmin } from "@/lib/admin/guard";
import { storeUpload, UPLOAD_KINDS, type UploadKind } from "@/lib/admin/uploads";

/** Admin-only image upload. Returns the public path to store on the record. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("غير مصرّح", 403);

    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");

    if (!(file instanceof File)) return apiError("لم يتم اختيار ملف", 422);
    if (!UPLOAD_KINDS.includes(kind as UploadKind)) {
      return apiError("نوع الرفع غير معروف", 422);
    }

    const result = await storeUpload(file, kind as UploadKind);
    if (!result.ok) return apiError(result.error, 422);

    return NextResponse.json({ ok: true, path: result.path });
  } catch (error) {
    return apiFailure("api/admin/upload", error);
  }
}
