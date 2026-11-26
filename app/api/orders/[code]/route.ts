import { NextResponse } from "next/server";
import { getOrderByCode } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const order = await getOrderByCode(params.code);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  return NextResponse.json(order);
}
