/**
 * Email delivery abstraction.
 *
 * Drivers:
 *   - "resend"  — set RESEND_API_KEY (+ optional MAIL_FROM). No SDK needed.
 *   - "console" — the fallback while no provider is configured: the message is
 *                 printed to the server log so the flow is fully testable in
 *                 development. It is refused in production.
 *
 * No credentials are invented here; if nothing is configured the driver is
 * "console" and `isEmailConfigured()` reports false.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const FROM = process.env.MAIL_FROM ?? "PLUS CARD <onboarding@resend.dev>";

export function emailDriver(): "resend" | "console" {
  return process.env.RESEND_API_KEY ? "resend" : "console";
}

export function isEmailConfigured() {
  return emailDriver() !== "console";
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (emailDriver() === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend rejected the message (${response.status}): ${detail}`);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No email provider configured. Set RESEND_API_KEY before running in production.",
    );
  }

  console.info(
    [
      "",
      "──────────── PLUS CARD — بريد تجريبي (لا يوجد مزوّد بريد مُعد) ────────────",
      `إلى:      ${message.to}`,
      `الموضوع:  ${message.subject}`,
      "",
      message.text,
      "──────────────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

/** Branded PLUS CARD verification email carrying the 6-digit code. */
export function verificationEmail(options: {
  code: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
  expiresInMinutes: number;
}): Omit<MailMessage, "to"> {
  const isReset = options.purpose === "PASSWORD_RESET";
  const title = isReset ? "إعادة تعيين كلمة المرور" : "تأكيد بريدك الإلكتروني";
  const intro = isReset
    ? "استخدم الرمز التالي لإعادة تعيين كلمة مرور حسابك في PLUS CARD."
    : "أهلاً بك في PLUS CARD. استخدم الرمز التالي لتأكيد بريدك الإلكتروني.";

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:24px;background:#0f1117;font-family:'Segoe UI',system-ui,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#1a1d26;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">
            PLUS<span style="color:#3b82f6;">CARD</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px;text-align:center;">
          <h1 style="margin:12px 0 6px;font-size:18px;color:#ffffff;">${title}</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#9ba3b4;">${intro}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;text-align:center;">
          <div style="display:inline-block;padding:14px 26px;background:#111827;border:1px solid #2b3547;border-radius:14px;font-size:30px;font-weight:700;letter-spacing:10px;color:#3b82f6;direction:ltr;">
            ${options.code}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 26px;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.8;color:#6b7385;">
            الرمز صالح لمدة ${options.expiresInMinutes} دقائق ويُستخدم مرة واحدة فقط.<br />
            إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `PLUS CARD — ${title}`,
    "",
    intro,
    "",
    `رمز التحقق: ${options.code}`,
    `صالح لمدة ${options.expiresInMinutes} دقائق، ويُستخدم مرة واحدة.`,
  ].join("\n");

  return { subject: `PLUS CARD — ${title}: ${options.code}`, html, text };
}
