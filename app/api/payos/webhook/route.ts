import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { getPayosPaymentStatus, isPayosConfigured, verifyPayosSignature } from "@/lib/payos";
import { getOrderByCode, getOrderByPayosCode } from "@/lib/store";
import { getSupabaseServer } from "@/lib/supabase";
import { adjustBalance } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";

/**
 * Webhook PayOS — POST /api/payos/webhook
 * 1. Ghi log mọi lần PayOS gọi vào bảng webhook_logs (để soi webhook có tới
 *    không, chữ ký đúng/sai, tìm thấy đơn không). Ghi log không bao giờ làm
 *    hỏng webhook — lỗi ghi log thì bỏ qua.
 * 2. Verify chữ ký HMAC-SHA256 bằng PAYOS_CHECKSUM_KEY TRƯỚC khi làm gì khác.
 *    Sai chữ ký -> hỏi lại trực tiếp PayOS qua API (phương án dự phòng khi
 *    PayOS đổi định dạng dữ liệu): API báo PAID + đúng số tiền thì vẫn giao
 *    hàng; API báo chưa trả / lỗi thì từ chối 401 như cũ.
 * 3. Chỉ xử lý khi data.code === '00' (thanh toán thành công).
 * 4. Đối chiếu số tiền với đơn; đơn đã xử lý rồi thì bỏ qua (idempotent).
 * 5. Đánh dấu đã thanh toán rồi giao hàng tự động / chuyển đơn làm tay.
 *
 * Đăng ký URL này trong PayOS dashboard (my.payos.vn > Webhook).
 * Chế độ demo (chưa cấu hình PayOS): chấp nhận body { demo: true, orderCode }
 * để thử luồng giao hàng — chỉ khi PayOS chưa được cấu hình.
 */
export async function GET() {
  // PayOS và công cụ kiểm tra có thể gọi GET để kiểm tra endpoint còn sống.
  // Webhook thật luôn là POST, nên GET chỉ báo trạng thái, không xử lý gì.
  return NextResponse.json({ ok: true, service: "payos-webhook", method: "POST" });
}

/**
 * Xử lý webhook nạp Xu: payos orderCode không khớp đơn hàng nào thì tra
 * bảng wallet_topups. Chiếm yêu cầu nạp trước (status pending -> paid,
 * có điều kiện) rồi mới cộng tiền — webhook gửi lại 2 lần cũng chỉ cộng
 * 1 lần. Cộng tiền hỏng thì trả về pending để PayOS gửi lại sau.
 */
async function handleWalletTopupWebhook(input: {
  orderCode: number;
  amount: number;
  signatureOk: boolean;
  raw: unknown;
}): Promise<"handled" | "already" | "amount_mismatch" | "not-found"> {
  const sb = getSupabaseServer();
  if (!sb) return "not-found";
  const { data: tp } = await sb
    .from("wallet_topups")
    .select("*")
    .eq("payos_order_code", input.orderCode)
    .single();
  if (!tp) return "not-found";
  if (tp.status !== "pending") {
    await logWebhook({
      payos_code: input.orderCode,
      amount: input.amount,
      code: "00",
      signature_ok: input.signatureOk,
      outcome: "already_processed",
      raw: input.raw,
    });
    return "already";
  }
  if (input.amount !== tp.amount) {
    await logWebhook({
      payos_code: input.orderCode,
      amount: input.amount,
      code: "00",
      signature_ok: input.signatureOk,
      outcome: "ignored_amount_mismatch",
      error: `nạp ${input.amount} vs yêu cầu ${tp.amount}`,
      raw: input.raw,
    });
    return "amount_mismatch";
  }
  const { data: claimed } = await sb
    .from("wallet_topups")
    .update({ status: "paid" })
    .eq("id", tp.id)
    .eq("status", "pending")
    .select("id")
    .single();
  if (!claimed) return "already";
  try {
    const balanceAfter = await adjustBalance({
      userId: tp.user_id,
      email: tp.customer_email,
      amount: tp.amount,
      type: "topup",
      refCode: `TOPUP-${tp.payos_order_code}`,
      note: `Nạp ${tp.amount} Xu qua VietQR`,
    });
    await logWebhook({
      payos_code: input.orderCode,
      amount: input.amount,
      code: "00",
      signature_ok: input.signatureOk,
      outcome: "topup_fulfilled",
      raw: input.raw,
    });
    await createNotification({
      userId: tp.user_id,
      email: tp.customer_email,
      type: "info",
      title: "Nạp Xu thành công",
      body: `Bạn đã nạp ${tp.amount.toLocaleString("vi-VN")} Xu. Số dư hiện tại: ${balanceAfter.toLocaleString("vi-VN")} Xu.`,
    });
    return "handled";
  } catch (err) {
    await sb.from("wallet_topups").update({ status: "pending" }).eq("id", tp.id);
    throw err; // outer catch ghi error_500, trả 500 để PayOS gửi lại
  }
}

