import { NextResponse } from "next/server";
import { validateVoucher } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/**
 * Kiểm tra voucher cho đơn ở checkout — KHÔNG cần đăng nhập (khách vãng
 * lai có email trong form). Trả 200 với { ok:false, error } để UI hiện
 * thẳng thông báo, không dùng 4xx.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";
    const orderTotal = Number(body?.order_total);
    const customerEmail = typeof body?.customer_email === "string" ? body.customer_email : "";
    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: "Nhập mã voucher" });
    }
    if (!Number.isFinite(orderTotal) || orderTotal < 0) {
      return NextResponse.json({ ok: false, error: "Tổng đơn không hợp lệ" });
    }
    const result = await validateVoucher({ code, orderTotal, customerEmail });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error });
    return NextResponse.json({
      ok: true,
      discount: result.discount,
      type: result.voucher.type,
      value: result.voucher.value,
    });
  } catch (err) {
    console.error("[vouchers/validate]", err);
    return NextResponse.json({ ok: false, error: "Lỗi kiểm tra voucher" });
  }
}
