import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Image storage for admin uploads.
 *
 * Files land in public/uploads/<kind>/ under a generated name: the original
 * filename is never trusted, so it cannot be used for path traversal or to
 * overwrite an existing file. The database stores the public path only.
 *
 * Swapping this for S3/R2 later means changing just these two functions.
 */
export const UPLOAD_KINDS = ["categories", "products", "banners", "methods"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/** Accepted types, mapped to the extension we write. */
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Magic-byte signatures — the declared MIME type alone is not trusted. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

export async function storeUpload(file: File, kind: UploadKind): Promise<UploadResult> {
  if (!UPLOAD_KINDS.includes(kind)) {
    return { ok: false, error: "نوع الرفع غير معروف" };
  }
  if (file.size === 0) return { ok: false, error: "الملف فارغ" };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "حجم الصورة يجب أن يكون أقل من 4 ميجابايت" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = sniff(bytes);

  if (!detected || !ALLOWED[detected]) {
    return { ok: false, error: "الصيغة المدعومة: PNG أو JPG أو WebP فقط" };
  }

  const filename = `${randomUUID()}.${ALLOWED[detected]}`;
  const directory = path.join(process.cwd(), "public", "uploads", kind);
  await writeFile(path.join(directory, filename), bytes);

  return { ok: true, path: `/uploads/${kind}/${filename}` };
}

/**
 * Deletes an image that is no longer referenced. Only paths inside
 * public/uploads are ever touched, and failures are ignored on purpose —
 * an orphaned file must never break a save.
 */
export async function removeUpload(publicPath: string | null | undefined) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;

  const relative = publicPath.replace(/^\/+/, "");
  const target = path.join(process.cwd(), "public", relative);
  const root = path.join(process.cwd(), "public", "uploads");

  if (!target.startsWith(root)) return;

  try {
    await unlink(target);
  } catch {
    // already gone, or still in use — nothing to do
  }
}
