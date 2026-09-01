import { NextResponse, type NextRequest } from "next/server";
import {
  callbackUrl,
  clearTransientState,
  exchangeCode,
  providerConfigured,
  readTransientState,
  type Provider,
} from "@/lib/auth/oauth";
import { resolveOAuthUser } from "@/lib/auth/service";
import { safeRedirect } from "@/lib/safe-redirect";
import { createSession } from "@/lib/session";

const PROVIDERS = new Set<Provider>(["google", "apple"]);

/** Google redirects back with a query string. */
export async function GET(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  const params = request.nextUrl.searchParams;
  return handleCallback(request, provider, {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    user: null,
  });
}

/** Apple posts the result as a form (response_mode=form_post). */
export async function POST(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  const form = await request.formData();
  return handleCallback(request, provider, {
    code: (form.get("code") as string) ?? null,
    state: (form.get("state") as string) ?? null,
    error: (form.get("error") as string) ?? null,
    // Apple sends the display name once, on the very first authorization.
    user: (form.get("user") as string) ?? null,
  });
}

type Context = { params: Promise<{ provider: string }> };

type CallbackInput = {
  code: string | null;
  state: string | null;
  error: string | null;
  user: string | null;
};

function failure(request: NextRequest, message: string, next: string) {
  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`,
      request.url,
    ),
  );
}

async function handleCallback(request: NextRequest, provider: string, input: CallbackInput) {
  const stored = await readTransientState();
  const next = safeRedirect(stored.next);

  if (!PROVIDERS.has(provider as Provider)) {
    return NextResponse.json({ error: "مزوّد غير معروف" }, { status: 404 });
  }
  const typedProvider = provider as Provider;

  try {
    if (!providerConfigured(typedProvider)) {
      return failure(request, "هذا المزوّد غير مفعّل", next);
    }
    if (input.error) {
      return failure(request, "تم إلغاء عملية تسجيل الدخول", next);
    }
    if (!input.code || !input.state) {
      return failure(request, "استجابة غير مكتملة من المزوّد", next);
    }
    // CSRF guard: the state must match the one issued to this browser.
    if (!stored.state || stored.state !== input.state || !stored.verifier || !stored.nonce) {
      return failure(request, "انتهت صلاحية الجلسة، حاول مرة أخرى", next);
    }

    const claims = await exchangeCode({
      provider: typedProvider,
      code: input.code,
      redirectUri: callbackUrl(typedProvider, request.url),
      verifier: stored.verifier,
      nonce: stored.nonce,
    });

    // Apple only ever sends the name on first authorization.
    let name = claims.name;
    if (!name && input.user) {
      try {
        const parsed = JSON.parse(input.user) as { name?: { firstName?: string; lastName?: string } };
        name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ") || null;
      } catch {
        name = null;
      }
    }

    const user = await resolveOAuthUser({
      provider: typedProvider,
      providerAccountId: claims.sub,
      email: claims.email,
      emailVerified: claims.emailVerified,
      name,
      image: claims.picture,
    });

    if (user.status === "SUSPENDED") {
      return failure(request, "تم إيقاف هذا الحساب، يرجى التواصل مع الدعم", next);
    }

    await createSession(user.id, user.role, {
      remember: true,
      sessionVersion: user.sessionVersion,
    });

    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    console.error(`[api/auth/${provider}/callback]`, error);
    return failure(request, "تعذّر إكمال تسجيل الدخول، حاول مرة أخرى", next);
  } finally {
    await clearTransientState();
  }
}
