import { NextResponse } from "next/server";
import { createOrder, updateOrder } from "@/lib/store";
import { createPayosPayment, isPayosConfigured } from "@/lib/payos";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customer } = body as {
      items: { variantId: string; qty: number }[];
      customer: { name: string; email: string; phone: string; userId?: string | null };
    };
    if (!items?.length) return NextResponse.json({ error: "Giỏ hàng trống" }, { status: 400 });
    if (!customer?.name || !customer?.email) {
      return NextResponse.json({ error: "Thiếu tên hoặc email khách hàng" }, { status: 400 });
    }
    const order = await createOrder({
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone || "",
      user_id: customer.userId ?? null,
      items,
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

    if (!isPayosConfigured) {
      // Chế độ demo: chưa có PayOS — trả thông tin chuyển khoản MB Bank để khách
      // chuyển khoản tay, admin/test bấm "Mô phỏng đã thanh toán" để thử luồng giao hàng.
      return NextResponse.json({
        demo: true,
        orderCode: order.code,
        amount: order.total,
        bank: {
          name: process.env.MB_BANK_NAME || "MB Bank",
          account: process.env.MB_BANK_ACCOUNT || "CHƯA CẤU HÌNH",
          accountName: process.env.MB_BANK_ACCOUNT_NAME || "VDIGITAL",
        },
        content: order.code,
        note: "Chưa cấu hình PayOS — đây là chế độ demo. Xem README để đăng ký PayOS và liên kết MB Bank.",
      });
    }

    const payos = await createPayosPayment({
      orderCode: order.payos_order_code!,
      amount: order.total,
      description: order.code,
      returnUrl: `${siteUrl}/thanh-toan?code=${order.code}&status=PAID`,
      cancelUrl: `${siteUrl}/thanh-toan?code=${order.code}&status=CANCELLED`,
      buyerName: customer.name,
      buyerEmail: customer.email,
      buyerPhone: customer.phone,
    });
    order.payment_link_id = payos.paymentLinkId;
    order.checkout_url = payos.checkoutUrl;
    await updateOrder(order);
    return NextResponse.json({
      demo: false,
      orderCode: order.code,
      amount: payos.amount,
      checkoutUrl: payos.checkoutUrl,
      qrCode: payos.qrCode,
      paymentLinkId: payos.paymentLinkId,
    });
  } catch (err) {
    console.error("[create-payment]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi tạo đơn" }, { status: 500 });
  }
}
