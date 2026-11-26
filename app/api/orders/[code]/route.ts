import { NextResponse } from "next/server";
import { getOrderByCode } from "@/lib/store";

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const order = await getOrderByCode(params.code);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  return NextResponse.json(order);
}