async function logWebhook(entry: {
  payos_code?: number | null;
  amount?: number | null;
  code?: string | null;
  signature_ok?: boolean | null;
  outcome: string;
  error?: string | null;
  raw?: unknown;
}) {
  try {
    const sb = getSupabaseServer();
    if (!sb) return;
    await sb.from("webhook_logs").insert({
      payos_code: entry.payos_code ?? null,
      amount: entry.amount ?? null,
      code: entry.code ?? null,
      signature_ok: entry.signature_ok ?? null,
      outcome: entry.outcome,
      error: entry.error ?? null,
      raw: entry.raw ?? null,
    });
  } catch {
    /* Ghi log thất bại thì bỏ qua — không được làm hỏng webhook. */
  }
}

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
      await logWebhook({ outcome: "bad_request", error: "Thiếu data/signature", raw: body });
      return NextResponse.json({ error: "Thiếu data/signature" }, { status: 400 });
    }
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY!;
    const signatureOk = verifyPayosSignature(data, signature, checksumKey);
    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    if (!signatureOk) {
      // Chữ ký không khớp — chưa vội từ chối: hỏi lại PayOS xem link này
      // thật sự đã trả chưa. Chỉ tin API PayOS, không tin body webhook.
      const checked = Number.isFinite(orderCode) ? await getPayosPaymentStatus(orderCode) : null;
      if (!checked || checked.status !== "PAID" || checked.amount !== amount) {
        console.warn("[webhook] Sai chữ ký PayOS — từ chối (API PayOS cũng không xác nhận đã trả).");
        await logWebhook({
          payos_code: orderCode,
          amount,
          code: String(data.code ?? ""),
          signature_ok: false,
          outcome: "rejected_bad_signature",
          error: `PayOS API: ${checked ? `${checked.status}/${checked.amount}` : "không tra được"}`,
          raw: body,
        });
        return NextResponse.json({ error: "Sai chữ ký" }, { status: 401 });
      }
      console.warn("[webhook] Chữ ký không khớp nhưng PayOS API xác nhận đã trả — vẫn giao hàng.");
      await logWebhook({
        payos_code: orderCode,
        amount,
        code: String(data.code ?? ""),
        signature_ok: false,
        outcome: "signature_mismatch_but_api_paid",
        raw: body,
      });
    }
    if (data.code !== "00") {
      // Thanh toán không thành công / huỷ — ghi log, không giao hàng.
      console.log("[webhook] PayOS báo không thành công:", data.code, data.orderCode);
      await logWebhook({
        payos_code: orderCode,
        amount,
        code: String(data.code ?? ""),
        signature_ok: signatureOk,
        outcome: "ignored_not_success",
        raw: body,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }
    const order = await getOrderByPayosCode(orderCode);
    if (!order) {
      // Không phải đơn hàng — có thể là nạp Xu: tra bảng wallet_topups.
      const topup = await handleWalletTopupWebhook({
        orderCode,
        amount,
        signatureOk,
        raw: body,
      });
      if (topup === "handled") return NextResponse.json({ ok: true, topup: true });
      if (topup === "already") return NextResponse.json({ ok: true, already: true });
      if (topup === "amount_mismatch") {
        return NextResponse.json({ ok: true, ignored: true, reason: "amount_mismatch" });
      }
      // PayOS gửi yêu cầu kiểm tra/xác minh webhook bằng dữ liệu thử
      // (orderCode không có thật) — trả 200 để PayOS lưu được webhook,
      // chỉ ghi log, không giao hàng. Đơn thật luôn có trong DB.
      console.log("[webhook] Kiểm tra webhook PayOS (không tìm thấy đơn với payos orderCode", orderCode, ") — bỏ qua.");
      await logWebhook({
        payos_code: orderCode,
        amount,
        code: String(data.code ?? ""),
        signature_ok: signatureOk,
        outcome: "ignored_order_not_found",
        raw: body,
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "order_not_found" });
    }
    if (amount !== order.total) {
      // Số tiền không khớp: không giao hàng, nhưng trả 200 để PayOS
      // không gửi lại liên tục; admin kiểm tra đơn thủ công trong tab Đơn hàng.
      console.warn("[webhook] Số tiền không khớp đơn", order.code, amount, order.total);
      await logWebhook({
        payos_code: orderCode,
        amount,
        code: String(data.code ?? ""),
        signature_ok: signatureOk,
        outcome: "ignored_amount_mismatch",
        error: `webhook ${amount} vs đơn ${order.total}`,
        raw: body,
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "amount_mismatch" });
    }
    if (order.status !== "pending") {
      await logWebhook({
        payos_code: orderCode,
        amount,
        code: String(data.code ?? ""),
        signature_ok: signatureOk,
        outcome: "already_processed",
        raw: body,
      });
      return NextResponse.json({ ok: true, already: true });
    }

    order.status = "paid";
    const done = await fulfillPaidOrder(order);
    await logWebhook({
      payos_code: orderCode,
      amount,
      code: String(data.code ?? ""),
      signature_ok: signatureOk,
      outcome: "fulfilled",
      raw: body,
    });
    return NextResponse.json({ ok: true, orderCode: done.code });
  } catch (err) {
    console.error("[webhook]", err);
    await logWebhook({
      outcome: "error_500",
      error: err instanceof Error ? err.message : "Lỗi webhook",
    });
    return NextResponse.json({ error: "Lỗi webhook" }, { status: 500 });
  }
}
