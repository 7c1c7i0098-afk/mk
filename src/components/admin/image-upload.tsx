"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { UploadKind } from "@/lib/admin/uploads";

/**
 * Pick an image from the device, preview it, upload it, and keep the resulting
 * public path in a hidden field that the server action reads on save.
 * No manual file copying, no path editing.
 */
export function ImageUpload({
  name = "image",
  kind,
  initialPath,
  label = "الصورة",
}: {
  name?: string;
  kind: UploadKind;
  initialPath?: string | null;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(initialPath ?? "");
  const [preview, setPreview] = useState(initialPath ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    // Instant local preview while the upload runs.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);

      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as { path?: string; error?: string };

      if (!response.ok || !data.path) {
        setPreview(path);
        toast.error(data.error ?? "تعذّر رفع الصورة");
        return;
      }

      setPath(data.path);
      setPreview(data.path);
      toast.success("تم رفع الصورة");
    } catch {
      setPreview(path);
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-fg">{label}</span>
      <input type="hidden" name={name} value={path} />

      <div className="flex items-center gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-ink">
          {preview ? (
            // Local blob previews cannot go through the image optimizer.
            preview.startsWith("blob:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="معاينة" className="size-full object-cover" />
            ) : (
              <Image src={preview} alt="معاينة" fill sizes="96px" className="object-cover" />
            )
          ) : (
            <div className="grid size-full place-items-center text-muted-2">
              <ImagePlus className="size-6" />
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-ink/70">
              <Loader2 className="size-5 animate-spin text-brand" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="tap rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-fg hover:border-brand/40 disabled:opacity-60"
          >
            {path ? "تغيير الصورة" : "اختيار صورة من الجهاز"}
          </button>

          {path && (
            <button
              type="button"
              onClick={() => {
                setPath("");
                setPreview("");
              }}
              className="tap flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-3.5" />
              إزالة
            </button>
          )}

          <p className="text-[11px] text-muted-2">PNG أو JPG أو WebP — حتى 4 ميجابايت</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
