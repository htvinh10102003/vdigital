import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { isPayosConfigured, verifyPayosSignature } from "@/lib/payos";
import { getOrderByCode, getOrderByPayosCode } from "@/lib/store";

/**
 * Webhook PayOS — POST /api/payos/webhook
 * 1. Verify chữ ký HMAC-SHA256 bằng PAYOS_CHECKSUM_KEY TRƯỚC khi làm gì khác.
 *    Sai chữ ký -> 401, không chạm tới đơn hàng.
 * 2. Chỉ xử lý khi data.code === '00' (thanh toán thành công).
 * 3. Đối chiếu số tiền với đơn; đơn đã xử lý rồi thì bỏ qua (idempotent).
 * 4. Đánh dấu đã thanh toán rồi giao hàng tự động / chuyển đơn làm tay.
 *
 * Đăng ký URL này trong PayOS dashboard (my.payos.vn > Webhook).
 * Chế độ demo (chưa cấu hình PayOS): chấp nhận body { demo: true, orderCode }
 * để thử luồng giao hàng — chỉ khi PayOS chưa được cấu hình.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // --- Chế độ demo ---
    if (!isPayosConfigured) {
      if (body?.demo === true && typeof body?.orderCode === "string") {
        const order = await getOrderByCode(body.orderCode);
        if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
        if (order.status !== "pending") return NextResponse.json({ ok: true, already: true });
        order.status = "paid";
        const done = await fulfillPaidOrder(order);
        return NextResponse.json({ ok: true, order: done });
      }
      return NextResponse.json({ error: "Webhook demo không hợp lệ" }, { status: 400 });
    }

    // --- PayOS thật: verify chữ ký trước ---
    const { data, signature } = body as { data: Record<string, unknown>; signature: string };
    if (!data || !signature) {
      return NextResponse.json({ error: "Thiếu data/signature" }, { status: 400 });
    }
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY!;
    if (!verifyPayosSignature(data, signature, checksumKey)) {
      console.warn("[webhook] Sai chữ ký PayOS — từ chối.");
      return NextResponse.json({ error: "Sai chữ ký" }, { status: 401 });
    }
    if (data.code !== "00") {
      // Thanh toán không thành công / huỷ — ghi log, không giao hàng.
      console.log("[webhook] PayOS báo không thành công:", data.code, data.orderCode);
      return NextResponse.json({ ok: true, ignored: true });
    }
    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    const order = await getOrderByPayosCode(orderCode);
    if (!order) {
      console.warn("[webhook] Không tìm thấy đơn với payos orderCode", orderCode);
      return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
    }
    if (amount !== order.total) {
      console.warn("[webhook] Số tiền không khớp đơn", order.code, amount, order.total);
      return NextResponse.json({ error: "Số tiền không khớp" }, { status: 400 });
    }
    if (order.status !== "pending") return NextResponse.json({ ok: true, already: true });

    order.status = "paid";
    const done = await fulfillPaidOrder(order);
    return NextResponse.json({ ok: true, orderCode: done.code });
  } catch (err) {
    console.error("[webhook]", err);
    return NextResponse.json({ error: "Lỗi webhook" }, { status: 500 });
  }
}
