import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * The written pages — terms, privacy, and the shop's social links.
 *
 * Held in the settings table rather than hard-coded so the owner can rewrite
 * them without a deploy, with the text below as what ships until they do. The
 * defaults are real Libyan-shop terms, not lorem: a legal page nobody has
 * edited yet should still say something true.
 *
 * Every read falls back rather than throwing. A missing row must never be the
 * reason a page 500s.
 */

export const CONTENT_KEYS = {
  terms: "content.terms",
  privacy: "content.privacy",
  whatsapp: "social.whatsapp",
  telegram: "social.telegram",
  facebook: "social.facebook",
  instagram: "social.instagram",
  phone: "social.phone",
} as const;

const DEFAULT_TERMS = `## قبول الشروط
باستخدامك متجر PLUS CARD فإنك توافق على هذه الشروط. إن لم تكن موافقاً عليها، لا تستخدم المتجر.

## الحساب
- الحساب شخصي، وأنت مسؤول عن الحفاظ على كلمة المرور وعن كل ما يجري من خلاله.
- يُمنع استخدام حساب شخص آخر أو إعطاء بياناتك لغيرك.
- يحق للمتجر إيقاف أي حساب يُستخدم في الاحتيال أو إعادة البيع المخالف.

## الشراء والرصيد
- الأسعار المعروضة وقت الشراء هي الأسعار المطبَّقة، وتُخصم من رصيد محفظتك مباشرة.
- إن تعذّر تنفيذ أي منتج من مزوّده يُعاد مبلغه تلقائياً إلى محفظتك.
- رصيد المحفظة مخصّص للشراء داخل المتجر فقط ولا يُصرف نقداً.

## البطاقات والأكواد
- الكود الرقمي يُسلَّم فور اكتمال الطلب ويظهر في صفحة الطلب.
- بعد ظهور الكود لا يمكن إلغاء الطلب أو استرجاع قيمته، لأن الكود يُعدّ مستهلكاً بمجرّد كشفه.
- تأكّد من اختيار المنتج والفئة الصحيحة قبل الشراء؛ الشحن إلى حساب خاطئ مسؤولية المشتري.

## تحويل الرصيد
- التحويل بين الحسابات فوري ونهائي ولا يمكن التراجع عنه.
- تأكّد من معرّف حساب المستلم قبل الإرسال؛ المتجر غير مسؤول عن تحويل إلى معرّف خاطئ.

## الدعم
لأي مشكلة في طلب، راسلنا من صفحة المساعدة داخل التطبيق مع رقم الطلب.

## التعديلات
قد تُحدَّث هذه الشروط، ويسري التحديث من تاريخ نشره في هذه الصفحة.`;

const DEFAULT_PRIVACY = `## ما الذي نجمعه
- بيانات الحساب: الاسم والبريد الإلكتروني ورقم الهاتف إن أدخلته.
- بيانات الطلبات: ما اشتريته ومتى وبكم، وحركات محفظتك.
- البيانات التي يطلبها المزوّد لتنفيذ منتج معيّن، مثل معرّف اللاعب.

## لماذا نجمعها
لتنفيذ طلباتك، وتسليم الأكواد، وحلّ مشاكل الدعم، ومنع الاحتيال. لا نستخدمها لغير ذلك.

## ما لا نفعله
- لا نبيع بياناتك ولا نؤجّرها لأي جهة.
- لا نشارك بياناتك مع أي طرف إلا القدر اللازم لتنفيذ طلبك لدى مزوّد الخدمة.
- لا نحتفظ ببيانات بطاقتك البنكية داخل المتجر.

## أكوادك
الأكواد التي تشتريها تظهر لك وحدك داخل حسابك، ولا يمكن الوصول إليها من رابط عام.

## حقوقك
يمكنك طلب تصحيح بياناتك أو حذف حسابك بمراسلتنا من صفحة المساعدة. حذف الحساب لا يمحو سجلات الطلبات التي يلزم الاحتفاظ بها محاسبياً.

## التواصل
لأي سؤال عن الخصوصية، راسلنا من داخل التطبيق.`;

async function readSettings(keys: string[]): Promise<Map<string, string>> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    console.error("[site-content]", error);
    return new Map();
  }
}

export const getLegalText = cache(async (page: "terms" | "privacy") => {
  const key = CONTENT_KEYS[page];
  const values = await readSettings([key]);
  const stored = values.get(key)?.trim();
  if (stored) return stored;
  return page === "terms" ? DEFAULT_TERMS : DEFAULT_PRIVACY;
});

export type SocialLink = {
  key: string;
  label: string;
  href: string;
  handle: string;
};

/** Only the channels the owner has actually filled in are shown. */
export const getSocialLinks = cache(async (): Promise<SocialLink[]> => {
  const keys = [
    CONTENT_KEYS.whatsapp,
    CONTENT_KEYS.telegram,
    CONTENT_KEYS.facebook,
    CONTENT_KEYS.instagram,
    CONTENT_KEYS.phone,
  ];
  const values = await readSettings(keys);

  const digits = (value: string) => value.replace(/[^\d+]/g, "");

  const candidates: SocialLink[] = [
    {
      key: "whatsapp",
      label: "واتساب",
      handle: values.get(CONTENT_KEYS.whatsapp) ?? "",
      href: `https://wa.me/${digits(values.get(CONTENT_KEYS.whatsapp) ?? "").replace(/^\+/, "")}`,
    },
    {
      key: "telegram",
      label: "تلغرام",
      handle: values.get(CONTENT_KEYS.telegram) ?? "",
      href: `https://t.me/${(values.get(CONTENT_KEYS.telegram) ?? "").replace(/^@/, "")}`,
    },
    {
      key: "facebook",
      label: "فيسبوك",
      handle: values.get(CONTENT_KEYS.facebook) ?? "",
      href: values.get(CONTENT_KEYS.facebook) ?? "",
    },
    {
      key: "instagram",
      label: "إنستغرام",
      handle: values.get(CONTENT_KEYS.instagram) ?? "",
      href: `https://instagram.com/${(values.get(CONTENT_KEYS.instagram) ?? "").replace(/^@/, "")}`,
    },
    {
      key: "phone",
      label: "اتصال",
      handle: values.get(CONTENT_KEYS.phone) ?? "",
      href: `tel:${digits(values.get(CONTENT_KEYS.phone) ?? "")}`,
    },
  ];

  return candidates.filter((link) => link.handle.trim().length > 0);
});
