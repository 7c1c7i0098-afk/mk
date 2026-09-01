import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Real OAuth 2.0 / OIDC for Google and Apple — authorization code flow with
 * PKCE, state and nonce. Secrets stay server-side; nothing is ever sent to the
 * browser. Providers are optional: when their environment variables are absent
 * the buttons stay visible but the endpoints answer with a clear message.
 */

export type Provider = "google" | "apple";

const STATE_COOKIE = "pluscard_oauth_state";
const VERIFIER_COOKIE = "pluscard_oauth_verifier";
const NONCE_COOKIE = "pluscard_oauth_nonce";
const NEXT_COOKIE = "pluscard_oauth_next";
const TRANSIENT_MAX_AGE = 10 * 60; // 10 minutes

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function appleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY,
  );
}

export function providerConfigured(provider: Provider) {
  return provider === "google" ? googleConfigured() : appleConfigured();
}

/** Absolute callback URL; APP_URL wins, otherwise it is derived from the request. */
export function callbackUrl(provider: Provider, requestUrl: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(requestUrl).origin;
  return `${base}/api/auth/${provider}/callback`;
}

function base64Url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Stores the one-time CSRF/replay guards in httpOnly cookies. */
export async function storeTransientState(values: {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}) {
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRANSIENT_MAX_AGE,
  };
  store.set(STATE_COOKIE, values.state, options);
  store.set(VERIFIER_COOKIE, values.verifier, options);
  store.set(NONCE_COOKIE, values.nonce, options);
  store.set(NEXT_COOKIE, values.next, options);
}

export async function readTransientState() {
  const store = await cookies();
  return {
    state: store.get(STATE_COOKIE)?.value ?? null,
    verifier: store.get(VERIFIER_COOKIE)?.value ?? null,
    nonce: store.get(NONCE_COOKIE)?.value ?? null,
    next: store.get(NEXT_COOKIE)?.value ?? "/",
  };
}

export async function clearTransientState() {
  const store = await cookies();
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NONCE_COOKIE, NEXT_COOKIE]) {
    store.delete(name);
  }
}

export function randomToken() {
  return base64Url(randomBytes(24));
}

/**
 * Apple does not issue a static client secret: it is an ES256 JWT signed with
 * the private key downloaded from the Apple Developer portal.
 */
async function appleClientSecret() {
  const { importPKCS8 } = await import("jose");
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("https://appleid.apple.com")
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .sign(key);
}

export type IdTokenClaims = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/** Exchanges the authorization code and verifies the returned id_token. */
export async function exchangeCode(options: {
  provider: Provider;
  code: string;
  redirectUri: string;
  verifier: string;
  nonce: string;
}): Promise<IdTokenClaims> {
  const isGoogle = options.provider === "google";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
    client_id: isGoogle ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!,
    client_secret: isGoogle ? process.env.GOOGLE_CLIENT_SECRET! : await appleClientSecret(),
  });

  const response = await fetch(isGoogle ? GOOGLE_TOKEN_URL : APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Provider did not return an id_token");

  const { payload } = await jwtVerify(tokens.id_token, isGoogle ? GOOGLE_JWKS : APPLE_JWKS, {
    issuer: isGoogle ? "https://accounts.google.com" : "https://appleid.apple.com",
    audience: isGoogle ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!,
  });

  if (payload.nonce !== options.nonce) {
    throw new Error("id_token nonce mismatch");
  }

  // Apple reports email_verified as the string "true" on occasion.
  const verifiedClaim = payload.email_verified;
  const emailVerified = verifiedClaim === true || verifiedClaim === "true";

  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    // Apple always verifies the address it releases, including private relays.
    emailVerified: isGoogle ? emailVerified : true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
