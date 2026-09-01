"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/db";
import { SITE_FONT_KEY, isSiteFont } from "@/lib/site-font";

/**
 * Store appearance settings.
 *
 * The font is stored as a key and validated against the list the app ships, so
 * this endpoint cannot be used to point the storefront at an arbitrary font.
 */

export type SettingsState = { ok?: boolean; error?: string; message?: string };

export async function saveSiteFont(
  _state: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  try {
    await assertAdmin();

    const value = form.get("font");
    if (typeof value !== "string" || !isSiteFont(value)) {
      return { error: "الخط المختار غير معروف" };
    }

    await prisma.setting.upsert({
      where: { key: SITE_FONT_KEY },
      create: { key: SITE_FONT_KEY, value },
      update: { value },
    });

    // The font lives on <html>, so every page has to be re-rendered.
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");

    return { ok: true, message: "تم تغيير الخط — حدّث الصفحة لرؤيته" };
  } catch (error) {
    console.error("[admin/saveSiteFont]", error);
    return { error: "تعذّر حفظ الخط" };
  }
}
