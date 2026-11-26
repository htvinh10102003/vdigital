import { NextResponse } from "next/server";
import { getCustomerUser, unauthorized } from "@/lib/customer-auth";
import { createPayosPayment, isPayosConfigured } from "@/lib/payos";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { ensureProfile, newTopupCode } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/**
 * Tạo link nạp Xu bằng VietQR (PayOS). 1 Xu = 1đ.
 * Body { amount }: số Xu muốn nạp, 10.000 – 50.000.000.
 * Tiền cộng vào ví CHỈ khi PayOS webhook xác nhận đã trả (coordinator
 * xử lý trong webhook) — route này chỉ tạo link + ghi yêu cầu nạp.
 */
export async function POST(req: Request) {
  const user = await getCustomerUser(req);
  if (!user || !user.email) return unauthorized();
  try {
    const body = await req.json().catch(() => null);
    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount < 10_000 || amount > 50_000_000) {
      return NextResponse.json(
        { error: "Số tiền nạp phải là số nguyên từ 10.000đ đến 50.000.000đ" },
        { status: 400 },
      );
    }
    if (!isPayosConfigured) {
      return NextResponse.json(
        { error: "Nạp tiền chưa khả dụng — shop chưa cấu hình PayOS" },
        { status: 400 },
      );
    }
    const sb = getSupabaseServer();
    if (!sb || !isSupabaseConfigured) return unauthorized();

    const name =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      undefined;
    await ensureProfile(user.id, user.email, name);
    const topupCode = await newTopupCode();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

    const payos = await createPayosPayment({
      orderCode: topupCode,
      amount,
      description: `NAP XU ${amount}`,
      returnUrl: `${siteUrl}/tai-khoan?topup=paid`,
      cancelUrl: `${siteUrl}/tai-khoan?topup=cancelled`,
      buyerName: name,
      buyerEmail: user.email,
    });

    const { error: insErr } = await sb.from("wallet_topups").insert({
      user_id: user.id,
      customer_email: user.email.trim().toLowerCase(),
      amount,
      payos_order_code: topupCode,
      payment_link_id: payos.paymentLinkId,
      status: "pending",
    });
    if (insErr) {
      console.error("[wallet/topup] insert failed:", insErr.message);
      return NextResponse.json({ error: "Không lưu được yêu cầu nạp tiền, vui lòng thử lại" }, { status: 500 });
    }

    // PayOS trả qrCode là chuỗi nội dung VietQR (EMVCo), không phải ảnh —
    // vẽ lại thành ảnh QR thật ở server (giống create-payment).
    let qrImage: string | null = null;
    try {
      const QRCode = (await import("qrcode")).default;
      qrImage = await QRCode.toDataURL(payos.qrCode, { margin: 1, width: 512 });
    } catch {
      qrImage = null;
    }

    return NextResponse.json({
      checkout_url: payos.checkoutUrl,
      qrImage,
      topup_code: topupCode,
      amount,
      payos_order_code: topupCode,
    });
  } catch (err) {
    console.error("[wallet/topup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi tạo link nạp tiền" },
      { status: 500 },
    );
  }
}
