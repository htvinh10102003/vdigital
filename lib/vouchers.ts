import { getSupabaseServer, isSupabaseConfigured } from "./supabase";

/**
 * Voucher — mọi kiểm tra đều chạy lại phía server, không tin client.
 * - type percent: giảm value% tổng đơn; fixed: giảm value đồng.
 * - target_emails null = mọi người; có danh sách thì chỉ email trong đó.
 * - Mỗi email dùng 1 lần / voucher (bảng voucher_usages, UNIQUE).
 * - Ghi nhận sử dụng CHỈ khi đơn đã trả tiền (trong fulfillPaidOrder).
 */

export interface Voucher {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  target_emails: string[] | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase();
}

export function computeDiscount(voucher: Pick<Voucher, "type" | "value">, total: number): number {
  if (total <= 0) return 0;
  if (voucher.type === "percent") return Math.floor((total * voucher.value) / 100);
  return Math.min(voucher.value, total);
}

export async function getVoucherByCode(code: string): Promise<Voucher | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb.from("vouchers").select("*").eq("code", normalizeVoucherCode(code)).single();
  return (data ?? null) as Voucher | null;
}

export async function validateVoucher(input: {
  code: string;
  orderTotal: number;
  customerEmail: string;
}): Promise<{ ok: true; discount: number; voucher: Voucher } | { ok: false; error: string }> {
  const code = normalizeVoucherCode(input.code);
  if (!code) return { ok: false, error: "Nhập mã voucher" };
  const voucher = await getVoucherByCode(code);
  if (!voucher) return { ok: false, error: "Mã voucher không tồn tại" };
  if (!voucher.is_active) return { ok: false, error: "Mã voucher đã bị tắt" };
  if (voucher.expires_at && new Date(voucher.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Mã voucher đã hết hạn" };
  }
  if (input.orderTotal < (voucher.min_order ?? 0)) {
    return { ok: false, error: `Đơn tối thiểu ${voucher.min_order.toLocaleString("vi-VN")}đ mới dùng được mã này` };
  }
  if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
    return { ok: false, error: "Mã voucher đã hết lượt dùng" };
  }
  const targets = voucher.target_emails;
  if (Array.isArray(targets) && targets.length > 0) {
    const mail = input.customerEmail.trim().toLowerCase();
    if (!targets.map((t) => String(t).trim().toLowerCase()).includes(mail)) {
      return { ok: false, error: "Mã voucher này không dành cho tài khoản của bạn" };
    }
  }
  const sb = getSupabaseServer();
  if (sb) {
    const { data: used } = await sb
      .from("voucher_usages")
      .select("id")
      .eq("voucher_id", voucher.id)
      .eq("customer_email", input.customerEmail.trim().toLowerCase())
      .single();
    if (used) return { ok: false, error: "Bạn đã dùng mã voucher này rồi" };
  }
  const discount = computeDiscount(voucher, input.orderTotal);
  if (discount <= 0) return { ok: false, error: "Mã voucher không giảm được cho đơn này" };
  return { ok: true, discount, voucher };
}

/**
 * Ghi nhận đã dùng voucher (chỉ gọi khi đơn đã trả tiền). Idempotent:
 * UNIQUE(voucher_id, customer_email) nên gọi 2 lần cũng chỉ ghi 1 lần.
 */
export async function recordVoucherUsage(input: {
  voucherCode: string;
  userId: string | null;
  customerEmail: string;
  orderCode: string;
}): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseServer();
    if (!sb) return;
    const voucher = await getVoucherByCode(input.voucherCode);
    if (!voucher) return;
    const mail = input.customerEmail.trim().toLowerCase();
    const { error: insErr } = await sb.from("voucher_usages").insert({
      voucher_id: voucher.id,
      user_id: input.userId,
      customer_email: mail,
      order_code: input.orderCode,
    });
    if (insErr) return; // đã ghi rồi (unique) thì thôi
    // Tăng used_count có điều kiện (tránh vượt max_uses khi nhiều đơn cùng lúc).
    const { data: cur } = await sb.from("vouchers").select("used_count, max_uses").eq("id", voucher.id).single();
    if (!cur) return;
    if (cur.max_uses === null || Number(cur.used_count) < Number(cur.max_uses)) {
      await sb
        .from("vouchers")
        .update({ used_count: Number(cur.used_count) + 1 })
        .eq("id", voucher.id)
        .eq("used_count", Number(cur.used_count));
    }
  } catch (err) {
    console.error("[voucher] record usage failed:", err instanceof Error ? err.message : err);
  }
}

/** Voucher công khai để gợi ý ở checkout (không gồm voucher tặng riêng). */
export async function listPublicVouchers(limit = 10): Promise<Voucher[]> {
  if (!isSupabaseConfigured) return [];
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("vouchers")
    .select("*")
    .eq("is_active", true)
    .is("target_emails", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  const now = Date.now();
  return ((data ?? []) as Voucher[]).filter(
    (v) =>
      (!v.expires_at || new Date(v.expires_at).getTime() > now) &&
      (v.max_uses === null || v.used_count < v.max_uses),
  );
}
