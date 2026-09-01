import { NextResponse, type NextRequest } from "next/server";
import {
  APPLE_AUTH_URL,
  GOOGLE_AUTH_URL,
  callbackUrl,
  createPkcePair,
  providerConfigured,
  randomToken,
  storeTransientState,
  type Provider,
} from "@/lib/auth/oauth";
import { safeRedirect } from "@/lib/safe-redirect";

const PROVIDERS = new Set<Provider>(["google", "apple"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!PROVIDERS.has(provider as Provider)) {
    return NextResponse.json({ error: "مزوّد غير معروف" }, { status: 404 });
  }

  const typedProvider = provider as Provider;
  const next = safeRedirect(request.nextUrl.searchParams.get("next"));

  if (!providerConfigured(typedProvider)) {
    const label = typedProvider === "google" ? "Google" : "Apple";
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(`لم يتم تفعيل الدخول عبر ${label} بعد`)}&next=${encodeURIComponent(next)}`,
        request.url,
      ),
    );
  }

  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = createPkcePair();
  await storeTransientState({ state, verifier, nonce, next });

  const redirectUri = callbackUrl(typedProvider, request.url);

  const parameters = new URLSearchParams({
    client_id:
      typedProvider === "google" ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: typedProvider === "google" ? "openid email profile" : "openid email name",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  if (typedProvider === "google") {
    parameters.set("access_type", "online");
    parameters.set("prompt", "select_account");
  } else {
    // Apple returns the authorization code as a POST form when scopes are requested.
    parameters.set("response_mode", "form_post");
  }

  const authorizeUrl = typedProvider === "google" ? GOOGLE_AUTH_URL : APPLE_AUTH_URL;
  return NextResponse.redirect(`${authorizeUrl}?${parameters.toString()}`);
}
