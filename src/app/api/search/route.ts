import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { searchProducts } from "@/lib/search";

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10, 30);

  if (term.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchProducts(prisma, term, limit);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[api/search]", error);
    return NextResponse.json({ error: "تعذّر تنفيذ البحث" }, { status: 500 });
  }
}
