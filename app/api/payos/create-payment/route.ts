import { NextResponse } from "next/server";
import { getOrderByCode, createOrder, updateOrder } from "@/lib/store";
import { createPayosPayment, isPayosConfigured } from "@/lib/payos";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { adjustBalance, ensureProfile, getWalletBalance } from "@/lib/wallet";
import { normalizeVoucherCode, validateVoucher } from "@/lib/vouchers";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { formatVND } from "@/lib/format";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customer, payment_method, voucher_code } = body as {
      items: { variantId: string; qty: number; customerInfo?: Record<string, string> }[];
      customer: { name: string; email: string; phone: string; userId?: string | null };
      payment_method?: "vietqr" | "xu";
      voucher_code?: string | null;
    };
    if (!items?.length) return NextResponse.json({ error: "Giỏ hàng trống" }, { status: 400 });
    if (!customer?.name || !customer?.email) {
      return NextResponse.json({ error: "Thiếu tên hoặc email khách hàng" }, { status: 400 });
    }
    // Validate các ô bắt buộc theo manual_fields của từng gói làm tay
    // (server kiểm tra lại, không chỉ tin client) + tính tổng gốc.
    const { getCatalog } = await import("@/lib/store");
    const catalog = await getCatalog();
    let rawTotal = 0;
    for (const it of items) {
      const variant = catalog.products.flatMap((p) => p.variants).find((v) => v.id === it.variantId);
      if (!variant) return NextResponse.json({ error: `Không tìm thấy gói ${it.variantId}` }, { status: 400 });
      rawTotal += variant.price * (it.qty || 1);
      for (const f of variant.manual_fields ?? []) {
        if (!f.required) continue;
        const val = (it.customerInfo?.[f.id] ?? "").trim();
        if (!val) return NextResponse.json({ error: `Thiếu thông tin bắt buộc: ${f.label}` }, { status: 400 });
        if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          return NextResponse.json({ error: `${f.label} không đúng định dạng email` }, { status: 400 });
        }
      }
    }

    // Voucher: validate lại phía server, giảm vào tổng TRƯỚC khi tạo đơn.
    let discount = 0;
    let voucherCode: string | null = null;
    if (voucher_code?.trim()) {
      const v = await validateVoucher({
        code: voucher_code,
        orderTotal: rawTotal,
        customerEmail: customer.email,
      });
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      discount = v.discount;
      voucherCode = normalizeVoucherCode(voucher_code);
    }
    const finalTotal = rawTotal - discount;
    if (finalTotal < 1000) {
      return NextResponse.json({ error: "Đơn tối thiểu 1.000đ sau khi giảm giá" }, { status: 400 });
    }

    // ---- Thanh toán bằng số dư Xu (1 Xu = 1đ) ----
    if (payment_method === "xu") {
      if (!isSupabaseConfigured) {
        // Xu cần Supabase (số dư trong DB); demo mode không có Xu.
        return NextResponse.json({ error: "Thanh toán bằng Xu chưa khả dụng ở chế độ demo" }, { status: 400 });
      }
      const user = await getCustomerUser(req);
      if (!user?.email) return unauthorized();
      if (user.email.toLowerCase() !== customer.email.trim().toLowerCase()) {
        return NextResponse.json({ error: "Thanh toán bằng Xu cần đăng nhập đúng email đặt đơn" }, { status: 403 });
      }
      await ensureProfile(user.id, user.email, customer.name);
      const { balance } = await getWalletBalance(user.id, user.email);
      if (balance < finalTotal) {
        return NextResponse.json(
          { error: `Số dư Xu không đủ — cần ${formatVND(finalTotal)}, hiện có ${formatVND(balance)}`, needTopup: true },
          { status: 400 },
        );
      }
      const order = await createOrder({
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone || "",
        user_id: user.id,
        items,
        voucherCode,
        discountAmount: discount,
        paymentMethod: "xu",
      });
      try {
        await adjustBalance({
          userId: user.id,
          email: user.email,
          amount: -finalTotal,
          type: "spend",
          refCode: order.code,
          note: `Thanh toán đơn ${order.code}`,
        });
      } catch (e) {
        // Trừ tiền hỏng (thường do race làm hụt số dư): huỷ đơn, báo rõ.
        order.status = "cancelled";
        await updateOrder(order).catch(() => {});
        const msg =
          e instanceof Error && e.message === "INSUFFICIENT_BALANCE"
            ? "Số dư Xu không đủ — nạp thêm rồi thử lại"
            : "Lỗi trừ số dư Xu, đơn đã huỷ";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      order.status = "paid";
      try {
        const done = await fulfillPaidOrder(order);
        return NextResponse.json({ demo: false, xu: true, orderCode: done.code, amount: done.total, order: done });
      } catch (e) {
        // Giao hàng lỗi: chỉ hoàn tiền khi đơn vẫn còn pending trong DB
        // (fulfill hỏng trước khi cập nhật trạng thái). Đã qua pending thì
        // đơn đã được giao/xử lý — không hoàn, để admin xử lý tay.
        const fresh = await getOrderByCode(order.code);
        if (fresh && fresh.status === "pending") {
          await adjustBalance({
            userId: user.id,
            email: user.email,
            amount: finalTotal,
            type: "refund",
            refCode: order.code,
            note: `Hoàn tiền đơn ${order.code} do giao hàng lỗi`,
          }).catch(() => {});
          order.status = "cancelled";
          await updateOrder(order).catch(() => {});
        }
        console.error("[create-payment xu]", e);
        return NextResponse.json(
          { error: `Thanh toán Xu xong nhưng giao hàng lỗi — liên hệ shop kèm mã đơn ${order.code}` },
          { status: 500 },
        );
      }
    }

    // ---- Thanh toán VietQR qua PayOS (luồng cũ) ----
    const order = await createOrder({
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone || "",
      user_id: customer.userId ?? null,
      items,
      voucherCode,
      discountAmount: discount,
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
    // PayOS trả qrCode là chuỗi nội dung VietQR (EMVCo), KHÔNG phải ảnh base64
    // — trang thanh toán trước đây gắn nó vào data:image/png nên ảnh vỡ.
    // Vẽ lại thành ảnh QR thật ở server để khách quét được ngay.
    let qrImage: string | null = null;
    try {
      const QRCode = (await import("qrcode")).default;
      qrImage = await QRCode.toDataURL(payos.qrCode, { margin: 1, width: 512 });
    } catch {
      qrImage = null;
    }
    return NextResponse.json({
      demo: false,
      orderCode: order.code,
      amount: payos.amount,
      checkoutUrl: payos.checkoutUrl,
      qrCode: payos.qrCode,
      qrImage,
      paymentLinkId: payos.paymentLinkId,
      discount,
      voucherCode,
    });
  } catch (err) {
    console.error("[create-payment]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lỗi tạo đơn" }, { status: 500 });
  }
}
