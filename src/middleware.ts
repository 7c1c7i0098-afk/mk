import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * First line of defence for /admin.
 *
 * Runs before any admin layout or page renders, so an unauthorised visitor
 * never receives admin markup at all. It only reads the signed session cookie
 * (no database access is possible here), which is why the real authorization
 * still happens server-side in requireAdminPage() / assertAdmin(): those catch
 * a role that changed, a suspended account or a retired session after the
 * token was issued.
 */
const COOKIE_NAME = "pluscard_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  const value =
    secret && secret.length >= 32 ? secret : "pluscard-development-secret-key-0001";
  return new TextEncoder().encode(value);
}

async function role(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const current = await role(request);
  if (current === "ADMIN") return NextResponse.next();

  // API callers get a plain refusal; page requests are sent away.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  if (!current) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
