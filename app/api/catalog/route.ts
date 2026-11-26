import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/store";

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await getCatalog();
  return NextResponse.json(catalog);
}
