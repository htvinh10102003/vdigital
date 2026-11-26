import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { completeManualItem, deliverGameCard } from "@/lib/fulfill";
import { listOrders } from "@/lib/store";

export async function GET(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  const orders = await listOrders();
  return NextResponse.json({ admin: email, orders });
}

export async function POST(req: Request) {
  const email = await getAdminEmail(req);
  if (!email) return forbidden();
  try {
    const body = await req.json();
    const { action, orderCode, itemId } = body as {
      action: "deliver-game-card" | "complete-manual";
      orderCode: string;
      itemId: string;
    };
    if (!orderCode || !itemId) return NextResponse.json({ error: "Thiếu mã đơn / sản phẩm" }, { status: 400 });
    if (action === "deliver-game-card") {
      const { serial, pin, denomination, note } = body as {
        serial: string;
        pin: string;
        denomination: string;
        note?: string;
      };
      if (!serial?.trim() || !pin?.trim() || !denomination?.trim()) {
        return NextResponse.json({ error: "Nhập đủ serial, mã thẻ và mệnh giá" }, { status: 400 });
      }
      const order = await deliverGameCard(orderCode, itemId, {
        serial,
        pin,
        denomination,
        note,
      });
      return NextResponse.json({ ok: true, order });
    }
    if (action === "complete-manual") {
      const order = await completeManualItem(orderCode, itemId, (body as { note?: string }).note ?? "");
      return NextResponse.json({ ok: true, order });
    }
    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi xử lý đơn" }, { status: 500 });
  }
}
