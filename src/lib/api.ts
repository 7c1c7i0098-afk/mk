import { NextResponse } from "next/server";

/** Customer-facing error — never leaks internals. */
export function apiError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function apiOk<T extends Record<string, unknown>>(payload?: T) {
  return NextResponse.json({ ok: true, ...(payload ?? {}) });
}

/** Logs the real cause server-side and returns a generic Arabic message. */
export function apiFailure(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
  return apiError("حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى", 500);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
