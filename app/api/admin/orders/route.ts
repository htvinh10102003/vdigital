import { NextResponse } from "next/server";
import { forbidden, getAdminEmail } from "@/lib/admin-auth";
import { completeManualItem, deliverGameCard, fulfillPaidOrder } from "@/lib/fulfill";
import { notifyOrderDelivered } from "@/lib/notifications";
import { getOrderByCode, listOrders } from "@/lib/store";

// Dữ liệu đổi liên tục (đơn, kho, catalog) — không cache response GET.
export const dynamic = "force-dynamic";

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
      action: "deliver-game-card" | "complete-manual" | "confirm-paid";
      orderCode: string;
      itemId: string;
    };
    if (!orderCode) return NextResponse.json({ error: "Thiếu mã đơn" }, { status: 400 });
    // Xác nhận đã thanh toán tay: khi webhook PayOS chưa gọi về (chưa lưu
    // webhook, lỗi mạng...) mà tiền đã về PayOS, admin bấm để giao hàng ngay.
    // Dùng đúng fulfillPaidOrder như webhook nên chỉ giao 1 lần: đơn đã qua
    // trạng thái pending thì từ chối, webhook tới sau cũng bỏ qua.
    if (action === "confirm-paid") {
      const order = await getOrderByCode(orderCode);
      if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
      if (order.status !== "pending") {
        return NextResponse.json(
          { error: `Đơn này không còn chờ thanh toán (trạng thái hiện tại: ${order.status}).` },
          { status: 409 },
        );
      }
      order.status = "paid";
      const done = await fulfillPaidOrder(order);
      return NextResponse.json({ ok: true, order: done });
    }
    if (!itemId) return NextResponse.json({ error: "Thiếu mã đơn / sản phẩm" }, { status: 400 });
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
      // Giao xong hết đơn thì báo khách "đã giao" (mail thẻ game đã gửi riêng).
      if (order.status === "completed") await notifyOrderDelivered(order);
      return NextResponse.json({ ok: true, order });
    }
    if (action === "complete-manual") {
      const order = await completeManualItem(orderCode, itemId, (body as { note?: string }).note ?? "");
      // Hoàn thành tay xong hết đơn thì báo khách "đã giao" (mail đã gửi riêng).
      if (order.status === "completed") await notifyOrderDelivered(order);
      return NextResponse.json({ ok: true, order });
    }
    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi xử lý đơn" }, { status: 500 });
  }
}
